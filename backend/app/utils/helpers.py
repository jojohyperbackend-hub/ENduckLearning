import math
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, TypeVar

from rapidfuzz import fuzz

from app.models.schemas import ApiResponse

WILSON_Z_SCORE = 1.96
RECENCY_LAMBDA = 0.099
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

_PLACEHOLDER_PATTERNS = (
    "lorem ipsum",
    "contoh soal",
    "[isi",
    "placeholder",
    "todo",
    "tbd",
    "xxx",
    "...",
    "soal nomor",
    "pertanyaan disini",
    "jawaban disini",
)

T = TypeVar("T")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def success_response(data: T) -> ApiResponse:
    return ApiResponse(success=True, data=data, error=None)


def error_response(message: str) -> ApiResponse:
    return ApiResponse(success=False, data=None, error=message)


def calculate_wilson_lower_bound(jumlah_benar: int, jumlah_total: int) -> float:
    if jumlah_total <= 0:
        return 0.0
    z = WILSON_Z_SCORE
    n = float(jumlah_total)
    p_hat = float(jumlah_benar) / n
    denominator = 1.0 + (z * z) / n
    centre = p_hat + (z * z) / (2.0 * n)
    margin = z * math.sqrt((p_hat * (1.0 - p_hat) / n) + (z * z) / (4.0 * n * n))
    lower_bound = (centre - margin) / denominator
    return max(0.0, min(1.0, lower_bound))


def calculate_recency_score(hari_sejak_terakhir_salah: Optional[float]) -> float:
    if hari_sejak_terakhir_salah is None:
        return 0.0
    hari = max(0.0, hari_sejak_terakhir_salah)
    return math.exp(-RECENCY_LAMBDA * hari)


def calculate_repeat_score(jumlah_salah: int, jumlah_total: int) -> float:
    if jumlah_total <= 0:
        return 0.0
    return min(1.0, float(jumlah_salah) / float(jumlah_total))


def calculate_combined_topic_score(
    wilson_lower: float, recency_score: float, repeat_score: float
) -> float:
    kesalahan_rate = 1.0 - wilson_lower
    skor = (0.5 * kesalahan_rate) + (0.3 * recency_score) + (0.2 * repeat_score)
    return max(0.0, min(1.0, skor))


def determine_weak_topics(topic_scores: Dict[str, float], jumlah_data_per_topic: Dict[str, int]) -> List[str]:
    eligible_topics = {
        topic: score
        for topic, score in topic_scores.items()
        if jumlah_data_per_topic.get(topic, 0) >= MIN_DATA_PER_TOPIC
    }
    if not eligible_topics:
        return []

    scores = list(eligible_topics.values())
    mean_score = sum(scores) / len(scores)
    if len(scores) > 1:
        variance = sum((s - mean_score) ** 2 for s in scores) / len(scores)
        std_dev = math.sqrt(variance)
    else:
        std_dev = 0.0

    threshold = max(
        WEAK_TOPIC_ABSOLUTE_MINIMUM, mean_score + (WEAK_TOPIC_SIGMA_MULTIPLIER * std_dev)
    )

    weak_topics = [topic for topic, score in eligible_topics.items() if score >= threshold]
    weak_topics.sort(key=lambda t: eligible_topics[t], reverse=True)
    return weak_topics[:MAX_WEAK_TOPICS]


def tokenize_words(text: str) -> List[str]:
    if not text:
        return []
    lowered = text.lower()
    tokens = re.findall(r"[a-z0-9']+", lowered)
    return tokens


def calculate_grounding_score(generated_text: str, source_context: str) -> float:
    generated_tokens = set(tokenize_words(generated_text))
    source_tokens = set(tokenize_words(source_context))
    if not generated_tokens or not source_tokens:
        return 0.0
    overlap = generated_tokens.intersection(source_tokens)
    return len(overlap) / len(generated_tokens)


def classify_grounding(score: float) -> str:
    if score >= GROUNDING_STRONG_THRESHOLD:
        return "STRONG"
    if score >= GROUNDING_WEAK_THRESHOLD:
        return "WEAK"
    return "NONE"


def calculate_max_tokens(jumlah_soal: int) -> int:
    return MAX_TOKENS_BASE_BUFFER + (jumlah_soal * MAX_TOKENS_PER_SOAL)


def split_jumlah_soal_into_calls(jumlah_soal: int) -> List[int]:
    if jumlah_soal <= 0:
        return []
    calls: List[int] = []
    remaining = jumlah_soal
    while remaining > 0:
        batch = min(MAX_SOAL_PER_CALL, remaining)
        calls.append(batch)
        remaining -= batch
    return calls


def contains_placeholder_text(text: str) -> bool:
    if not text:
        return True
    lowered = text.lower().strip()
    if lowered == "":
        return True
    return any(pattern in lowered for pattern in _PLACEHOLDER_PATTERNS)


def is_duplicate_question(candidate_question: str, existing_questions: List[str]) -> bool:
    for existing in existing_questions:
        similarity = fuzz.ratio(candidate_question.lower().strip(), existing.lower().strip())
        if similarity >= DUPLICATE_SIMILARITY_THRESHOLD:
            return True
    return False


def is_mc_answer_valid(expected_answer: str, options: Optional[List[str]]) -> bool:
    if not options:
        return False
    normalized_options = [option.strip().lower() for option in options]
    return expected_answer.strip().lower() in normalized_options
