import threading
from typing import Any, Dict, List, Optional, Set
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
    AI_PRACTICE_MIN_XP,
    XP_PENALTY_WRONG_AI_QUIZ,
    XP_PER_CORRECT_ANSWER_AI_QUIZ,
    eligible_auto_topics,
    fetch_topic_statistics,
    generate_practice,
)
from app.services.milestone_service import check_and_award_badges
from app.services.progress_service import (
    add_xp,
    deduct_xp,
    fetch_user_progress_row,
    heart_fields,
)
from app.services.unlock_service import GATE1_MESSAGE, get_unlocked_topics, has_completed_any_lesson
from app.utils.cache import (
    RateLimitExceeded,
    check_translate_attempt_rate_limit,
    ensure_practice_generate_allowed,
    record_practice_generate,
)
from app.services.grading_service import grade_short_answer, grade_translation
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
GENERATE_GAGAL_BY_REASON = {
    "ai_unreachable": "AI lagi gak bisa dihubungi, jadi soal belum bisa dibuat. Coba lagi beberapa saat lagi.",
    "timeout": "AI kelamaan nyusun soal. Coba lagi, atau kurangi jumlah soalnya.",
    "rejected": "Soal buatan AI belum ada yang lolos cek kualitas. Coba lagi, atau pilih tipe soal lain.",
    "quota": "Jatah AI kamu hari ini gak cukup buat jumlah soal segini. Coba pilih jumlah soal lebih sedikit, atau lanjut besok.",
}

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


def xp_gate_message(total_xp: int) -> Optional[str]:
    """Pesan kalau XP belum cukup buat buka Latihan AI, None kalau sudah cukup."""
    if total_xp >= AI_PRACTICE_MIN_XP:
        return None
    return (
        f"Butuh minimal {AI_PRACTICE_MIN_XP} XP buat buka Latihan AI. "
        f"XP kamu sekarang {total_xp}, kumpulin dulu dari lesson."
    )


@router.get("/quiz/form-options", response_model=ApiResponse)
def get_quiz_form_options(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    """Dipanggil pas tombol Latihan AI diklik: Gerbang 1 lalu syarat minimal XP.

    Latihan AI gak pakai heart (salah = potong XP), jadi heart cuma ikut dikirim
    buat ditampilin, bukan buat ngunci.
    """
    progress_row = fetch_user_progress_row(user_id)
    gate1_passed = has_completed_any_lesson(user_id)
    total_xp = int(progress_row["total_xp"])
    xp_message = xp_gate_message(total_xp)
    is_open = gate1_passed and xp_message is None

    options = QuizFormOptionsOut(
        gate1_passed=gate1_passed,
        gate1_message=None if gate1_passed else GATE1_MESSAGE,
        xp_required=AI_PRACTICE_MIN_XP,
        total_xp=total_xp,
        xp_gate_passed=xp_message is None,
        xp_gate_message=xp_message,
        available_topics=get_unlocked_topics(user_id) if is_open else [],
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
    # Syarat minimal XP juga dijaga di API.
    xp_message = xp_gate_message(int(fetch_user_progress_row(user_id)["total_xp"]))
    if xp_message:
        return error_response(xp_message)

    # Urutan cek submit: proses lain jalan -> rate limit -> kecukupan topik.
    # Heart gak dicek: Latihan AI pakai XP, bukan heart.
    if not _begin_generate(user_key):
        return error_response(PROSES_MASIH_JALAN)

    try:
        try:
            ensure_practice_generate_allowed(user_key)
        except RateLimitExceeded as exc:
            return error_response(exc.message)

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

        questions_data, status_value, failure_reason = generate_practice(
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
        return error_response(GENERATE_GAGAL_BY_REASON.get(failure_reason or "", GENERATE_GAGAL))

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

    question_key = str(payload.question_id)
    # Cek + tandai "lagi dijawab" dalam satu lock, biar 2 klik barengan gak bikin
    # XP nambah/kepotong dua kali.
    with _active_quizzes_lock:
        if question_key in quiz_state["attempts"]:
            return error_response(QUESTION_SUDAH_DIJAWAB)
        quiz_state["attempts"][question_key] = None

    feedback_text = None
    grammar_note = None
    if question_row["type"] == "translate":
        try:
            check_translate_attempt_rate_limit(str(user_id))
        except RateLimitExceeded as exc:
            with _active_quizzes_lock:
                quiz_state["attempts"].pop(question_key, None)
            return error_response(exc.message)

    try:
        if question_row["type"] == "translate":
            feedback_result = grade_translation(
                question=question_row["question"],
                user_answer=payload.user_answer,
                expected_answer=question_row["expected_answer"],
            )
            is_correct = feedback_result.is_meaning_correct
            feedback_text = feedback_result.feedback
            grammar_note = feedback_result.grammar_note
        else:
            is_correct = grade_short_answer(
                question_row["type"],
                question_row["question"],
                payload.user_answer,
                question_row["expected_answer"],
            )

        record_attempt_log(user_id, question_row["topic"], is_correct)

        # Latihan AI: benar +XP, salah -XP. Heart gak disentuh sama sekali.
        badge_earned = None
        if is_correct:
            xp_earned = XP_PER_CORRECT_ANSWER_AI_QUIZ
            add_xp(user_id, xp_earned)
            # XP badge (Calon Juara / Sang Juara) langsung dicek begitu XP nyentuh target.
            badge_earned = check_and_award_badges(user_id)
        else:
            xp_earned = -deduct_xp(user_id, XP_PENALTY_WRONG_AI_QUIZ)
        progress_row = fetch_user_progress_row(user_id)
    except Exception:
        # Gagal di tengah (misal database error): lepas tanda biar soal bisa dijawab ulang.
        with _active_quizzes_lock:
            quiz_state["attempts"].pop(question_key, None)
        raise

    with _active_quizzes_lock:
        quiz_state["attempts"][question_key] = {
            "is_correct": is_correct,
            "xp_earned": xp_earned,
        }

    result = AttemptResultOut(
        correct=is_correct,
        xp_earned=xp_earned,
        feedback=feedback_text,
        grammar_note=grammar_note,
        badge_earned=badge_earned,
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
    with _active_quizzes_lock:
        answered = [a for a in quiz_state["attempts"].values() if a is not None]
    jumlah_benar = sum(1 for a in answered if a["is_correct"])
    jumlah_salah = len(answered) - jumlah_benar
    # Bersih: XP dari jawaban benar dikurangi XP yang kepotong dari jawaban salah.
    total_xp_earned = sum(a["xp_earned"] for a in answered)
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
