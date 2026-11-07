import math
import re
import statistics
from datetime import datetime, timezone
from typing import Any, List, Literal, Optional

from rapidfuzz import fuzz

from app.models.schemas import ApiResponse, TopicScoreDetail

WILSON_Z_SCORE = 1.96
RECENCY_LAMBDA = 0.099
REPEAT_SCORE_NORMALIZER = math.log(1 + 5)
WILSON_WEIGHT = 0.5
RECENCY_WEIGHT = 0.3
REPEAT_WEIGHT = 0.2
MIN_DATA_PER_TOPIC = 3
WEAK_TOPIC_SIGMA_MULTIPLIER = 0.5
WEAK_TOPIC_ABSOLUTE_MINIMUM = 0.15
MAX_WEAK_TOPICS = 5
GROUNDING_STRONG_THRESHOLD = 0.30
GROUNDING_WEAK_THRESHOLD = 0.15
MAX_SOAL_PER_CALL = 3
MAX_TOKENS_PER_SOAL = 150
MAX_TOKENS_BASE_BUFFER = 100
DUPLICATE_SIMILARITY_THRESHOLD = 95.0

_WORD_PATTERN = re.compile(r"[a-zA-Z0-9']+")
_PLACEHOLDER_PATTERNS = (
    r"\.\.\.",
    r"\bTODO\b",
    r"\bFIXME\b",
    r"\bXXX\b",
    r"\bTBD\b",
    r"\bN/A\b",
    r"\bPLACEHOLDER\b",
    r"lorem ipsum",
)
_PLACEHOLDER_REGEX = re.compile("|".join(_PLACEHOLDER_PATTERNS), re.IGNORECASE)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def success_response(data: Optional[Any] = None) -> ApiResponse:
    return ApiResponse(success=True, data=data, error=None)


def error_response(message: str) -> ApiResponse:
    return ApiResponse(success=False, data=None, error=message)


def calculate_wilson_lower_bound(jumlah_salah: int, jumlah_total_dicoba: int) -> float:
    if jumlah_total_dicoba < MIN_DATA_PER_TOPIC:
        raise ValueError(
            f"jumlah_total_dicoba wajib minimal {MIN_DATA_PER_TOPIC} buat hitung Wilson Score"
        )
    p = jumlah_salah / jumlah_total_dicoba
    n = jumlah_total_dicoba
    z = WILSON_Z_SCORE
    numerator = p + (z ** 2) / (2 * n) - z * math.sqrt((p * (1 - p) + (z ** 2) / (4 * n)) / n)
    denominator = 1 + (z ** 2) / n
    return numerator / denominator


def calculate_recency_score(jumlah_hari_sejak_salah_terakhir: float) -> float:
    if jumlah_hari_sejak_salah_terakhir < 0:
        raise ValueError("jumlah_hari_sejak_salah_terakhir tidak boleh negatif")
    return math.exp(-RECENCY_LAMBDA * jumlah_hari_sejak_salah_terakhir)


def calculate_repeat_score(jumlah_lesson_diulang: int) -> float:
    if jumlah_lesson_diulang < 0:
        raise ValueError("jumlah_lesson_diulang tidak boleh negatif")
    return min(1.0, math.log(1 + jumlah_lesson_diulang) / REPEAT_SCORE_NORMALIZER)


def calculate_combined_topic_score(wilson_lower: float, recency_score: float, repeat_score: float) -> float:
    return (WILSON_WEIGHT * wilson_lower) + (RECENCY_WEIGHT * recency_score) + (REPEAT_WEIGHT * repeat_score)


def determine_weak_topics(topic_scores: List[TopicScoreDetail]) -> List[TopicScoreDetail]:
    eligible = [item for item in topic_scores if item.jumlah_total_dicoba >= MIN_DATA_PER_TOPIC]
    if not eligible:
        return []
    scores = [item.skor_topik for item in eligible]
    mu = statistics.fmean(scores)
    sigma = statistics.pstdev(scores)
    threshold = mu + (WEAK_TOPIC_SIGMA_MULTIPLIER * sigma)
    lolos_topics = {
        item.topic
        for item in eligible
        if item.skor_topik >= threshold and item.skor_topik >= WEAK_TOPIC_ABSOLUTE_MINIMUM
    }
    if lolos_topics:
        lolos_sorted = sorted(
            (item for item in eligible if item.topic in lolos_topics),
            key=lambda item: item.skor_topik,
            reverse=True,
        )[:MAX_WEAK_TOPICS]
        final_weak_topics = {item.topic for item in lolos_sorted}
    else:
        highest = max(eligible, key=lambda item: item.skor_topik)
        final_weak_topics = {highest.topic} if highest.skor_topik >= WEAK_TOPIC_ABSOLUTE_MINIMUM else set()
    return [
        item.model_copy(update={"is_weak": item.topic in final_weak_topics})
        for item in eligible
    ]


def tokenize_words(text: str) -> set:
    return {match.lower() for match in _WORD_PATTERN.findall(text)}


def calculate_grounding_score(konteks_text: str, ai_text: str) -> float:
    kata_konteks = tokenize_words(konteks_text)
    kata_ai = tokenize_words(ai_text)
    gabungan = kata_konteks | kata_ai
    if not gabungan:
        return 0.0
    irisan = kata_konteks & kata_ai
    return len(irisan) / len(gabungan)


def classify_grounding(score: float) -> Literal["STRONG", "WEAK", "NONE"]:
    if score >= GROUNDING_STRONG_THRESHOLD:
        return "STRONG"
    if score >= GROUNDING_WEAK_THRESHOLD:
        return "WEAK"
    return "NONE"


def calculate_max_tokens(jumlah_soal_di_panggilan_ini: int) -> int:
    if jumlah_soal_di_panggilan_ini < 1:
        raise ValueError("jumlah_soal_di_panggilan_ini wajib minimal 1")
    return (MAX_TOKENS_PER_SOAL * jumlah_soal_di_panggilan_ini) + MAX_TOKENS_BASE_BUFFER


def split_jumlah_soal_into_calls(jumlah_soal: int) -> List[int]:
    if jumlah_soal < 1:
        raise ValueError("jumlah_soal wajib minimal 1")
    pembagian: List[int] = []
    sisa = jumlah_soal
    while sisa > 0:
        ambil = min(MAX_SOAL_PER_CALL, sisa)
        pembagian.append(ambil)
        sisa -= ambil
    return pembagian


def contains_placeholder_text(text: str) -> bool:
    return bool(_PLACEHOLDER_REGEX.search(text))


def is_duplicate_question(new_question: str, existing_questions: List[str]) -> bool:
    normalized_new = new_question.strip().lower()
    for existing in existing_questions:
        similarity = fuzz.ratio(normalized_new, existing.strip().lower())
        if similarity >= DUPLICATE_SIMILARITY_THRESHOLD:
            return True
    return False


def is_mc_answer_valid(expected_answer: str, options: Optional[List[str]]) -> bool:
    if options is None:
        return True
    normalized_options = {option.strip().lower() for option in options}
    return expected_answer.strip().lower() in normalized_options