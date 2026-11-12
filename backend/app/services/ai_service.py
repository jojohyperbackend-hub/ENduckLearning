import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import httpx

from app.config import settings
from app.database import get_service_client
from app.models.schemas import (
    AiCallLogEntry,
    PracticeGeneratorAiOutput,
    RejectionReasonCategory,
    TopicScoreDetail,
    TranslateFeedbackAiOutput,
)
from app.utils.cache import check_and_add_daily_token_usage
from app.utils.helpers import (
    calculate_combined_topic_score,
    calculate_grounding_score,
    calculate_max_tokens,
    calculate_recency_score,
    calculate_repeat_score,
    calculate_wilson_lower_bound,
    classify_grounding,
    contains_placeholder_text,
    determine_weak_topics,
    is_duplicate_question,
    is_mc_answer_valid,
    utcnow,
)

logger = logging.getLogger("app.services.ai_service")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "anthropic/claude-haiku-5.5"
XP_PER_CORRECT_ANSWER_AI_QUIZ = 10
MAX_GENERATION_ATTEMPTS = 3
AI_CALL_TIMEOUT_SECONDS = 30.0


class AiGenerationRejected(Exception):
    def __init__(self, reason: RejectionReasonCategory, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


class AiTechnicalFailure(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AiAttemptFailed(Exception):
    def __init__(self, call_log: AiCallLogEntry, message: str) -> None:
        super().__init__(message)
        self.call_log = call_log
        self.message = message


def _call_openrouter_raw(
    system_prompt: str, user_prompt: str, max_tokens: int
) -> Tuple[str, int, int]:
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0,
        "frequency_penalty": 0.3,
        "max_tokens": max_tokens,
    }

    start_time = time.monotonic()
    try:
        with httpx.Client(timeout=AI_CALL_TIMEOUT_SECONDS) as client:
            response = client.post(OPENROUTER_URL, headers=headers, json=body)
            response.raise_for_status()
            response_json = response.json()
    except Exception as exc:
        raise AiTechnicalFailure(f"Panggilan ke OpenRouter gagal: {str(exc)}") from exc
    elapsed_ms = int((time.monotonic() - start_time) * 1000)

    try:
        content = response_json["choices"][0]["message"]["content"]
        token_used = response_json.get("usage", {}).get("total_tokens", 0)
    except (KeyError, IndexError) as exc:
        raise AiTechnicalFailure("Format respons OpenRouter tidak sesuai ekspektasi") from exc

    return content, token_used, elapsed_ms


def _resolve_topics(fokus_topik: str, weak_topics: List[str], all_topics: List[str]) -> List[str]:
    if fokus_topik != "auto":
        return [fokus_topik]
    if weak_topics:
        return weak_topics
    return all_topics[:3]


def _fetch_topic_statistics(user_id: UUID) -> Tuple[Dict[str, float], Dict[str, int], List[str]]:
    client = get_service_client()
    result = (
        client.table("attempt_log")
        .select("topic, is_correct, created_at")
        .eq("user_id", str(user_id))
        .execute()
    )

    per_topic_attempts: Dict[str, List[Dict[str, Any]]] = {}
    for row in result.data:
        topic = row["topic"]
        per_topic_attempts.setdefault(topic, []).append(row)

    topic_scores: Dict[str, float] = {}
    jumlah_data_per_topic: Dict[str, int] = {}
    now = utcnow()

    for topic, attempts in per_topic_attempts.items():
        jumlah_total = len(attempts)
        jumlah_benar = sum(1 for a in attempts if a["is_correct"])
        jumlah_salah = jumlah_total - jumlah_benar
        jumlah_data_per_topic[topic] = jumlah_total

        wrong_attempts = [a for a in attempts if not a["is_correct"]]
        if wrong_attempts:
            latest_wrong = max(wrong_attempts, key=lambda a: a["created_at"])
            created_at_value = latest_wrong["created_at"]
            if isinstance(created_at_value, str):
                from datetime import datetime as _dt

                parsed = _dt.fromisoformat(created_at_value.replace("Z", "+00:00"))
            else:
                parsed = created_at_value
            hari_sejak_terakhir_salah = (now - parsed).total_seconds() / 86400.0
        else:
            hari_sejak_terakhir_salah = None

        wilson_lower = calculate_wilson_lower_bound(jumlah_benar, jumlah_total)
        recency_score = calculate_recency_score(hari_sejak_terakhir_salah)
        repeat_score = calculate_repeat_score(jumlah_salah, jumlah_total)
        skor_topik = calculate_combined_topic_score(wilson_lower, recency_score, repeat_score)
        topic_scores[topic] = skor_topik

    all_topics = list(per_topic_attempts.keys())
    return topic_scores, jumlah_data_per_topic, all_topics


def _persist_topic_scores(user_id: UUID, topic_scores: Dict[str, float], jumlah_data_per_topic: Dict[str, int], weak_topics: List[str]) -> None:
    client = get_service_client()
    rows = []
    for topic, skor in topic_scores.items():
        rows.append(
            {
                "user_id": str(user_id),
                "topic": topic,
                "skor_topik": skor,
                "jumlah_data": jumlah_data_per_topic.get(topic, 0),
                "is_weak": topic in weak_topics,
                "updated_at": utcnow().isoformat(),
            }
        )
    if rows:
        client.table("topic_score").upsert(rows, on_conflict="user_id,topic").execute()


def _fetch_topic_context(topic: str) -> str:
    client = get_service_client()
    result = (
        client.table("exercise")
        .select("question, expected_answer")
        .eq("topic", topic)
        .limit(10)
        .execute()
    )
    context_parts = [f"{row['question']} -> {row['expected_answer']}" for row in result.data]
    return " | ".join(context_parts)


def _fetch_recent_questions_for_topic(topic: str) -> List[str]:
    client = get_service_client()
    result = client.table("exercise").select("question").eq("topic", topic).limit(50).execute()
    return [row["question"] for row in result.data]


def _build_fallback_question(topic: str) -> Optional[Dict[str, Any]]:
    client = get_service_client()
    result = (
        client.table("exercise")
        .select("exercise_id, type, topic, question, options, expected_answer")
        .eq("topic", topic)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    row = result.data[0]
    return {
        "exercise_id": row["exercise_id"],
        "type": row["type"],
        "topic": row["topic"],
        "question": row["question"],
        "options": row.get("options"),
        "expected_answer": row["expected_answer"],
        "source": "fallback_original",
    }


def _run_final_check(generated: PracticeGeneratorAiOutput, topic_context: str) -> bool:
    system_prompt = (
        "Anda adalah validator soal bahasa Inggris. Jawab HANYA dengan 'VALID' atau 'TIDAK_VALID'. "
        "Periksa apakah soal berikut masuk akal, benar secara tata bahasa, dan sesuai konteks topik."
    )
    user_prompt = (
        f"Konteks topik: {topic_context}\n"
        f"Soal: {generated.question}\n"
        f"Jawaban yang diharapkan: {generated.expected_answer}"
    )
    try:
        content, token_used, _ = _call_openrouter_raw(system_prompt, user_prompt, max_tokens=10)
    except AiTechnicalFailure:
        return False
    return "VALID" in content.upper() and "TIDAK_VALID" not in content.upper()


def _generate_one_question(
    topic: str, tipe_soal: str, tingkat_kesulitan: str, existing_questions: List[str]
) -> Tuple[Optional[PracticeGeneratorAiOutput], List[AiCallLogEntry]]:
    topic_context = _fetch_topic_context(topic)
    call_logs: List[AiCallLogEntry] = []

    system_prompt = (
        "Anda adalah pembuat soal latihan bahasa Inggris untuk aplikasi pembelajaran. "
        "Keluarkan HANYA JSON valid dengan field: type, question, options (null kecuali multiple_choice), "
        "expected_answer, based_on_pattern. Jangan beri komentar tambahan apapun di luar JSON."
    )
    tipe_instruksi = tipe_soal if tipe_soal != "campur" else "multiple_choice, fill_blank, atau translate"
    user_prompt = (
        f"Topik: {topic}\n"
        f"Tingkat kesulitan relatif: {tingkat_kesulitan}\n"
        f"Tipe soal yang diinginkan: {tipe_instruksi}\n"
        f"Konteks referensi dari bank soal (jangan diduplikasi persis): {topic_context}\n"
        "Buat satu soal baru yang original, relevan dengan topik, dan edukatif."
    )

    for attempt_number in range(1, MAX_GENERATION_ATTEMPTS + 1):
        max_tokens = calculate_max_tokens(1)
        try:
            content, token_used, elapsed_ms = _call_openrouter_raw(system_prompt, user_prompt, max_tokens)
        except AiTechnicalFailure as exc:
            call_logs.append(
                AiCallLogEntry(
                    pipeline="practice_generator",
                    percobaan_ke=attempt_number,
                    berhasil=False,
                    alasan_gagal="ai_error_teknis",
                    token_used=0,
                    temperature_used=0.0,
                    lama_proses_ms=0,
                )
            )
            continue

        try:
            parsed_json = json.loads(content.strip().strip("`").removeprefix("json").strip())
        except (json.JSONDecodeError, AttributeError):
            call_logs.append(
                AiCallLogEntry(
                    pipeline="practice_generator",
                    percobaan_ke=attempt_number,
                    berhasil=False,
                    alasan_gagal="format_tidak_valid",
                    token_used=token_used,
                    temperature_used=0.0,
                    lama_proses_ms=elapsed_ms,
                )
            )
            continue

        if contains_placeholder_text(parsed_json.get("question", "")):
            call_logs.append(
                AiCallLogEntry(
                    pipeline="practice_generator",
                    percobaan_ke=attempt_number,
                    berhasil=False,
                    alasan_gagal="placeholder_terdeteksi",
                    token_used=token_used,
                    temperature_used=0.0,
                    lama_proses_ms=elapsed_ms,
                )
            )
            continue

        try:
            generated = PracticeGeneratorAiOutput(**parsed_json)
        except Exception:
            call_logs.append(
                AiCallLogEntry(
                    pipeline="practice_generator",
                    percobaan_ke=attempt_number,
                    berhasil=False,
                    alasan_gagal="format_tidak_valid",
                    token_used=token_used,
                    temperature_used=0.0,
                    lama_proses_ms=elapsed_ms,
                )
            )
            continue

        if is_duplicate_question(generated.question, existing_questions):
            call_logs.append(
                AiCallLogEntry(
                    pipeline="practice_generator",
                    percobaan_ke=attempt_number,
                    berhasil=False,
                    alasan_gagal="duplikat_soal",
                    token_used=token_used,
                    temperature_used=0.0,
                    lama_proses_ms=elapsed_ms,
                )
            )
            continue

        if generated.type == "multiple_choice" and not is_mc_answer_valid(
            generated.expected_answer, generated.options
        ):
            call_logs.append(
                AiCallLogEntry(
                    pipeline="practice_generator",
                    percobaan_ke=attempt_number,
                    berhasil=False,
                    alasan_gagal="jawaban_tidak_masuk_akal",
                    token_used=token_used,
                    temperature_used=0.0,
                    lama_proses_ms=elapsed_ms,
                )
            )
            continue

        grounding_score = calculate_grounding_score(generated.question, topic_context)
        grounding_class = classify_grounding(grounding_score)

        if grounding_class == "NONE":
            call_logs.append(
                AiCallLogEntry(
                    pipeline="practice_generator",
                    percobaan_ke=attempt_number,
                    berhasil=False,
                    alasan_gagal="grounding_gagal",
                    token_used=token_used,
                    temperature_used=0.0,
                    lama_proses_ms=elapsed_ms,
                )
            )
            continue

        if grounding_class == "WEAK":
            is_final_check_valid = _run_final_check(generated, topic_context)
            if not is_final_check_valid:
                call_logs.append(
                    AiCallLogEntry(
                        pipeline="practice_generator",
                        percobaan_ke=attempt_number,
                        berhasil=False,
                        alasan_gagal="grounding_gagal",
                        token_used=token_used,
                        temperature_used=0.0,
                        lama_proses_ms=elapsed_ms,
                    )
                )
                continue

        call_logs.append(
            AiCallLogEntry(
                pipeline="practice_generator",
                percobaan_ke=attempt_number,
                berhasil=True,
                alasan_gagal=None,
                token_used=token_used,
                temperature_used=0.0,
                lama_proses_ms=elapsed_ms,
            )
        )
        return generated, call_logs

    return None, call_logs


def generate_practice(
    user_id: UUID, jumlah_soal: int, tipe_soal: str, fokus_topik: str, tingkat_kesulitan: str
) -> Tuple[List[Dict[str, Any]], str]:
    topic_scores, jumlah_data_per_topic, all_topics = _fetch_topic_statistics(user_id)
    weak_topics = determine_weak_topics(topic_scores, jumlah_data_per_topic)
    _persist_topic_scores(user_id, topic_scores, jumlah_data_per_topic, weak_topics)

    resolved_topics = _resolve_topics(fokus_topik, weak_topics, all_topics)
    if not resolved_topics:
        resolved_topics = ["general"]

    questions: List[Dict[str, Any]] = []
    existing_questions_text: List[str] = []
    total_tokens_estimate = 0

    for index in range(jumlah_soal):
        topic = resolved_topics[index % len(resolved_topics)]
        actual_tipe_soal = tipe_soal if tipe_soal != "campur" else ["multiple_choice", "fill_blank", "translate"][index % 3]

        try:
            check_and_add_daily_token_usage(str(user_id), calculate_max_tokens(1))
        except Exception:
            fallback = _build_fallback_question(topic)
            if fallback is not None:
                fallback["source"] = "fallback_original"
                questions.append(fallback)
            continue

        generated, call_logs = _generate_one_question(
            topic, actual_tipe_soal, tingkat_kesulitan, existing_questions_text
        )
        for log_entry in call_logs:
            total_tokens_estimate += log_entry.token_used

        if generated is None:
            fallback = _build_fallback_question(topic)
            if fallback is not None:
                fallback["source"] = "fallback_original"
                questions.append(fallback)
            continue

        existing_questions_text.append(generated.question)
        questions.append(
            {
                "exercise_id": None,
                "type": generated.type,
                "topic": topic,
                "question": generated.question,
                "options": generated.options,
                "expected_answer": generated.expected_answer,
                "source": "ai_generated",
            }
        )

    status_value = "ready" if len(questions) == jumlah_soal else "partial"
    return questions, status_value


def generate_translate_feedback(
    user_answer: str, expected_answer: str, question_text: str
) -> TranslateFeedbackAiOutput:
    system_prompt = (
        "Anda adalah guru bahasa Inggris yang mengevaluasi jawaban terjemahan siswa. "
        "Keluarkan HANYA JSON valid dengan field: is_meaning_correct (boolean), "
        "feedback (string, maksimal 200 karakter, dalam Bahasa Indonesia), "
        "grammar_note (string atau null, catatan tata bahasa singkat)."
    )
    user_prompt = (
        f"Soal: {question_text}\n"
        f"Jawaban yang diharapkan: {expected_answer}\n"
        f"Jawaban siswa: {user_answer}\n"
        "Evaluasi apakah makna jawaban siswa sudah tepat, beri feedback singkat yang membangun."
    )

    try:
        content, token_used, elapsed_ms = _call_openrouter_raw(system_prompt, user_prompt, max_tokens=150)
    except AiTechnicalFailure:
        is_exact_match = user_answer.strip().lower() == expected_answer.strip().lower()
        return TranslateFeedbackAiOutput(
            is_meaning_correct=is_exact_match,
            feedback="Sistem AI sedang tidak tersedia, jawaban dinilai berdasarkan kecocokan teks.",
            grammar_note=None,
        )

    try:
        parsed_json = json.loads(content.strip().strip("`").removeprefix("json").strip())
        return TranslateFeedbackAiOutput(**parsed_json)
    except Exception:
        is_exact_match = user_answer.strip().lower() == expected_answer.strip().lower()
        return TranslateFeedbackAiOutput(
            is_meaning_correct=is_exact_match,
            feedback="Sistem AI memberikan respons tidak valid, jawaban dinilai berdasarkan kecocokan teks.",
            grammar_note=None,
        )
