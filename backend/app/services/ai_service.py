import json
import logging
import random
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from concurrent.futures import TimeoutError as FuturesTimeout
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import httpx
from rapidfuzz import fuzz

from app.config import settings
from app.database import get_service_client
from app.models.schemas import (
    AiCallLogEntry,
    PracticeGeneratorAiOutput,
    RejectionReasonCategory,
    TopicScoreDetail,
)
from app.utils.cache import RateLimitExceeded, check_and_add_daily_token_usage
from app.utils.helpers import (
    calculate_combined_topic_score,
    calculate_max_tokens,
    calculate_recency_score,
    calculate_repeat_score,
    calculate_wilson_lower_bound,
    contains_placeholder_text,
    determine_weak_topics,
    is_mc_answer_valid,
    utcnow,
)

logger = logging.getLogger("app.services.ai_service")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "anthropic/claude-haiku-5.5"
XP_PER_CORRECT_ANSWER_AI_QUIZ = 14
# Latihan AI gak pakai heart: jawaban salah motong XP (total XP gak bisa di bawah 0).
XP_PENALTY_WRONG_AI_QUIZ = 5
# Syarat buka Latihan AI: total XP minimal segini. XP gak dipotong, cuma dicek.
AI_PRACTICE_MIN_XP = 10
# Semua soal dibikin barengan (paralel), dengan batas waktu total biar user gak nunggu lama.
GENERATION_DEADLINE_SECONDS = 40.0
MAX_PARALLEL_GENERATIONS = 10
MAX_GENERATION_ATTEMPTS = 3
AI_CALL_TIMEOUT_SECONDS = 30.0
# Batas bawah max_tokens tiap panggilan, biar jawaban gak kepotong jadi kosong.
MIN_MAX_TOKENS = 256
# Haiku 5.5 cuma nerima temperature default (1). Dicatat di log percobaan apa adanya.
MODEL_TEMPERATURE = 1.0


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


def _extract_text(message: Dict[str, Any]) -> str:
    """Ambil teks jawaban model. content bisa string, list blok (teks/reasoning), atau kosong."""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") in (None, "text", "output_text")
        )
    return ""


def parse_json_object(content: str) -> Dict[str, Any]:
    """Ambil objek JSON dari jawaban model, walau dibungkus ```json atau ada teks lain di sekitarnya."""
    cleaned = (content or "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("gak ada objek JSON")
    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("bukan objek JSON")
    return parsed


_TYPE_ALIASES = {
    "multiple_choice": "multiple_choice", "multiplechoice": "multiple_choice", "mc": "multiple_choice",
    "pilihan_ganda": "multiple_choice", "choice": "multiple_choice",
    "fill_blank": "fill_blank", "fill_in_the_blank": "fill_blank", "fill_in_blank": "fill_blank",
    "fillblank": "fill_blank", "fill": "fill_blank", "isian": "fill_blank",
    "translate": "translate", "translation": "translate", "terjemahan": "translate",
}


def _normalize_generated_json(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Rapihin variasi format dari model sebelum divalidasi skema."""
    fixed = dict(parsed)
    raw_type = re.sub(r"[\s\-]+", "_", str(fixed.get("type", "")).strip().lower())
    fixed["type"] = _TYPE_ALIASES.get(raw_type, raw_type)
    if fixed["type"] != "multiple_choice":
        fixed["options"] = None
    elif isinstance(fixed.get("options"), list):
        fixed["options"] = [str(option).strip() for option in fixed["options"] if str(option).strip()]
    for field in ("question", "expected_answer", "based_on_pattern"):
        if fixed.get(field) is not None:
            fixed[field] = str(fixed[field]).strip()
    if not fixed.get("based_on_pattern") or len(fixed["based_on_pattern"]) < 5:
        fixed["based_on_pattern"] = "pola materi lesson"
    return fixed


def _call_openrouter_raw(system_prompt: str, user_prompt: str, max_tokens: int) -> Tuple[str, int, int]:
    """Satu panggilan ke model lewat OpenRouter. Raise AiTechnicalFailure kalau gagal/kosong.

    Aturan Claude Haiku 5.5 di OpenRouter:
    - temperature/top_p/top_k gak boleh dikirim (selain default) -> request ditolak 400,
      jadi gak dikirim sama sekali.
    - Model "mikir" dulu secara default dan token mikirnya ikut makan max_tokens, jadi
      reasoning dimatiin dan max_tokens dikasih batas bawah biar jawabannya gak kosong.
    """
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
        "max_tokens": max(MIN_MAX_TOKENS, max_tokens),
        "reasoning": {"enabled": False},
    }

    start_time = time.monotonic()
    try:
        with httpx.Client(timeout=AI_CALL_TIMEOUT_SECONDS) as client:
            response = client.post(OPENROUTER_URL, headers=headers, json=body)
    except Exception as exc:
        logger.warning("OpenRouter gak bisa dihubungi: %s", exc)
        raise AiTechnicalFailure(f"Panggilan ke OpenRouter gagal: {exc}") from exc
    elapsed_ms = int((time.monotonic() - start_time) * 1000)

    if response.status_code >= 400:
        # Isi error dari OpenRouter ditulis ke log uvicorn biar penyebabnya kelihatan
        # (API key salah, saldo habis, model/parameter ditolak, dll).
        logger.warning(
            "OpenRouter menolak request (HTTP %s, model %s): %s",
            response.status_code,
            OPENROUTER_MODEL,
            response.text[:500],
        )
        raise AiTechnicalFailure(f"OpenRouter HTTP {response.status_code}: {response.text[:200]}")

    try:
        response_json = response.json()
        choice = response_json["choices"][0]
        content = _extract_text(choice.get("message") or {})
        token_used = int((response_json.get("usage") or {}).get("total_tokens") or 0)
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        logger.warning("Format respons OpenRouter aneh: %s", response.text[:500])
        raise AiTechnicalFailure("Format respons OpenRouter tidak sesuai ekspektasi") from exc

    if not content.strip():
        logger.warning(
            "OpenRouter balikin jawaban kosong (finish_reason=%s, model %s)",
            choice.get("finish_reason"),
            OPENROUTER_MODEL,
        )
        raise AiTechnicalFailure("Jawaban model kosong")

    return content, token_used, elapsed_ms


MIN_ATTEMPTS_FOR_AUTO_TOPIC = 3
MAX_AUTO_TOPICS = 3

TopicStatistics = Tuple[Dict[str, float], Dict[str, int], List[str]]


def eligible_auto_topics(topic_scores: Dict[str, float], jumlah_data_per_topic: Dict[str, int]) -> List[str]:
    """Topik yang riwayatnya cukup buat mode Otomatis (minimal 3x percobaan), skor tertinggi dulu."""
    eligible = [
        topic
        for topic, jumlah in jumlah_data_per_topic.items()
        if jumlah >= MIN_ATTEMPTS_FOR_AUTO_TOPIC
    ]
    eligible.sort(key=lambda topic: topic_scores.get(topic, 0.0), reverse=True)
    return eligible


def _resolve_topics(
    fokus_topik: str,
    weak_topics: List[str],
    topic_scores: Dict[str, float],
    jumlah_data_per_topic: Dict[str, int],
) -> List[str]:
    if fokus_topik != "auto":
        return [fokus_topik]
    if weak_topics:
        return weak_topics
    return eligible_auto_topics(topic_scores, jumlah_data_per_topic)[:MAX_AUTO_TOPICS]


def fetch_topic_statistics(user_id: UUID) -> TopicStatistics:
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


DIFFICULTY_GUIDE: Dict[str, str] = {
    "lebih_gampang": (
        "MUDAH: kalimat pendek 4-8 kata, kosakata sehari-hari yang paling umum, "
        "pilihan jawaban salah jelas bedanya."
    ),
    "sama_kayak_terakhir": (
        "SEDANG: setara soal lesson, kalimat 6-12 kata, kosakata umum, "
        "pilihan jawaban salah masuk akal tapi tetap jelas salah."
    ),
    "lebih_susah": (
        "SULIT: kalimat 10-18 kata atau 2 klausa, konteks lebih spesifik, "
        "pilihan jawaban salah mirip satu sama lain dan menjebak, tapi tetap cuma 1 yang benar."
    ),
}

TYPE_GUIDE: Dict[str, str] = {
    "multiple_choice": (
        'type "multiple_choice": question berisi kalimat/pertanyaan, options berisi TEPAT 4 pilihan '
        "berbeda, expected_answer HARUS sama persis dengan salah satu options, cuma 1 jawaban yang benar."
    ),
    "fill_blank": (
        'type "fill_blank": question berisi kalimat bahasa Inggris dengan SATU tempat kosong "___", '
        "WAJIB kasih petunjuk dalam kurung (kata dasar bahasa Inggris atau arti bahasa Indonesia) "
        "biar jawabannya jelas, options null, expected_answer 1-3 kata pengisi titik-titik saja "
        "(bukan kalimat penuh). Kalau ada jawaban lain yang juga benar (misal doesn't like dan "
        "does not like), tulis semuanya di expected_answer dipisah | ."
    ),
    "translate": (
        'type "translate": question diawali "Translate to English: " lalu kalimat bahasa Indonesia '
        "dalam tanda kutip, options null. expected_answer berisi terjemahan bahasa Inggris yang paling "
        "wajar, lalu 1-3 terjemahan lain yang juga benar, semuanya dipisah | (misal kalau 'dia' bisa "
        "he atau she, atau ada sinonim umum)."
    ),
}

# Situasi dirotasi per soal biar tiap soal punya konteks beda dan gak nempel ke soal lesson.
SCENARIO_POOL: List[str] = [
    "di kantin sekolah",
    "lagi liburan ke pantai",
    "di kantor saat rapat",
    "belanja di minimarket",
    "naik kereta atau bus",
    "main game bareng teman",
    "masak di dapur rumah",
    "di perpustakaan",
    "nonton film di bioskop",
    "olahraga di lapangan",
    "di rumah sakit atau klinik",
    "pesan makanan lewat aplikasi",
    "acara keluarga di akhir pekan",
    "di bandara",
    "kerja kelompok tugas kuliah",
    "jalan-jalan di kota baru",
    "merawat hewan peliharaan",
    "hari pertama kerja",
]

PATTERN_SIMILARITY_LIMIT = 72.0
BATCH_SIMILARITY_LIMIT = 80.0

_QUOTE_CHARS = "'\"‘’“” "


def _core_sentence(question: str) -> str:
    """Bagian inti soal yang dibandingin.

    Soal lesson kebanyakan formatnya "Choose the correct form: '...'" atau
    "Translate to English: '...'", jadi kalimat perintah di depan titik dua dibuang,
    yang dibandingin isi kalimatnya.
    """
    core = question.split(":", 1)[1] if ":" in question else question
    return re.sub(r"\s+", " ", core.strip().strip(_QUOTE_CHARS)).lower()


def _signature(question: str, options: Optional[List[str]] = None) -> str:
    """Teks pembanding soal. Pilihan ganda sering punya kalimat soal yang umum banget
    ("Choose the correct sentence."), jadi pilihan jawabannya ikut dibandingin."""
    if options:
        return f"{question} {' '.join(str(option) for option in options)}"
    return question


def _too_similar(candidate: str, references: List[str], limit: float) -> bool:
    candidate_core = _core_sentence(candidate)
    for reference in references:
        reference_core = _core_sentence(reference)
        score = max(
            fuzz.ratio(candidate_core, reference_core),
            fuzz.token_sort_ratio(candidate_core, reference_core),
        )
        if score >= limit:
            return True
    return False


def _fetch_topic_bank(topic: str) -> List[Dict[str, Any]]:
    """Semua soal lesson buat topik ini. Dipakai sebagai contoh pola materi
    sekaligus daftar soal yang TIDAK boleh ditiru Latihan AI."""
    client = get_service_client()
    result = (
        client.table("exercise")
        .select("type, question, options, expected_answer")
        .eq("topic", topic)
        .limit(50)
        .execute()
    )
    return list(result.data)


def _validate_generated(
    generated: PracticeGeneratorAiOutput, topic: str, bank_text: str
) -> Tuple[bool, int, int]:
    """Validator kedua: soal harus menguji materi topik ini, jawabannya benar & satu-satunya.

    Return (valid, token_used, elapsed_ms).
    """
    system_prompt = (
        "Anda adalah validator soal bahasa Inggris. Jawab HANYA dengan satu kata: "
        "'VALID' atau 'TIDAK_VALID'."
    )
    options_text = f"\nPilihan: {generated.options}" if generated.options else ""
    user_prompt = (
        f"Materi lesson: {topic}\n"
        f"Contoh soal lesson untuk materi ini: {bank_text}\n\n"
        f"Soal baru ({generated.type}): {generated.question}{options_text}\n"
        f"Kunci jawaban: {generated.expected_answer}\n\n"
        "VALID hanya kalau SEMUA benar:\n"
        "1. Soal menguji materi lesson di atas (bukan materi lain).\n"
        "2. Kunci jawaban benar dan cuma satu jawaban yang benar.\n"
        "3. Bahasa Inggrisnya benar dan wajar."
    )
    try:
        content, token_used, elapsed_ms = _call_openrouter_raw(
            system_prompt, user_prompt, max_tokens=MIN_MAX_TOKENS
        )
    except AiTechnicalFailure:
        # Validator gak bisa dihubungi: soal yang udah lolos cek format tetap dipakai,
        # daripada user gak dapat soal sama sekali.
        return True, 0, 0
    verdict = re.sub(r"[^A-Z_ ]", " ", content.upper())
    rejected = any(word in verdict for word in ("TIDAK_VALID", "TIDAK VALID", "INVALID", "NOT VALID"))
    return (not rejected and "VALID" in verdict), token_used, elapsed_ms


def _log_entry(
    attempt_number: int,
    alasan: Optional[RejectionReasonCategory],
    token_used: int,
    temperature: float,
    elapsed_ms: int,
) -> AiCallLogEntry:
    return AiCallLogEntry(
        pipeline="practice_generator",
        percobaan_ke=attempt_number,
        berhasil=alasan is None,
        alasan_gagal=alasan,
        token_used=token_used,
        temperature_used=temperature,
        lama_proses_ms=elapsed_ms,
    )


def _generate_one_question(
    topic: str,
    tipe_soal: str,
    tingkat_kesulitan: str,
    batch_questions: List[str],
    bank_rows: List[Dict[str, Any]],
    scenario: str,
    deadline: Optional[float] = None,
) -> Tuple[Optional[PracticeGeneratorAiOutput], List[AiCallLogEntry]]:
    call_logs: List[AiCallLogEntry] = []
    bank_signatures = [_signature(row["question"], row.get("options")) for row in bank_rows]
    bank_text = "; ".join(
        f"{row['question']} -> {row['expected_answer'].split('|')[0].strip()}" for row in bank_rows[:10]
    )
    batch_text = " | ".join(batch_questions[-10:]) if batch_questions else "(belum ada)"

    system_prompt = (
        "Anda adalah pembuat soal latihan bahasa Inggris untuk pelajar Indonesia. "
        "Keluarkan HANYA satu objek JSON valid dengan field: type, question, options, "
        "expected_answer, based_on_pattern. Tanpa markdown, tanpa komentar di luar JSON."
    )
    user_prompt = (
        f"Materi lesson (WAJIB, soal hanya boleh menguji materi ini): {topic}\n"
        f"Format soal: {TYPE_GUIDE[tipe_soal]}\n"
        f"Tingkat kesulitan: {DIFFICULTY_GUIDE.get(tingkat_kesulitan, DIFFICULTY_GUIDE['sama_kayak_terakhir'])}\n"
        f"Situasi kalimat: {scenario} (kalau situasi ini gak cocok sama materi, pilih situasi lain "
        "yang cocok, tapi jangan situasi yang sama dengan contoh soal lesson).\n\n"
        f"Soal lesson yang SUDAH dipelajari user (pahami pola tata bahasanya saja): {bank_text}\n"
        "DILARANG menyalin, memparafrase, atau cuma ganti 1-2 kata dari soal lesson di atas. "
        "Pakai subjek, kata kerja, benda, dan konteks yang BERBEDA.\n"
        f"Soal yang sudah dibuat di latihan ini (jangan diulang): {batch_text}\n\n"
        "based_on_pattern: tulis singkat pola tata bahasa/kosakata yang diuji."
    )

    for attempt_number in range(1, MAX_GENERATION_ATTEMPTS + 1):
        # Waktu generate udah habis: jangan mulai percobaan baru.
        if deadline is not None and time.monotonic() >= deadline:
            break
        temperature = MODEL_TEMPERATURE
        max_tokens = calculate_max_tokens(1)
        try:
            content, token_used, elapsed_ms = _call_openrouter_raw(system_prompt, user_prompt, max_tokens)
        except AiTechnicalFailure:
            call_logs.append(_log_entry(attempt_number, "ai_error_teknis", 0, temperature, 0))
            continue

        try:
            parsed_json = _normalize_generated_json(parse_json_object(content))
        except (json.JSONDecodeError, AttributeError, ValueError):
            call_logs.append(
                _log_entry(attempt_number, "format_tidak_valid", token_used, temperature, elapsed_ms)
            )
            continue

        if contains_placeholder_text(str(parsed_json.get("question", ""))):
            call_logs.append(
                _log_entry(attempt_number, "placeholder_terdeteksi", token_used, temperature, elapsed_ms)
            )
            continue

        try:
            generated = PracticeGeneratorAiOutput(**parsed_json)
        except Exception:
            call_logs.append(
                _log_entry(attempt_number, "format_tidak_valid", token_used, temperature, elapsed_ms)
            )
            continue

        # Tipe soal harus persis yang diminta user.
        if generated.type != tipe_soal or (
            tipe_soal == "fill_blank" and "___" not in generated.question
        ):
            call_logs.append(
                _log_entry(attempt_number, "format_tidak_valid", token_used, temperature, elapsed_ms)
            )
            continue

        if generated.type == "multiple_choice" and not is_mc_answer_valid(
            generated.expected_answer, generated.options
        ):
            call_logs.append(
                _log_entry(
                    attempt_number, "jawaban_tidak_masuk_akal", token_used, temperature, elapsed_ms
                )
            )
            continue

        # Harus beda dari soal lesson dan dari soal lain di latihan ini.
        if _too_similar(_signature(generated.question, generated.options), bank_signatures, PATTERN_SIMILARITY_LIMIT) or _too_similar(
            generated.question, batch_questions, BATCH_SIMILARITY_LIMIT
        ):
            call_logs.append(
                _log_entry(attempt_number, "duplikat_soal", token_used, temperature, elapsed_ms)
            )
            continue

        # Waktu generate udah habis: hasilnya gak bakal dipakai, jangan buang token buat ngecek.
        if deadline is not None and time.monotonic() >= deadline:
            break

        # Harus beneran nguji materi topik ini (gak nyasar ke materi lain).
        is_valid, check_tokens, check_ms = _validate_generated(generated, topic, bank_text)
        if not is_valid:
            call_logs.append(
                _log_entry(
                    attempt_number,
                    "grounding_gagal",
                    token_used + check_tokens,
                    temperature,
                    elapsed_ms + check_ms,
                )
            )
            continue

        call_logs.append(
            _log_entry(attempt_number, None, token_used + check_tokens, temperature, elapsed_ms + check_ms)
        )
        return generated, call_logs

    logger.warning(
        "Soal Latihan AI (%s, %s) gagal dibuat setelah %s percobaan: %s",
        topic,
        tipe_soal,
        len(call_logs),
        ", ".join(entry.alasan_gagal or "-" for entry in call_logs) or "waktu habis",
    )
    return None, call_logs


def _allocate_topics(resolved_topics: List[str], jumlah_soal: int) -> List[str]:
    """Bagi jumlah soal ke topik secara rata, soal satu topik dikumpulin berurutan
    (A A B B C), bukan diselang-seling (A B C A B), biar gak kecampur."""
    topic_count = len(resolved_topics)
    base, extra = divmod(jumlah_soal, topic_count)
    plan: List[str] = []
    for position, topic in enumerate(resolved_topics):
        plan.extend([topic] * (base + (1 if position < extra else 0)))
    return plan


def _plan_types(tipe_soal: str, jumlah_soal: int) -> List[str]:
    if tipe_soal != "campur":
        return [tipe_soal] * jumlah_soal
    cycle = ["multiple_choice", "fill_blank", "translate"]
    return [cycle[index % len(cycle)] for index in range(jumlah_soal)]


def generate_practice(
    user_id: UUID,
    jumlah_soal: int,
    tipe_soal: str,
    fokus_topik: str,
    tingkat_kesulitan: str,
    topic_statistics: Optional[TopicStatistics] = None,
) -> Tuple[List[Dict[str, Any]], str, Optional[str]]:
    """Bikin soal Latihan AI. Semua soal hasil AI yang lolos cek: beda dari soal lesson,
    sesuai materi topiknya, sesuai tipe yang diminta. Gak ada lagi soal lesson yang
    disisipin sebagai pengganti; kalau AI gagal, soal itu dilewati (status partial)."""
    topic_scores, jumlah_data_per_topic, _ = topic_statistics or fetch_topic_statistics(user_id)
    weak_topics = determine_weak_topics(topic_scores, jumlah_data_per_topic)
    _persist_topic_scores(user_id, topic_scores, jumlah_data_per_topic, weak_topics)

    resolved_topics = _resolve_topics(fokus_topik, weak_topics, topic_scores, jumlah_data_per_topic)
    if not resolved_topics:
        return [], "partial", "rejected"

    topic_plan = _allocate_topics(resolved_topics, jumlah_soal)
    type_plan = _plan_types(tipe_soal, jumlah_soal)
    scenarios = random.sample(SCENARIO_POOL, k=min(jumlah_soal, len(SCENARIO_POOL)))
    bank_by_topic = {topic: _fetch_topic_bank(topic) for topic in resolved_topics}

    deadline = time.monotonic() + GENERATION_DEADLINE_SECONDS
    all_logs: List[AiCallLogEntry] = []

    def run_round(indexes: List[int], known_questions: List[str]) -> Dict[int, PracticeGeneratorAiOutput]:
        """Bikin soal buat beberapa nomor sekaligus (paralel). Return nomor -> soal yang lolos cek."""
        allowed: List[int] = []
        for index in indexes:
            try:
                check_and_add_daily_token_usage(str(user_id), calculate_max_tokens(1))
            except RateLimitExceeded:
                logger.info("Kuota token harian user %s habis di soal ke-%s", user_id, index + 1)
                break
            allowed.append(index)
        if not allowed:
            return {}

        results: Dict[int, PracticeGeneratorAiOutput] = {}
        executor = ThreadPoolExecutor(max_workers=min(MAX_PARALLEL_GENERATIONS, len(allowed)))
        futures = {
            executor.submit(
                _generate_one_question,
                topic=topic_plan[index],
                tipe_soal=type_plan[index],
                tingkat_kesulitan=tingkat_kesulitan,
                batch_questions=known_questions,
                bank_rows=bank_by_topic[topic_plan[index]],
                scenario=scenarios[index % len(scenarios)],
                deadline=deadline,
            ): index
            for index in allowed
        }
        try:
            for future in as_completed(futures, timeout=max(0.1, deadline - time.monotonic())):
                try:
                    generated, round_logs = future.result()
                except Exception:
                    logger.exception("Generate soal ke-%s error", futures[future] + 1)
                    continue
                all_logs.extend(round_logs)
                if generated is not None:
                    results[futures[future]] = generated
        except FuturesTimeout:
            logger.info("Generate soal user %s kena batas waktu, soal yang belum jadi dilewati", user_id)
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
        return results

    def keep_unique(found: Dict[int, PracticeGeneratorAiOutput]) -> None:
        """Masukin soal sesuai urutan nomor, buang yang mirip soal lain di latihan ini."""
        for index in sorted(found):
            candidate = found[index]
            if _too_similar(candidate.question, [item.question for item in accepted.values()], BATCH_SIMILARITY_LIMIT):
                continue
            accepted[index] = candidate

    accepted: Dict[int, PracticeGeneratorAiOutput] = {}
    keep_unique(run_round(list(range(jumlah_soal)), []))

    # Ronde kedua (paralel juga) cuma buat nomor yang gagal/kembar, kalau waktunya masih ada.
    missing = [index for index in range(jumlah_soal) if index not in accepted]
    if missing and time.monotonic() < deadline - 5:
        keep_unique(run_round(missing, [item.question for item in accepted.values()]))

    questions: List[Dict[str, Any]] = [
        {
            "exercise_id": None,
            "type": accepted[index].type,
            "topic": topic_plan[index],
            "question": accepted[index].question,
            "options": accepted[index].options,
            "expected_answer": accepted[index].expected_answer,
            "source": "ai_generated",
        }
        for index in sorted(accepted)
    ]

    status_value = "ready" if len(questions) == jumlah_soal else "partial"
    failure_reason: Optional[str] = None
    if not questions:
        if all_logs and all(entry.alasan_gagal == "ai_error_teknis" for entry in all_logs):
            failure_reason = "ai_unreachable"
        elif not all_logs:
            failure_reason = "timeout"
        else:
            failure_reason = "rejected"
        logger.warning("Latihan AI user %s gagal total: %s", user_id, failure_reason)
    return questions, status_value, failure_reason
