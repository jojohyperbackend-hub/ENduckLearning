from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import ApiResponse, AttemptResultOut, ExercisePublicOut, ReviewAttemptRequest, ReviewQueueItemOut
from app.services.ai_service import AiGenerationRejected, XP_PER_CORRECT_ANSWER_AI_QUIZ, generate_translate_feedback
from app.utils.cache import RateLimitExceeded
from app.utils.helpers import error_response, success_response

router = APIRouter(prefix="/review", tags=["Review"])

XP_PER_CORRECT_REVIEW_ANSWER = XP_PER_CORRECT_ANSWER_AI_QUIZ


@router.get("/queue", response_model=ApiResponse)
def get_review_queue(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    service_client = get_service_client()
    result = (
        service_client.table("review_queue")
        .select("review_id, added_at, exercise_id, ai_exercise_id")
        .eq("user_id", str(user_id))
        .order("added_at", desc=True)
        .execute()
    )
    rows = result.data or []

    exercise_ids = [row["exercise_id"] for row in rows if row.get("exercise_id")]
    ai_exercise_ids = [row["ai_exercise_id"] for row in rows if row.get("ai_exercise_id")]

    exercise_map = {}
    if exercise_ids:
        exercise_result = (
            service_client.table("exercise")
            .select("exercise_id, type, topic, question, options")
            .in_("exercise_id", exercise_ids)
            .execute()
        )
        exercise_map = {item["exercise_id"]: item for item in (exercise_result.data or [])}

    ai_exercise_map = {}
    if ai_exercise_ids:
        ai_exercise_result = (
            service_client.table("ai_generated_exercise")
            .select("ai_exercise_id, type, question, options")
            .in_("ai_exercise_id", ai_exercise_ids)
            .execute()
        )
        ai_exercise_map = {item["ai_exercise_id"]: item for item in (ai_exercise_result.data or [])}

    queue_out: List[ReviewQueueItemOut] = []
    for row in rows:
        exercise_out = None
        if row.get("exercise_id") and row["exercise_id"] in exercise_map:
            source_row = exercise_map[row["exercise_id"]]
            exercise_out = ExercisePublicOut(
                exercise_id=source_row["exercise_id"],
                type=source_row["type"],
                topic=source_row["topic"],
                question=source_row["question"],
                options=source_row.get("options"),
            )
        elif row.get("ai_exercise_id") and row["ai_exercise_id"] in ai_exercise_map:
            source_row = ai_exercise_map[row["ai_exercise_id"]]
            exercise_out = ExercisePublicOut(
                exercise_id=source_row["ai_exercise_id"],
                type=source_row["type"],
                topic="",
                question=source_row["question"],
                options=source_row.get("options"),
            )
        else:
            continue

        queue_out.append(
            ReviewQueueItemOut(review_id=row["review_id"], exercise=exercise_out, added_at=row["added_at"])
        )

    return success_response(queue_out)


def _fetch_review_item(user_id: UUID, review_id: UUID) -> dict:
    service_client = get_service_client()
    result = (
        service_client.table("review_queue")
        .select("review_id, user_id, exercise_id, ai_exercise_id")
        .eq("review_id", str(review_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Sesi review gak ketemu di antrean kamu.")
    return rows[0]


@router.post("/attempt", response_model=ApiResponse)
async def post_review_attempt(payload: ReviewAttemptRequest, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    review_item = _fetch_review_item(user_id, payload.review_id)
    service_client = get_service_client()

    feedback_text = None
    grammar_note_text = None
    quiz_id_for_attempt = None

    if review_item.get("exercise_id"):
        exercise_result = (
            service_client.table("exercise").select("*").eq("exercise_id", review_item["exercise_id"]).execute()
        )
        exercise_rows = exercise_result.data or []
        if not exercise_rows:
            return error_response("Soal asli buat review ini udah gak ada.")
        exercise = exercise_rows[0]
        source_type = "lesson"
        exercise_id_for_attempt = exercise["exercise_id"]

        if exercise["type"] == "translate":
            try:
                feedback_result = await generate_translate_feedback(
                    user_id, exercise["question"], exercise["expected_answer"], payload.user_answer
                )
            except AiGenerationRejected as exc:
                return error_response(str(exc))
            except RateLimitExceeded as exc:
                return JSONResponse(status_code=429, content=error_response(exc.message).model_dump())
            correct = feedback_result.is_meaning_correct
            feedback_text = feedback_result.feedback
            grammar_note_text = feedback_result.grammar_note
        else:
            correct = payload.user_answer.strip().lower() == str(exercise["expected_answer"]).strip().lower()

    elif review_item.get("ai_exercise_id"):
        ai_exercise_result = (
            service_client.table("ai_generated_exercise")
            .select("*")
            .eq("ai_exercise_id", review_item["ai_exercise_id"])
            .execute()
        )
        ai_exercise_rows = ai_exercise_result.data or []
        if not ai_exercise_rows:
            return error_response("Soal AI buat review ini udah gak ada.")
        ai_exercise = ai_exercise_rows[0]
        source_type = "ai_quiz"
        exercise_id_for_attempt = ai_exercise["ai_exercise_id"]
        quiz_id_for_attempt = ai_exercise["quiz_id"]

        if ai_exercise["type"] == "translate":
            try:
                feedback_result = await generate_translate_feedback(
                    user_id, ai_exercise["question"], ai_exercise["expected_answer"], payload.user_answer
                )
            except AiGenerationRejected as exc:
                return error_response(str(exc))
            except RateLimitExceeded as exc:
                return JSONResponse(status_code=429, content=error_response(exc.message).model_dump())
            correct = feedback_result.is_meaning_correct
            feedback_text = feedback_result.feedback
            grammar_note_text = feedback_result.grammar_note
        else:
            correct = payload.user_answer.strip().lower() == str(ai_exercise["expected_answer"]).strip().lower()
    else:
        return error_response("Data review ini rusak, gak ada soal yang terhubung.")

    xp_earned = XP_PER_CORRECT_REVIEW_ANSWER if correct else 0

    service_client.table("exercise_attempt").insert(
        {
            "user_id": str(user_id),
            "exercise_id": str(exercise_id_for_attempt),
            "source_type": source_type,
            "quiz_id": str(quiz_id_for_attempt) if quiz_id_for_attempt else None,
            "user_answer": payload.user_answer,
            "correct": correct,
            "xp_earned": xp_earned,
            "feedback": feedback_text,
            "grammar_note": grammar_note_text,
        }
    ).execute()

    progress_result = service_client.table("user_progress").select("total_xp, hearts_remaining").eq(
        "user_id", str(user_id)
    ).execute()
    progress_rows = progress_result.data or []
    hearts_remaining = progress_rows[0]["hearts_remaining"] if progress_rows else 0

    if correct:
        if progress_rows:
            new_total_xp = progress_rows[0]["total_xp"] + xp_earned
            service_client.table("user_progress").update({"total_xp": new_total_xp}).eq(
                "user_id", str(user_id)
            ).execute()
        service_client.table("review_queue").delete().eq("review_id", str(payload.review_id)).execute()

    return success_response(
        AttemptResultOut(
            correct=correct,
            xp_earned=xp_earned,
            hearts_remaining=hearts_remaining,
            feedback=feedback_text,
            grammar_note=grammar_note_text,
        )
    )