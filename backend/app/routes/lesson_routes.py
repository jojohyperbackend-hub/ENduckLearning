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
    add_xp,
    apply_heart_loss,
    fetch_user_progress_row,
    reset_hearts,
    update_current_lesson,
)
from app.utils.cache import check_translate_attempt_rate_limit
from app.utils.cache import RateLimitExceeded
from app.utils.helpers import error_response, success_response, utcnow

router = APIRouter(tags=["lessons"])

LESSON_TIDAK_DITEMUKAN = "Lesson tidak ditemukan"
EXERCISE_TIDAK_DITEMUKAN = "Soal tidak ditemukan pada lesson ini"
LESSON_TERKUNCI = "Lesson ini masih terkunci, selesaikan lesson sebelumnya terlebih dahulu"


def _is_lesson_locked(user_id: UUID, lesson_id: UUID) -> bool:
    client = get_service_client()

    lesson_result = (
        client.table("lesson")
        .select("lesson_id, unit_id, order_index")
        .eq("lesson_id", str(lesson_id))
        .limit(1)
        .execute()
    )
    if not lesson_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=LESSON_TIDAK_DITEMUKAN)
    lesson_row = lesson_result.data[0]

    if lesson_row["order_index"] <= 1:
        return False

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


def _calculate_xp_per_exercise(xp_reward_base: int, jumlah_exercise: int) -> int:
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


def _record_attempt_log(user_id: UUID, topic: str, is_correct: bool) -> None:
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


@router.get("/lessons/{lesson_id}", response_model=ApiResponse)
def get_lesson_detail(lesson_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    if _is_lesson_locked(user_id, lesson_id):
        return error_response(LESSON_TERKUNCI)

    client = get_service_client()
    lesson_result = (
        client.table("lesson")
        .select("lesson_id, unit_id, order_index, xp_reward_base")
        .eq("lesson_id", str(lesson_id))
        .limit(1)
        .execute()
    )
    if not lesson_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=LESSON_TIDAK_DITEMUKAN)
    lesson_row = lesson_result.data[0]

    exercises = _fetch_exercises_public(lesson_id)
    progress_row = fetch_user_progress_row(user_id)

    detail = LessonDetailOut(
        lesson_id=UUID(lesson_row["lesson_id"]),
        unit_id=UUID(lesson_row["unit_id"]),
        order_index=lesson_row["order_index"],
        xp_reward_base=lesson_row["xp_reward_base"],
        hearts_remaining=progress_row["hearts_remaining"],
        exercises=exercises,
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

    expected_answer = exercise_row["expected_answer"]
    is_correct = payload.user_answer.strip().lower() == expected_answer.strip().lower()

    _record_attempt_log(user_id, exercise_row["topic"], is_correct)

    progress_row = fetch_user_progress_row(user_id)

    if is_correct:
        lesson_result = (
            get_service_client()
            .table("lesson")
            .select("xp_reward_base")
            .eq("lesson_id", str(lesson_id))
            .limit(1)
            .execute()
        )
        xp_reward_base = lesson_result.data[0]["xp_reward_base"] if lesson_result.data else 0
        exercises_count_result = (
            get_service_client()
            .table("exercise")
            .select("exercise_id")
            .eq("lesson_id", str(lesson_id))
            .execute()
        )
        xp_earned = _calculate_xp_per_exercise(xp_reward_base, len(exercises_count_result.data))
        add_xp(user_id, xp_earned)
        hearts_remaining = progress_row["hearts_remaining"]
    else:
        xp_earned = 0
        hearts_remaining = apply_heart_loss(user_id)
        _add_to_review_queue(user_id, payload.exercise_id)
        if hearts_remaining == 5 and progress_row["hearts_remaining"] == 0:
            pass

    result = AttemptResultOut(
        correct=is_correct,
        xp_earned=xp_earned,
        hearts_remaining=hearts_remaining,
        feedback=None,
        grammar_note=None,
    )
    return success_response(result)


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
        check_translate_attempt_rate_limit(str(user_id))
    except RateLimitExceeded as exc:
        return error_response(exc.message)

    feedback_result = generate_translate_feedback(
        user_answer=payload.user_answer,
        expected_answer=exercise_row["expected_answer"],
        question_text=exercise_row["question"],
    )
    is_correct = feedback_result.is_meaning_correct

    _record_attempt_log(user_id, exercise_row["topic"], is_correct)

    progress_row = fetch_user_progress_row(user_id)

    if is_correct:
        lesson_result = (
            get_service_client()
            .table("lesson")
            .select("xp_reward_base")
            .eq("lesson_id", str(lesson_id))
            .limit(1)
            .execute()
        )
        xp_reward_base = lesson_result.data[0]["xp_reward_base"] if lesson_result.data else 0
        exercises_count_result = (
            get_service_client()
            .table("exercise")
            .select("exercise_id")
            .eq("lesson_id", str(lesson_id))
            .execute()
        )
        xp_earned = _calculate_xp_per_exercise(xp_reward_base, len(exercises_count_result.data))
        add_xp(user_id, xp_earned)
        hearts_remaining = progress_row["hearts_remaining"]
    else:
        xp_earned = 0
        hearts_remaining = apply_heart_loss(user_id)
        _add_to_review_queue(user_id, payload.exercise_id)

    result = AttemptResultOut(
        correct=is_correct,
        xp_earned=xp_earned,
        hearts_remaining=hearts_remaining,
        feedback=feedback_result.feedback,
        grammar_note=feedback_result.grammar_note,
    )
    return success_response(result)


@router.post("/lessons/{lesson_id}/complete", response_model=ApiResponse)
def complete_lesson(lesson_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    client = get_service_client()
    lesson_result = (
        client.table("lesson")
        .select("lesson_id, unit_id")
        .eq("lesson_id", str(lesson_id))
        .limit(1)
        .execute()
    )
    if not lesson_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=LESSON_TIDAK_DITEMUKAN)

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

    progress_row = fetch_user_progress_row(user_id)

    next_lesson_result = (
        client.table("lesson")
        .select("lesson_id")
        .eq("unit_id", lesson_result.data[0]["unit_id"])
        .order("order_index")
        .execute()
    )
    update_current_lesson(
        user_id,
        UUID(next_lesson_result.data[0]["lesson_id"]) if next_lesson_result.data else None,
    )

    reset_hearts(user_id)
    badge_earned = check_and_award_badges(user_id)

    result = LessonCompleteResultOut(
        xp_earned_total=progress_row["total_xp"],
        hearts_remaining=5,
        badge_earned=badge_earned,
    )
    return success_response(result)
