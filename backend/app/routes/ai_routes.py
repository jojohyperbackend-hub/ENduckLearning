from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import (
    ApiResponse,
    AttemptResultOut,
    QuizAttemptRequest,
    QuizCompleteResultOut,
    QuizFormOptionsOut,
    QuizFormRequest,
)
from app.services.ai_service import (
    AiGenerationRejected,
    XP_PER_CORRECT_ANSWER_AI_QUIZ,
    generate_practice,
    generate_translate_feedback,
)
from app.utils.cache import RateLimitExceeded, content_cache, get_or_set_cache
from app.utils.helpers import error_response, success_response

router = APIRouter(prefix="/ai", tags=["ai"])

HEARTS_MIN = 0


def _fetch_available_topics() -> List[str]:
    service_client = get_service_client()
    result = service_client.table("exercise").select("topic").execute()
    topics = sorted({row["topic"] for row in (result.data or [])})
    return topics


def _get_user_progress(user_id: UUID) -> dict:
    service_client = get_service_client()
    result = service_client.table("user_progress").select("*").eq("user_id", str(user_id)).execute()
    rows = result.data or []
    if not rows:
        raise AiGenerationRejected("Progress kamu belum ketemu, coba login ulang ya.")
    return rows[0]


def _update_hearts(user_id: UUID, new_hearts: int) -> None:
    service_client = get_service_client()
    service_client.table("user_progress").update({"hearts_remaining": new_hearts}).eq("user_id", str(user_id)).execute()


@router.get("/quiz/form-options", response_model=ApiResponse)
def get_quiz_form_options() -> ApiResponse:
    available_topics = get_or_set_cache(content_cache, "quiz_form_options_topics", _fetch_available_topics)
    return success_response(QuizFormOptionsOut(available_topics=available_topics))


@router.post("/practice/generate", response_model=ApiResponse)
async def post_practice_generate(form: QuizFormRequest, user_id: UUID = Depends(get_current_user_id)):
    try:
        result = await generate_practice(user_id, form)
    except AiGenerationRejected as exc:
        return error_response(str(exc))
    except RateLimitExceeded as exc:
        return JSONResponse(status_code=429, content=error_response(exc.message).model_dump())
    return success_response(result)


@router.post("/quiz/{quiz_id}/attempt", response_model=ApiResponse)
async def post_quiz_attempt(
    quiz_id: UUID, payload: QuizAttemptRequest, user_id: UUID = Depends(get_current_user_id)
):
    service_client = get_service_client()
    ai_exercise_result = (
        service_client.table("ai_generated_exercise")
        .select("*")
        .eq("ai_exercise_id", str(payload.question_id))
        .eq("quiz_id", str(quiz_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    rows = ai_exercise_result.data or []
    if not rows:
        return error_response("Soal quiz ini gak ketemu atau bukan punya kamu.")
    ai_exercise = rows[0]

    try:
        progress = _get_user_progress(user_id)
    except AiGenerationRejected as exc:
        return error_response(str(exc))
    hearts_remaining = progress["hearts_remaining"]

    feedback_text = None
    grammar_note_text = None

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

    xp_earned = XP_PER_CORRECT_ANSWER_AI_QUIZ if correct else 0
    if not correct:
        hearts_remaining = max(HEARTS_MIN, hearts_remaining - 1)
        _update_hearts(user_id, hearts_remaining)

    service_client.table("exercise_attempt").insert(
        {
            "user_id": str(user_id),
            "exercise_id": str(payload.question_id),
            "source_type": "ai_quiz",
            "quiz_id": str(quiz_id),
            "user_answer": payload.user_answer,
            "correct": correct,
            "xp_earned": xp_earned,
            "feedback": feedback_text,
            "grammar_note": grammar_note_text,
        }
    ).execute()

    if correct and xp_earned > 0:
        new_total_xp = progress["total_xp"] + xp_earned
        service_client.table("user_progress").update({"total_xp": new_total_xp}).eq("user_id", str(user_id)).execute()

    if not correct:
        service_client.table("review_queue").insert(
            {
                "user_id": str(user_id),
                "ai_exercise_id": str(payload.question_id),
            }
        ).execute()

    return success_response(
        AttemptResultOut(
            correct=correct,
            xp_earned=xp_earned,
            hearts_remaining=hearts_remaining,
            feedback=feedback_text,
            grammar_note=grammar_note_text,
        )
    )


@router.post("/quiz/{quiz_id}/complete", response_model=ApiResponse)
def post_quiz_complete(quiz_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    service_client = get_service_client()

    exercises_result = (
        service_client.table("ai_generated_exercise")
        .select("ai_exercise_id")
        .eq("quiz_id", str(quiz_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    total_soal = len(exercises_result.data or [])
    if total_soal == 0:
        return error_response("Quiz ini gak ketemu atau bukan punya kamu.")

    attempts_result = (
        service_client.table("exercise_attempt")
        .select("correct, xp_earned")
        .eq("user_id", str(user_id))
        .eq("quiz_id", str(quiz_id))
        .execute()
    )
    attempts = attempts_result.data or []
    jumlah_benar = sum(1 for row in attempts if row["correct"])
    jumlah_salah = total_soal - jumlah_benar
    akurasi = round((jumlah_benar / total_soal) * 100)
    total_xp_earned = sum(row["xp_earned"] for row in attempts)

    try:
        progress = _get_user_progress(user_id)
    except AiGenerationRejected as exc:
        return error_response(str(exc))
    hearts_remaining = progress["hearts_remaining"]

    badge_earned = None
    try:
        from app.services.milestone_service import check_and_award_badges

        badge_earned = check_and_award_badges(user_id)
    except ImportError:
        badge_earned = None

    return success_response(
        QuizCompleteResultOut(
            quiz_id=quiz_id,
            total_soal=total_soal,
            jumlah_benar=jumlah_benar,
            jumlah_salah=jumlah_salah,
            akurasi=akurasi,
            total_xp_earned=total_xp_earned,
            hearts_remaining=hearts_remaining,
            badge_earned=badge_earned,
        )
    )