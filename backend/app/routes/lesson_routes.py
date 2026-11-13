from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import (
    ApiResponse,
    AttemptResultOut,
    AttemptStandardRequest,
    AttemptTranslateRequest,
    ExercisePublicOut,
    LessonCompleteResultOut,
    LessonDetailOut,
)
from app.services.ai_service import generate_translate_feedback
from app.services.milestone_service import check_and_award_badges
from app.services.progress_service import (
    HEARTS_EMPTY_CODE,
    HeartsEmptyError,
    add_xp,
    apply_heart_loss,
    fetch_user_progress_row,
    heart_fields,
    require_hearts,
    update_current_lesson,
)
from app.utils.cache import RateLimitExceeded, check_translate_attempt_rate_limit
from app.utils.helpers import error_response, success_response, utcnow

router = APIRouter(tags=["lessons"])

LESSON_TIDAK_DITEMUKAN = "Lesson tidak ditemukan"
EXERCISE_TIDAK_DITEMUKAN = "Soal tidak ditemukan pada lesson ini"
LESSON_TERKUNCI = "Lesson ini masih terkunci, selesaikan lesson sebelumnya terlebih dahulu"


def _fetch_lesson_row(lesson_id: UUID) -> Dict[str, Any]:
    client = get_service_client()
    result = (
        client.table("lesson")
        .select("lesson_id, unit_id, order_index, xp_reward_base")
        .eq("lesson_id", str(lesson_id))
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=LESSON_TIDAK_DITEMUKAN)
    return result.data[0]


def _is_lesson_locked(user_id: UUID, lesson_row: Dict[str, Any]) -> bool:
    if lesson_row["order_index"] <= 1:
        return False

    client = get_service_client()
    previous_lesson_result = (
        client.table("lesson")
        .select("lesson_id")
        .eq("unit_id", lesson_row["unit_id"])
        .eq("order_index", lesson_row["order_index"] - 1)
        .limit(1)
        .execute()
    )
    if not previous_lesson_result.data:
        return False

    previous_lesson_id = previous_lesson_result.data[0]["lesson_id"]
    completion_result = (
        client.table("lesson_completion")
        .select("lesson_id")
        .eq("user_id", str(user_id))
        .eq("lesson_id", previous_lesson_id)
        .limit(1)
        .execute()
    )
    return not bool(completion_result.data)


def _fetch_exercises_public(lesson_id: UUID) -> List[ExercisePublicOut]:
    client = get_service_client()
    result = (
        client.table("exercise")
        .select("exercise_id, type, topic, question, options")
        .eq("lesson_id", str(lesson_id))
        .order("exercise_id")
        .execute()
    )
    return [
        ExercisePublicOut(
            exercise_id=UUID(row["exercise_id"]),
            type=row["type"],
            topic=row["topic"],
            question=row["question"],
            options=row.get("options"),
        )
        for row in result.data
    ]


def _xp_per_exercise(lesson_id: UUID) -> int:
    client = get_service_client()
    lesson_result = (
        client.table("lesson")
        .select("xp_reward_base")
        .eq("lesson_id", str(lesson_id))
        .limit(1)
        .execute()
    )
    xp_reward_base = lesson_result.data[0]["xp_reward_base"] if lesson_result.data else 0
    exercises_result = (
        client.table("exercise").select("exercise_id").eq("lesson_id", str(lesson_id)).execute()
    )
    jumlah_exercise = len(exercises_result.data)
    if jumlah_exercise <= 0:
        return 0
    return max(1, xp_reward_base // jumlah_exercise)


def _fetch_exercise_row(exercise_id: UUID) -> Optional[Dict[str, Any]]:
    client = get_service_client()
    result = (
        client.table("exercise")
        .select("exercise_id, lesson_id, type, topic, question, expected_answer")
        .eq("exercise_id", str(exercise_id))
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def record_attempt_log(user_id: UUID, topic: str, is_correct: bool) -> None:
    client = get_service_client()
    client.table("attempt_log").insert(
        {
            "user_id": str(user_id),
            "topic": topic,
            "is_correct": is_correct,
            "created_at": utcnow().isoformat(),
        }
    ).execute()


def _add_to_review_queue(user_id: UUID, exercise_id: UUID) -> None:
    client = get_service_client()
    existing = (
        client.table("review_queue")
        .select("review_id")
        .eq("user_id", str(user_id))
        .eq("exercise_id", str(exercise_id))
        .limit(1)
        .execute()
    )
    if existing.data:
        return
    client.table("review_queue").insert(
        {
            "user_id": str(user_id),
            "exercise_id": str(exercise_id),
            "ai_exercise_id": None,
            "added_at": utcnow().isoformat(),
        }
    ).execute()


def _finish_attempt(
    user_id: UUID,
    lesson_id: UUID,
    exercise_row: Dict[str, Any],
    is_correct: bool,
    feedback: Optional[str],
    grammar_note: Optional[str],
) -> ApiResponse:
    record_attempt_log(user_id, exercise_row["topic"], is_correct)

    if is_correct:
        xp_earned = _xp_per_exercise(lesson_id)
        add_xp(user_id, xp_earned)
        progress_row = fetch_user_progress_row(user_id)
    else:
        xp_earned = 0
        _add_to_review_queue(user_id, UUID(exercise_row["exercise_id"]))
        try:
            progress_row = apply_heart_loss(user_id)
        except HeartsEmptyError:
            return error_response(HEARTS_EMPTY_CODE)

    result = AttemptResultOut(
        correct=is_correct,
        xp_earned=xp_earned,
        feedback=feedback,
        grammar_note=grammar_note,
        **heart_fields(progress_row),
    )
    return success_response(result)


@router.get("/lessons/{lesson_id}", response_model=ApiResponse)
def get_lesson_detail(lesson_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    lesson_row = _fetch_lesson_row(lesson_id)
    if _is_lesson_locked(user_id, lesson_row):
        return error_response(LESSON_TERKUNCI)

    exercises = _fetch_exercises_public(lesson_id)
    progress_row = fetch_user_progress_row(user_id)

    detail = LessonDetailOut(
        lesson_id=UUID(lesson_row["lesson_id"]),
        unit_id=UUID(lesson_row["unit_id"]),
        order_index=lesson_row["order_index"],
        xp_reward_base=lesson_row["xp_reward_base"],
        exercises=exercises,
        **heart_fields(progress_row),
    )
    return success_response(detail)


@router.post("/lessons/{lesson_id}/attempt/standard", response_model=ApiResponse)
def attempt_standard(
    lesson_id: UUID,
    payload: AttemptStandardRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> ApiResponse:
    exercise_row = _fetch_exercise_row(payload.exercise_id)
    if exercise_row is None or exercise_row["lesson_id"] != str(lesson_id):
        return error_response(EXERCISE_TIDAK_DITEMUKAN)

    # Titik C: heart dicek di database SEBELUM jawaban diproses.
    try:
        require_hearts(user_id)
    except HeartsEmptyError:
        return error_response(HEARTS_EMPTY_CODE)

    expected_answer = exercise_row["expected_answer"]
    is_correct = payload.user_answer.strip().lower() == expected_answer.strip().lower()
    return _finish_attempt(user_id, lesson_id, exercise_row, is_correct, None, None)


@router.post("/lessons/{lesson_id}/attempt/translate", response_model=ApiResponse)
def attempt_translate(
    lesson_id: UUID,
    payload: AttemptTranslateRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> ApiResponse:
    exercise_row = _fetch_exercise_row(payload.exercise_id)
    if exercise_row is None or exercise_row["lesson_id"] != str(lesson_id):
        return error_response(EXERCISE_TIDAK_DITEMUKAN)

    try:
        require_hearts(user_id)
    except HeartsEmptyError:
        return error_response(HEARTS_EMPTY_CODE)

    try:
        check_translate_attempt_rate_limit(str(user_id))
    except RateLimitExceeded as exc:
        return error_response(exc.message)

    feedback_result = generate_translate_feedback(
        user_answer=payload.user_answer,
        expected_answer=exercise_row["expected_answer"],
        question_text=exercise_row["question"],
    )
    return _finish_attempt(
        user_id,
        lesson_id,
        exercise_row,
        feedback_result.is_meaning_correct,
        feedback_result.feedback,
        feedback_result.grammar_note,
    )


def _next_lesson_id(lesson_row: Dict[str, Any]) -> Optional[UUID]:
    """Lesson setelah lesson ini: berikutnya di unit yang sama, atau lesson pertama unit berikutnya."""
    client = get_service_client()
    same_unit_result = (
        client.table("lesson")
        .select("lesson_id, order_index")
        .eq("unit_id", lesson_row["unit_id"])
        .gt("order_index", lesson_row["order_index"])
        .order("order_index")
        .limit(1)
        .execute()
    )
    if same_unit_result.data:
        return UUID(same_unit_result.data[0]["lesson_id"])

    unit_result = (
        client.table("unit")
        .select("unit_id, course_id, order_index")
        .eq("unit_id", lesson_row["unit_id"])
        .limit(1)
        .execute()
    )
    if not unit_result.data:
        return None
    unit_row = unit_result.data[0]

    next_unit_result = (
        client.table("unit")
        .select("unit_id")
        .eq("course_id", unit_row["course_id"])
        .gt("order_index", unit_row["order_index"])
        .order("order_index")
        .limit(1)
        .execute()
    )
    if not next_unit_result.data:
        return None

    first_lesson_result = (
        client.table("lesson")
        .select("lesson_id")
        .eq("unit_id", next_unit_result.data[0]["unit_id"])
        .order("order_index")
        .limit(1)
        .execute()
    )
    return UUID(first_lesson_result.data[0]["lesson_id"]) if first_lesson_result.data else None


@router.post("/lessons/{lesson_id}/complete", response_model=ApiResponse)
def complete_lesson(lesson_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    lesson_row = _fetch_lesson_row(lesson_id)
    if _is_lesson_locked(user_id, lesson_row):
        return error_response(LESSON_TERKUNCI)

    # Heart 0 artinya lesson berhenti di tengah: sisa soal dianggap belum selesai,
    # jadi lesson gak boleh ditandai complete.
    try:
        require_hearts(user_id)
    except HeartsEmptyError:
        return error_response(HEARTS_EMPTY_CODE)

    client = get_service_client()
    existing_completion = (
        client.table("lesson_completion")
        .select("lesson_id")
        .eq("user_id", str(user_id))
        .eq("lesson_id", str(lesson_id))
        .limit(1)
        .execute()
    )
    if not existing_completion.data:
        client.table("lesson_completion").insert(
            {
                "user_id": str(user_id),
                "lesson_id": str(lesson_id),
                "completed_at": utcnow().isoformat(),
            }
        ).execute()

    update_current_lesson(user_id, _next_lesson_id(lesson_row))
    badge_earned = check_and_award_badges(user_id)
    progress_row = fetch_user_progress_row(user_id)

    result = LessonCompleteResultOut(
        xp_earned_total=progress_row["total_xp"],
        badge_earned=badge_earned,
        **heart_fields(progress_row),
    )
    return success_response(result)
