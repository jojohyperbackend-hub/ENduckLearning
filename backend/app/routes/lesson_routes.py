from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import (
    ApiResponse,
    AttemptResultOut,
    AttemptStandardRequest,
    AttemptTranslateRequest,
    BadgeOut,
    ExercisePublicOut,
    LessonCompleteResultOut,
    LessonDetailOut,
)
from app.services.ai_service import AiGenerationRejected, generate_translate_feedback
from app.utils.cache import RateLimitExceeded
from app.utils.helpers import error_response, success_response

router = APIRouter(prefix="/lessons", tags=["Lessons"])

HEARTS_MIN = 0
HEARTS_MAX = 5


def _get_user_progress(user_id: UUID) -> dict:
    service_client = get_service_client()
    result = service_client.table("user_progress").select("*").eq("user_id", str(user_id)).execute()
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Progress kamu belum ketemu, coba login ulang ya.")
    return rows[0]


def _fetch_lesson(lesson_id: UUID) -> dict:
    service_client = get_service_client()
    result = service_client.table("lesson").select("*").eq("lesson_id", str(lesson_id)).execute()
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Lesson gak ketemu.")
    return rows[0]


def _is_lesson_locked(user_id: UUID, lesson: dict) -> bool:
    service_client = get_service_client()
    unit_result = service_client.table("unit").select("course_id, order_index").eq("unit_id", lesson["unit_id"]).execute()
    unit_rows = unit_result.data or []
    if not unit_rows:
        return True
    course_id = unit_rows[0]["course_id"]

    units_result = (
        service_client.table("unit")
        .select("unit_id, order_index, lesson(lesson_id, order_index)")
        .eq("course_id", course_id)
        .order("order_index")
        .execute()
    )
    units = units_result.data or []
    flattened_lesson_ids = []
    for unit in units:
        for item in sorted(unit.get("lesson") or [], key=lambda row: row["order_index"]):
            flattened_lesson_ids.append(item["lesson_id"])

    progress = _get_user_progress(user_id)
    current_lesson_id = progress.get("current_lesson_id")

    target_lesson_id = str(lesson["lesson_id"])
    if target_lesson_id not in flattened_lesson_ids:
        return True

    target_position = flattened_lesson_ids.index(target_lesson_id)
    if current_lesson_id is None or current_lesson_id not in flattened_lesson_ids:
        return target_position > 0
    current_position = flattened_lesson_ids.index(current_lesson_id)
    return target_position > current_position


def _fetch_exercises_public(lesson_id: UUID):
    service_client = get_service_client()
    result = (
        service_client.table("exercise")
        .select("exercise_id, type, topic, question, options")
        .eq("lesson_id", str(lesson_id))
        .execute()
    )
    return [ExercisePublicOut(**row) for row in (result.data or [])]


def _fetch_exercise_with_answer(exercise_id: UUID) -> dict:
    service_client = get_service_client()
    result = service_client.table("exercise").select("*").eq("exercise_id", str(exercise_id)).execute()
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Soal gak ketemu.")
    return rows[0]


def _calculate_xp_per_exercise(lesson: dict) -> int:
    service_client = get_service_client()
    count_result = service_client.table("exercise").select("exercise_id").eq("lesson_id", lesson["lesson_id"]).execute()
    total_exercises = len(count_result.data or [])
    if total_exercises == 0:
        return 0
    return lesson["xp_reward_base"] // total_exercises


def _update_hearts(user_id: UUID, new_hearts: int) -> None:
    get_service_client().table("user_progress").update({"hearts_remaining": new_hearts}).eq(
        "user_id", str(user_id)
    ).execute()


def _add_xp(user_id: UUID, amount: int) -> None:
    if amount <= 0:
        return
    progress = _get_user_progress(user_id)
    new_total = progress["total_xp"] + amount
    get_service_client().table("user_progress").update({"total_xp": new_total}).eq("user_id", str(user_id)).execute()


def _record_attempt(
    user_id: UUID,
    exercise_id: UUID,
    user_answer: str,
    correct: bool,
    xp_earned: int,
    feedback: str = None,
    grammar_note: str = None,
) -> None:
    get_service_client().table("exercise_attempt").insert(
        {
            "user_id": str(user_id),
            "exercise_id": str(exercise_id),
            "source_type": "lesson",
            "quiz_id": None,
            "user_answer": user_answer,
            "correct": correct,
            "xp_earned": xp_earned,
            "feedback": feedback,
            "grammar_note": grammar_note,
        }
    ).execute()


def _add_to_review_queue(user_id: UUID, exercise_id: UUID) -> None:
    get_service_client().table("review_queue").insert(
        {"user_id": str(user_id), "exercise_id": str(exercise_id)}
    ).execute()


@router.get("/{lesson_id}", response_model=ApiResponse)
def get_lesson_detail(lesson_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    lesson = _fetch_lesson(lesson_id)

    if _is_lesson_locked(user_id, lesson):
        raise HTTPException(status_code=403, detail="Lesson ini masih terkunci, selesaikan lesson sebelumnya dulu ya.")

    progress = _get_user_progress(user_id)
    exercises = _fetch_exercises_public(lesson_id)

    return success_response(
        LessonDetailOut(
            lesson_id=lesson["lesson_id"],
            unit_id=lesson["unit_id"],
            order_index=lesson["order_index"],
            xp_reward_base=lesson["xp_reward_base"],
            hearts_remaining=progress["hearts_remaining"],
            exercises=exercises,
        )
    )


@router.post("/{lesson_id}/attempt/standard", response_model=ApiResponse)
def post_attempt_standard(
    lesson_id: UUID, payload: AttemptStandardRequest, user_id: UUID = Depends(get_current_user_id)
) -> ApiResponse:
    lesson = _fetch_lesson(lesson_id)
    exercise = _fetch_exercise_with_answer(payload.exercise_id)

    if str(exercise["lesson_id"]) != str(lesson_id):
        return error_response("Soal ini bukan bagian dari lesson ini.")

    correct = payload.user_answer.strip().lower() == str(exercise["expected_answer"]).strip().lower()
    progress = _get_user_progress(user_id)
    hearts_remaining = progress["hearts_remaining"]
    xp_earned = 0

    if correct:
        xp_earned = _calculate_xp_per_exercise(lesson)
        _add_xp(user_id, xp_earned)
    else:
        hearts_remaining = hearts_remaining - 1
        hearts_remaining = HEARTS_MAX if hearts_remaining <= HEARTS_MIN else hearts_remaining
        _update_hearts(user_id, hearts_remaining)
        _add_to_review_queue(user_id, payload.exercise_id)

    _record_attempt(user_id, payload.exercise_id, payload.user_answer, correct, xp_earned)

    return success_response(
        AttemptResultOut(correct=correct, xp_earned=xp_earned, hearts_remaining=hearts_remaining)
    )


@router.post("/{lesson_id}/attempt/translate", response_model=ApiResponse)
async def post_attempt_translate(
    lesson_id: UUID, payload: AttemptTranslateRequest, user_id: UUID = Depends(get_current_user_id)
) -> ApiResponse:
    lesson = _fetch_lesson(lesson_id)
    exercise = _fetch_exercise_with_answer(payload.exercise_id)

    if str(exercise["lesson_id"]) != str(lesson_id):
        return error_response("Soal ini bukan bagian dari lesson ini.")

    try:
        feedback_result = await generate_translate_feedback(
            user_id, exercise["question"], exercise["expected_answer"], payload.user_answer
        )
    except AiGenerationRejected as exc:
        return error_response(str(exc))
    except RateLimitExceeded as exc:
        return JSONResponse(status_code=429, content=error_response(exc.message).model_dump())

    correct = feedback_result.is_meaning_correct
    progress = _get_user_progress(user_id)
    hearts_remaining = progress["hearts_remaining"]
    xp_earned = 0

    if correct:
        xp_earned = _calculate_xp_per_exercise(lesson)
        _add_xp(user_id, xp_earned)
    else:
        hearts_remaining = hearts_remaining - 1
        hearts_remaining = HEARTS_MAX if hearts_remaining <= HEARTS_MIN else hearts_remaining
        _update_hearts(user_id, hearts_remaining)
        _add_to_review_queue(user_id, payload.exercise_id)

    _record_attempt(
        user_id,
        payload.exercise_id,
        payload.user_answer,
        correct,
        xp_earned,
        feedback_result.feedback,
        feedback_result.grammar_note,
    )

    return success_response(
        AttemptResultOut(
            correct=correct,
            xp_earned=xp_earned,
            hearts_remaining=hearts_remaining,
            feedback=feedback_result.feedback,
            grammar_note=feedback_result.grammar_note,
        )
    )


@router.post("/{lesson_id}/complete", response_model=ApiResponse)
def post_lesson_complete(lesson_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    lesson = _fetch_lesson(lesson_id)
    progress = _get_user_progress(user_id)

    service_client = get_service_client()
    service_client.table("user_progress").update(
        {"current_lesson_id": str(lesson_id), "hearts_remaining": HEARTS_MAX}
    ).eq("user_id", str(user_id)).execute()

    attempts_result = (
        service_client.table("exercise_attempt")
        .select("xp_earned")
        .eq("user_id", str(user_id))
        .eq("source_type", "lesson")
        .execute()
    )
    xp_earned_total = sum(row["xp_earned"] for row in (attempts_result.data or []))

    badge_earned = None
    try:
        from app.services.milestone_service import check_and_award_badges

        badge_earned = check_and_award_badges(user_id)
    except ImportError:
        badge_earned = None

    return success_response(
        LessonCompleteResultOut(
            xp_earned_total=xp_earned_total,
            hearts_remaining=HEARTS_MAX,
            badge_earned=badge_earned,
        )
    )
