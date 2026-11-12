import threading
from typing import Any, Dict, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import (
    ApiResponse,
    QuizAttemptRequest,
    QuizCompleteResultOut,
    QuizFormOptionsOut,
    QuizFormRequest,
    QuizQuestionItemOut,
    QuizResultOut,
)
from app.services.ai_service import XP_PER_CORRECT_ANSWER_AI_QUIZ, generate_practice, generate_translate_feedback
from app.services.milestone_service import check_and_award_badges
from app.services.progress_service import add_xp, apply_heart_loss, fetch_user_progress_row
from app.utils.cache import RateLimitExceeded, check_practice_generate_rate_limit, check_translate_attempt_rate_limit
from app.utils.helpers import error_response, success_response, utcnow

router = APIRouter(prefix="/ai", tags=["ai"])

QUIZ_TIDAK_DITEMUKAN = "Quiz tidak ditemukan atau sudah kedaluwarsa"
QUESTION_TIDAK_DITEMUKAN = "Soal tidak ditemukan dalam quiz ini"

_active_quizzes: Dict[str, Dict[str, Any]] = {}
_active_quizzes_lock = threading.Lock()


@router.get("/quiz/form-options", response_model=ApiResponse)
def get_quiz_form_options(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    client = get_service_client()
    result = client.table("exercise").select("topic").execute()
    available_topics = sorted({row["topic"] for row in result.data})

    options = QuizFormOptionsOut(available_topics=available_topics)
    return success_response(options)


@router.post("/practice/generate", response_model=ApiResponse)
def generate_practice_quiz(
    payload: QuizFormRequest, user_id: UUID = Depends(get_current_user_id)
) -> ApiResponse:
    try:
        check_practice_generate_rate_limit(str(user_id))
    except RateLimitExceeded as exc:
        return error_response(exc.message)

    questions_data, status_value = generate_practice(
        user_id=user_id,
        jumlah_soal=payload.jumlah_soal,
        tipe_soal=payload.tipe_soal,
        fokus_topik=payload.fokus_topik,
        tingkat_kesulitan=payload.tingkat_kesulitan,
    )

    if not questions_data:
        return error_response("Tidak ada soal yang bisa dibuat saat ini, coba lagi nanti")

    quiz_id = uuid4()
    quiz_questions: List[QuizQuestionItemOut] = []
    internal_questions: List[Dict[str, Any]] = []

    for question_data in questions_data:
        question_id = uuid4()
        internal_questions.append(
            {
                "question_id": str(question_id),
                "exercise_id": question_data.get("exercise_id"),
                "type": question_data["type"],
                "topic": question_data["topic"],
                "question": question_data["question"],
                "options": question_data.get("options"),
                "expected_answer": question_data["expected_answer"],
                "source": question_data["source"],
            }
        )
        quiz_questions.append(
            QuizQuestionItemOut(
                question_id=question_id,
                type=question_data["type"],
                question_text=question_data["question"],
                options=question_data.get("options"),
                source=question_data["source"],
            )
        )

    generated_at = utcnow()
    with _active_quizzes_lock:
        _active_quizzes[str(quiz_id)] = {
            "user_id": str(user_id),
            "questions": internal_questions,
            "attempts": {},
            "generated_at": generated_at,
        }

    result = QuizResultOut(
        quiz_id=quiz_id,
        status=status_value,
        total_soal=len(quiz_questions),
        estimasi_xp=len(quiz_questions) * XP_PER_CORRECT_ANSWER_AI_QUIZ,
        generated_at=generated_at,
        questions=quiz_questions,
    )
    return success_response(result)


@router.post("/quiz/{quiz_id}/attempt", response_model=ApiResponse)
def attempt_quiz_question(
    quiz_id: UUID, payload: QuizAttemptRequest, user_id: UUID = Depends(get_current_user_id)
) -> ApiResponse:
    with _active_quizzes_lock:
        quiz_state = _active_quizzes.get(str(quiz_id))

    if quiz_state is None or quiz_state["user_id"] != str(user_id):
        return error_response(QUIZ_TIDAK_DITEMUKAN)

    question_row = next(
        (q for q in quiz_state["questions"] if q["question_id"] == str(payload.question_id)),
        None,
    )
    if question_row is None:
        return error_response(QUESTION_TIDAK_DITEMUKAN)

    if question_row["type"] == "translate":
        try:
            check_translate_attempt_rate_limit(str(user_id))
        except RateLimitExceeded as exc:
            return error_response(exc.message)

        feedback_result = generate_translate_feedback(
            user_answer=payload.user_answer,
            expected_answer=question_row["expected_answer"],
            question_text=question_row["question"],
        )
        is_correct = feedback_result.is_meaning_correct
    else:
        is_correct = payload.user_answer.strip().lower() == question_row["expected_answer"].strip().lower()

    progress_row = fetch_user_progress_row(user_id)

    if is_correct:
        xp_earned = XP_PER_CORRECT_ANSWER_AI_QUIZ
        add_xp(user_id, xp_earned)
        hearts_remaining = progress_row["hearts_remaining"]
    else:
        xp_earned = 0
        hearts_remaining = apply_heart_loss(user_id)

    with _active_quizzes_lock:
        quiz_state["attempts"][str(payload.question_id)] = {
            "is_correct": is_correct,
            "xp_earned": xp_earned,
        }

    from app.models.schemas import AttemptResultOut

    result = AttemptResultOut(
        correct=is_correct,
        xp_earned=xp_earned,
        hearts_remaining=hearts_remaining,
        feedback=None,
        grammar_note=None,
    )
    return success_response(result)


@router.post("/quiz/{quiz_id}/complete", response_model=ApiResponse)
def complete_quiz(quiz_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    with _active_quizzes_lock:
        quiz_state = _active_quizzes.get(str(quiz_id))

    if quiz_state is None or quiz_state["user_id"] != str(user_id):
        return error_response(QUIZ_TIDAK_DITEMUKAN)

    total_soal = len(quiz_state["questions"])
    jumlah_benar = sum(1 for a in quiz_state["attempts"].values() if a["is_correct"])
    jumlah_salah = len(quiz_state["attempts"]) - jumlah_benar
    total_xp_earned = sum(a["xp_earned"] for a in quiz_state["attempts"].values())
    akurasi = int((jumlah_benar / total_soal) * 100) if total_soal > 0 else 0

    progress_row = fetch_user_progress_row(user_id)
    badge_earned = check_and_award_badges(user_id)

    with _active_quizzes_lock:
        _active_quizzes.pop(str(quiz_id), None)

    result = QuizCompleteResultOut(
        quiz_id=quiz_id,
        total_soal=total_soal,
        jumlah_benar=jumlah_benar,
        jumlah_salah=jumlah_salah,
        akurasi=akurasi,
        total_xp_earned=total_xp_earned,
        hearts_remaining=progress_row["hearts_remaining"],
        badge_earned=badge_earned,
    )
    return success_response(result)
