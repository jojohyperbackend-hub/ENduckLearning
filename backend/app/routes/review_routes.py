from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import (
    ApiResponse,
    AttemptResultOut,
    ExercisePublicOut,
    ReviewAttemptRequest,
    ReviewQueueItemOut,
)
from app.services.grading_service import grade_short_answer, grade_translation
from app.services.progress_service import (
    HEARTS_EMPTY_CODE,
    HeartsEmptyError,
    add_xp,
    apply_heart_loss,
    fetch_user_progress_row,
    heart_fields,
    require_hearts,
)
from app.utils.cache import RateLimitExceeded, check_translate_attempt_rate_limit
from app.utils.helpers import error_response, success_response

router = APIRouter(prefix="/review", tags=["review"])

REVIEW_ITEM_TIDAK_DITEMUKAN = "Item review tidak ditemukan atau bukan milik Anda"
XP_PER_REVIEW_CORRECT = 5


@router.get("/queue", response_model=ApiResponse)
def get_review_queue(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    client = get_service_client()
    result = (
        client.table("review_queue")
        .select("review_id, exercise_id, ai_exercise_id, added_at")
        .eq("user_id", str(user_id))
        .order("added_at")
        .execute()
    )

    exercise_ids = [row["exercise_id"] for row in result.data if row.get("exercise_id")]
    exercises_by_id: Dict[str, Dict[str, Any]] = {}
    if exercise_ids:
        exercises_result = (
            client.table("exercise")
            .select("exercise_id, type, topic, question, options")
            .in_("exercise_id", exercise_ids)
            .execute()
        )
        exercises_by_id = {row["exercise_id"]: row for row in exercises_result.data}

    items: List[ReviewQueueItemOut] = []
    for row in result.data:
        exercise_out: Optional[ExercisePublicOut] = None
        if row.get("exercise_id") and row["exercise_id"] in exercises_by_id:
            exercise_data = exercises_by_id[row["exercise_id"]]
            exercise_out = ExercisePublicOut(
                exercise_id=UUID(exercise_data["exercise_id"]),
                type=exercise_data["type"],
                topic=exercise_data["topic"],
                question=exercise_data["question"],
                options=exercise_data.get("options"),
            )

        items.append(
            ReviewQueueItemOut(
                review_id=UUID(row["review_id"]),
                exercise=exercise_out,
                added_at=row["added_at"],
            )
        )

    return success_response(items)


@router.post("/attempt", response_model=ApiResponse)
def attempt_review(
    payload: ReviewAttemptRequest, user_id: UUID = Depends(get_current_user_id)
) -> ApiResponse:
    client = get_service_client()
    review_result = (
        client.table("review_queue")
        .select("review_id, exercise_id, ai_exercise_id")
        .eq("review_id", str(payload.review_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    if not review_result.data:
        return error_response(REVIEW_ITEM_TIDAK_DITEMUKAN)
    review_row = review_result.data[0]

    source_table = "exercise" if review_row.get("exercise_id") else "ai_exercise"
    source_id = review_row.get("exercise_id") or review_row.get("ai_exercise_id")
    if source_id is None:
        return error_response(REVIEW_ITEM_TIDAK_DITEMUKAN)

    exercise_result = (
        client.table(source_table)
        .select("type, topic, question, expected_answer")
        .eq(f"{source_table}_id", source_id)
        .limit(1)
        .execute()
    )
    if not exercise_result.data:
        return error_response(REVIEW_ITEM_TIDAK_DITEMUKAN)
    exercise_row = exercise_result.data[0]

    # Titik C: heart dicek di database sebelum jawaban diproses.
    try:
        require_hearts(user_id)
    except HeartsEmptyError:
        return error_response(HEARTS_EMPTY_CODE)

    if exercise_row["type"] == "translate":
        try:
            check_translate_attempt_rate_limit(str(user_id))
        except RateLimitExceeded as exc:
            return error_response(exc.message)

        feedback_result = grade_translation(
            question=exercise_row["question"],
            user_answer=payload.user_answer,
            expected_answer=exercise_row["expected_answer"],
        )
        is_correct = feedback_result.is_meaning_correct
        feedback_text = feedback_result.feedback
        grammar_note = feedback_result.grammar_note
    else:
        is_correct = grade_short_answer(
            exercise_row["type"],
            exercise_row["question"],
            payload.user_answer,
            exercise_row["expected_answer"],
        )
        feedback_text = None
        grammar_note = None

    if is_correct:
        xp_earned = XP_PER_REVIEW_CORRECT
        add_xp(user_id, xp_earned)
        client.table("review_queue").delete().eq("review_id", str(payload.review_id)).execute()
        progress_row = fetch_user_progress_row(user_id)
    else:
        xp_earned = 0
        try:
            progress_row = apply_heart_loss(user_id)
        except HeartsEmptyError:
            return error_response(HEARTS_EMPTY_CODE)

    result = AttemptResultOut(
        correct=is_correct,
        xp_earned=xp_earned,
        feedback=feedback_text,
        grammar_note=grammar_note,
        **heart_fields(progress_row),
    )
    return success_response(result)
