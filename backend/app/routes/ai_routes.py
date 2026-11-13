import threading
from typing import Any, Dict, List, Set
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends

from app.auth.middleware import get_current_user_id
from app.models.schemas import (
    ApiResponse,
    AttemptResultOut,
    QuizAttemptRequest,
    QuizCompleteResultOut,
    QuizFormOptionsOut,
    QuizFormRequest,
    QuizQuestionItemOut,
    QuizResultOut,
)
from app.routes.lesson_routes import record_attempt_log
from app.services.ai_service import (
    XP_PER_CORRECT_ANSWER_AI_QUIZ,
    eligible_auto_topics,
    fetch_topic_statistics,
    generate_practice,
    generate_translate_feedback,
)
from app.services.milestone_service import check_and_award_badges
from app.services.progress_service import (
    HEARTS_EMPTY_CODE,
    HeartsEmptyError,
    add_xp,
    apply_heart_loss,
    fetch_user_progress_row,
    heart_fields,
    require_hearts,
)
from app.services.unlock_service import GATE1_MESSAGE, get_unlocked_topics, has_completed_any_lesson
from app.utils.cache import (
    RateLimitExceeded,
    check_translate_attempt_rate_limit,
    ensure_practice_generate_allowed,
    record_practice_generate,
)
from app.utils.helpers import error_response, success_response, utcnow

router = APIRouter(prefix="/ai", tags=["ai"])

QUIZ_TIDAK_DITEMUKAN = "Quiz tidak ditemukan atau sudah kedaluwarsa"
QUESTION_TIDAK_DITEMUKAN = "Soal tidak ditemukan dalam quiz ini"
QUESTION_SUDAH_DIJAWAB = "Soal ini sudah kamu jawab"
PROSES_MASIH_JALAN = "Soal latihan kamu masih diproses, tunggu sebentar"
RIWAYAT_BELUM_CUKUP = (
    "Riwayat latihan kamu belum cukup buat topik mana pun. "
    "Jawab minimal 3 soal di satu topik dulu, atau pilih topik sendiri."
)
TOPIK_BELUM_TERBUKA = "Topik ini belum terbuka. Pilih topik dari unit yang sudah kamu buka."
GENERATE_GAGAL = "Tidak ada soal yang bisa dibuat saat ini, coba lagi nanti"

_active_quizzes: Dict[str, Dict[str, Any]] = {}
_active_quizzes_lock = threading.Lock()

# Kondisi 6: satu user cuma boleh punya 1 proses generate yang jalan.
_generating_users: Set[str] = set()
_generating_users_lock = threading.Lock()


def _begin_generate(user_key: str) -> bool:
    with _generating_users_lock:
        if user_key in _generating_users:
            return False
        _generating_users.add(user_key)
        return True


def _end_generate(user_key: str) -> None:
    with _generating_users_lock:
        _generating_users.discard(user_key)


@router.get("/quiz/form-options", response_model=ApiResponse)
def get_quiz_form_options(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    """Dipanggil pas tombol Latihan AI diklik (Gerbang 1 + Titik A heart)."""
    progress_row = fetch_user_progress_row(user_id)
    gate1_passed = has_completed_any_lesson(user_id)

    options = QuizFormOptionsOut(
        gate1_passed=gate1_passed,
        gate1_message=None if gate1_passed else GATE1_MESSAGE,
        available_topics=get_unlocked_topics(user_id) if gate1_passed else [],
        **heart_fields(progress_row),
    )
    return success_response(options)


@router.post("/practice/generate", response_model=ApiResponse)
def generate_practice_quiz(
    payload: QuizFormRequest, user_id: UUID = Depends(get_current_user_id)
) -> ApiResponse:
    user_key = str(user_id)

    # Gerbang 1 tetap dijaga di API, walau form harusnya gak kebuka kalau belum lolos.
    if not has_completed_any_lesson(user_id):
        return error_response(GATE1_MESSAGE)

    # Urutan cek submit: proses lain jalan -> rate limit -> heart kosong -> kecukupan topik.
    if not _begin_generate(user_key):
        return error_response(PROSES_MASIH_JALAN)

    try:
        try:
            ensure_practice_generate_allowed(user_key)
        except RateLimitExceeded as exc:
            return error_response(exc.message)

        try:
            require_hearts(user_id)
        except HeartsEmptyError:
            return error_response(HEARTS_EMPTY_CODE)

        topic_statistics = fetch_topic_statistics(user_id)
        if payload.fokus_topik == "auto":
            topic_scores, jumlah_data_per_topic, _ = topic_statistics
            if not eligible_auto_topics(topic_scores, jumlah_data_per_topic):
                return error_response(RIWAYAT_BELUM_CUKUP)
        elif payload.fokus_topik not in get_unlocked_topics(user_id):
            return error_response(TOPIK_BELUM_TERBUKA)

        try:
            record_practice_generate(user_key)
        except RateLimitExceeded as exc:
            return error_response(exc.message)

        questions_data, status_value = generate_practice(
            user_id=user_id,
            jumlah_soal=payload.jumlah_soal,
            tipe_soal=payload.tipe_soal,
            fokus_topik=payload.fokus_topik,
            tingkat_kesulitan=payload.tingkat_kesulitan,
            topic_statistics=topic_statistics,
        )
    finally:
        _end_generate(user_key)

    if not questions_data:
        return error_response(GENERATE_GAGAL)

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
                topic=question_data["topic"],
                question_text=question_data["question"],
                options=question_data.get("options"),
                source=question_data["source"],
            )
        )

    generated_at = utcnow()
    with _active_quizzes_lock:
        _active_quizzes[str(quiz_id)] = {
            "user_id": user_key,
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

    with _active_quizzes_lock:
        already_answered = str(payload.question_id) in quiz_state["attempts"]
    if already_answered:
        return error_response(QUESTION_SUDAH_DIJAWAB)

    # Titik C: heart dicek di database sebelum jawaban diproses.
    try:
        require_hearts(user_id)
    except HeartsEmptyError:
        return error_response(HEARTS_EMPTY_CODE)

    feedback_text = None
    grammar_note = None
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
        feedback_text = feedback_result.feedback
        grammar_note = feedback_result.grammar_note
    else:
        is_correct = (
            payload.user_answer.strip().lower() == question_row["expected_answer"].strip().lower()
        )

    record_attempt_log(user_id, question_row["topic"], is_correct)

    if is_correct:
        xp_earned = XP_PER_CORRECT_ANSWER_AI_QUIZ
        add_xp(user_id, xp_earned)
        progress_row = fetch_user_progress_row(user_id)
    else:
        xp_earned = 0
        try:
            progress_row = apply_heart_loss(user_id)
        except HeartsEmptyError:
            return error_response(HEARTS_EMPTY_CODE)

    with _active_quizzes_lock:
        quiz_state["attempts"][str(payload.question_id)] = {
            "is_correct": is_correct,
            "xp_earned": xp_earned,
        }

    result = AttemptResultOut(
        correct=is_correct,
        xp_earned=xp_earned,
        feedback=feedback_text,
        grammar_note=grammar_note,
        **heart_fields(progress_row),
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

    badge_earned = check_and_award_badges(user_id)
    progress_row = fetch_user_progress_row(user_id)

    with _active_quizzes_lock:
        _active_quizzes.pop(str(quiz_id), None)

    result = QuizCompleteResultOut(
        quiz_id=quiz_id,
        total_soal=total_soal,
        jumlah_benar=jumlah_benar,
        jumlah_salah=jumlah_salah,
        akurasi=akurasi,
        total_xp_earned=total_xp_earned,
        badge_earned=badge_earned,
        **heart_fields(progress_row),
    )
    return success_response(result)
