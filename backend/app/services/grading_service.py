"""Penilaian jawaban: pilihan ganda, isian, dan terjemahan.

Urutan penilaian (sama buat lesson, Review, dan Latihan AI):
1. Cek lokal dulu, tanpa AI. Jawaban dinormalisasi (huruf kecil, tanda baca dibuang,
   kontraksi diurai "doesn't" -> "does not", angka 0-20 jadi kata "6" -> "six"), lalu
   dibandingin ke SEMUA kunci jawaban (dipisah "|"). Cocok = benar, hasilnya pasti konsisten.
2. Isian & terjemahan yang belum cocok baru dinilai AI, pakai aturan penilaian yang jelas.
3. Terjemahan yang beda tipis dari kunci (salah ketik 1-2 huruf) tetap dianggap benar,
   walau AI bilang salah.
4. Hasil penilaian AI disimpan sementara: jawaban yang sama buat soal yang sama selalu
   dapat nilai yang sama.
"""

import logging
import re
import threading
from typing import List, Optional

from cachetools import TTLCache
from rapidfuzz import fuzz

from app.models.schemas import TranslateFeedbackAiOutput
from app.services import ai_service

logger = logging.getLogger("app.services.grading_service")

ANSWER_SEPARATOR = "|"
# Jawaban terjemahan yang beda segini tipis dari kunci dianggap cuma salah ketik.
TRANSLATE_TYPO_SIMILARITY = 92.0
FEEDBACK_MAX_LENGTH = 200

_grade_cache: TTLCache = TTLCache(maxsize=20000, ttl=60 * 60 * 24)
_grade_cache_lock = threading.Lock()

_CHARACTER_FIXES = str.maketrans({"’": "'", "‘": "'", "`": "'", "´": "'", "“": '"', "”": '"'})

# Kontraksi yang diurai. "'s" cuma diurai buat kata ganti (it's, he's), biar
# kepemilikan kayak "father's" gak berubah arti.
_CONTRACTIONS = [
    (r"\bcan't\b", "can not"),
    (r"\bcannot\b", "can not"),
    (r"\bwon't\b", "will not"),
    (r"\bshan't\b", "shall not"),
    (r"\bain't\b", "is not"),
    (r"\b(\w+)n't\b", r"\1 not"),
    (r"\b(i)'m\b", r"\1 am"),
    (r"\b(\w+)'re\b", r"\1 are"),
    (r"\b(\w+)'ll\b", r"\1 will"),
    (r"\b(\w+)'ve\b", r"\1 have"),
    (r"\b(\w+)'d\b", r"\1 would"),
    (r"\b(it|he|she|that|there|here|what|where|who|how|this)'s\b", r"\1 is"),
    (r"\blet's\b", "let us"),
]

_NUMBER_WORDS = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
    "eighteen", "nineteen", "twenty",
]


def split_answers(expected_answer: str) -> List[str]:
    return [part.strip() for part in (expected_answer or "").split(ANSWER_SEPARATOR) if part.strip()]


def primary_answer(expected_answer: str) -> str:
    answers = split_answers(expected_answer)
    return answers[0] if answers else ""


def normalize_strict(text: str) -> str:
    """Buat pilihan ganda: cuma huruf kecil, apostrof lurus, spasi rapi, titik akhir dibuang."""
    normalized = (text or "").translate(_CHARACTER_FIXES).lower()
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized.rstrip(".!?,;").strip()


def normalize_loose(text: str) -> str:
    """Buat isian & terjemahan: kontraksi diurai, angka jadi kata, tanda baca dibuang."""
    normalized = (text or "").translate(_CHARACTER_FIXES).lower()
    for pattern, replacement in _CONTRACTIONS:
        normalized = re.sub(pattern, replacement, normalized)
    normalized = re.sub(
        r"\b(\d{1,2})\b",
        lambda match: _NUMBER_WORDS[int(match.group(1))]
        if int(match.group(1)) < len(_NUMBER_WORDS)
        else match.group(1),
        normalized,
    )
    # "a.m." / "p.m." -> "am" / "pm"
    normalized = re.sub(r"\b([ap])\.\s?m\.?", r"\1m", normalized)
    normalized = re.sub(r"[^a-z0-9' ]+", " ", normalized)
    normalized = normalized.replace("'", "")
    return re.sub(r"\s+", " ", normalized).strip()


def _blank_sentence(question: str) -> Optional[str]:
    """Kalimat soal isian yang ada ___-nya, tanpa kalimat perintah dan petunjuk dalam kurung."""
    core = question.split(":", 1)[1] if ":" in question else question
    match = re.search(r"['\"‘’“”]([^'\"‘’“”]*___[^'\"‘’“”]*)['\"‘’“”]", core)
    sentence = match.group(1) if match else core
    if "___" not in sentence:
        return None
    return re.sub(r"\s*\([^)]*\)", "", sentence).strip()


def _matches_locally(exercise_type: str, question: str, user_answer: str, expected_answer: str) -> bool:
    answers = split_answers(expected_answer)
    if not answers or not (user_answer or "").strip():
        return False

    if exercise_type == "multiple_choice":
        user_strict = normalize_strict(user_answer)
        return any(user_strict == normalize_strict(answer) for answer in answers)

    user_loose = normalize_loose(user_answer)
    if not user_loose:
        return False
    if any(user_loose == normalize_loose(answer) for answer in answers):
        return True

    # Isian: user ngetik kalimat lengkap (titik-titik udah diisi) juga diterima.
    if exercise_type == "fill_blank":
        sentence = _blank_sentence(question)
        if sentence:
            for answer in answers:
                if user_loose == normalize_loose(sentence.replace("___", answer)):
                    return True
    return False


def _cache_key(kind: str, question: str, expected_answer: str, user_answer: str) -> str:
    return "\x1f".join([kind, question.strip(), expected_answer.strip(), normalize_loose(user_answer)])


def _cache_get(key: str):
    with _grade_cache_lock:
        return _grade_cache.get(key)


def _cache_set(key: str, value) -> None:
    with _grade_cache_lock:
        _grade_cache[key] = value


def _parse_json_object(content: str) -> dict:
    return ai_service.parse_json_object(content)


def _clip(text: str) -> str:
    text = (text or "").strip()
    if len(text) <= FEEDBACK_MAX_LENGTH:
        return text
    return text[: FEEDBACK_MAX_LENGTH - 3].rstrip() + "..."


# ---------------------------------------------------------------- isian

_FILL_JUDGE_SYSTEM = (
    "Kamu guru bahasa Inggris yang menilai soal isian (fill in the blank). "
    "Jawab HANYA JSON: {\"is_correct\": true/false}."
)


def _judge_fill_with_ai(question: str, user_answer: str, expected_answer: str) -> bool:
    user_prompt = (
        f"Soal: {question}\n"
        f"Kunci jawaban (bisa lebih dari satu, dipisah |): {expected_answer}\n"
        f"Jawaban siswa: {user_answer}\n\n"
        "is_correct = true kalau jawaban siswa, saat dimasukkan ke tempat kosong, menghasilkan "
        "kalimat bahasa Inggris yang BENAR tata bahasanya DAN sesuai petunjuk/maksud soal, "
        "walaupun beda dari kunci (sinonim, bentuk singkat/panjang seperti doesn't = does not, "
        "huruf besar, tanda baca). "
        "is_correct = false kalau tata bahasanya salah (misal bentuk kata kerja atau tense salah), "
        "petunjuk dalam kurung tidak diikuti, atau artinya beda."
    )
    try:
        content, _, _ = ai_service._call_openrouter_raw(_FILL_JUDGE_SYSTEM, user_prompt, max_tokens=60)
        return bool(_parse_json_object(content).get("is_correct") is True)
    except Exception as exc:  # AI error apa pun gak boleh bikin jawaban user error 500
        logger.warning("Penilaian isian AI gagal, dianggap gak cocok: %s", exc)
        return False


def grade_short_answer(exercise_type: str, question: str, user_answer: str, expected_answer: str) -> bool:
    """Nilai pilihan ganda & isian. Pilihan ganda murni lokal; isian dicek AI kalau lokal gak cocok."""
    if _matches_locally(exercise_type, question, user_answer, expected_answer):
        return True
    if exercise_type != "fill_blank":
        return False
    # Jawaban panjang banget (lebih dari kalimat soal) bukan isian, gak usah tanya AI.
    if len(normalize_loose(user_answer).split()) > max(8, len((_blank_sentence(question) or "").split()) + 2):
        return False

    key = _cache_key("fill", question, expected_answer, user_answer)
    cached = _cache_get(key)
    if cached is not None:
        return cached
    verdict = _judge_fill_with_ai(question, user_answer, expected_answer)
    _cache_set(key, verdict)
    return verdict


# ---------------------------------------------------------------- terjemahan

_TRANSLATE_JUDGE_SYSTEM = (
    "Kamu guru bahasa Inggris yang adil dan konsisten, menilai terjemahan Indonesia -> Inggris "
    "dari pelajar pemula. Jawab HANYA satu objek JSON valid dengan field: "
    "is_meaning_correct (boolean), feedback (string Bahasa Indonesia, maksimal 160 karakter), "
    "grammar_note (string singkat atau null)."
)


def _translate_rules(question: str, answers: List[str], user_answer: str) -> str:
    references = "\n".join(f"- {answer}" for answer in answers)
    return (
        f"Soal: {question}\n"
        f"Contoh terjemahan yang benar (BUKAN satu-satunya yang benar):\n{references}\n"
        f"Jawaban siswa: {user_answer}\n\n"
        "is_meaning_correct = true kalau SEMUA ini terpenuhi:\n"
        "1. Maknanya sama dengan kalimat Indonesia (semua informasi penting ada: siapa, melakukan apa, "
        "kapan, di mana).\n"
        "2. Tata bahasanya bisa diterima untuk pemula. Kesalahan kecil yang TIDAK mengubah arti "
        "tetap true: huruf besar/kecil, tanda baca, salah ketik 1-2 huruf, a/an/the yang kurang tepat, "
        "bentuk singkat (it's/it is), angka vs huruf (6/six), urutan kata lain yang wajar, sinonim "
        "(big/large, start/begin), present simple vs continuous kalau konteksnya sama.\n"
        "3. 'Dia' boleh diterjemahkan he ATAU she. 'Kakak/adik' boleh older/younger/big/little/elder.\n"
        "is_meaning_correct = false kalau: ada informasi yang hilang/ditambah/salah, tense mengubah arti "
        "(kemarin tapi pakai present), subjek salah, atau kalimatnya gak bisa dipahami.\n\n"
        "feedback: kalau benar, puji singkat dan sebut versi yang lebih natural kalau ada. "
        "Kalau salah, sebut bagian yang salah dan contoh jawaban benarnya."
    )


def _correct_feedback() -> TranslateFeedbackAiOutput:
    return TranslateFeedbackAiOutput(
        is_meaning_correct=True, feedback="Terjemahan kamu tepat.", grammar_note=None
    )


def grade_translation(question: str, user_answer: str, expected_answer: str) -> TranslateFeedbackAiOutput:
    answers = split_answers(expected_answer) or [expected_answer]
    model_answer = answers[0]

    if _matches_locally("translate", question, user_answer, expected_answer):
        return _correct_feedback()

    user_loose = normalize_loose(user_answer)
    best_similarity = max(
        (fuzz.ratio(user_loose, normalize_loose(answer)) for answer in answers), default=0.0
    )

    key = _cache_key("translate", question, expected_answer, user_answer)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    result: Optional[TranslateFeedbackAiOutput] = None
    try:
        content, _, _ = ai_service._call_openrouter_raw(
            _TRANSLATE_JUDGE_SYSTEM,
            _translate_rules(question, answers, user_answer),
            max_tokens=300,
        )
        parsed = _parse_json_object(content)
        feedback = _clip(str(parsed.get("feedback") or ""))
        if len(feedback) < 5:
            feedback = "Terjemahan kamu tepat." if parsed.get("is_meaning_correct") else _clip(
                f"Belum tepat. Contoh jawaban: {model_answer}"
            )
        grammar_note = parsed.get("grammar_note")
        grammar_note = _clip(str(grammar_note)) if grammar_note and str(grammar_note).strip() else None
        result = TranslateFeedbackAiOutput(
            is_meaning_correct=parsed.get("is_meaning_correct") is True,
            feedback=feedback,
            grammar_note=grammar_note,
        )
    except Exception as exc:  # AI error apa pun gak boleh bikin jawaban user error 500
        logger.warning("Penilaian terjemahan AI gagal, pakai cek lokal: %s", exc)

    if result is None:
        # AI gak bisa dipakai: cuma beda salah ketik yang dianggap benar.
        if best_similarity >= TRANSLATE_TYPO_SIMILARITY:
            return TranslateFeedbackAiOutput(
                is_meaning_correct=True,
                feedback=_clip(f"Benar, cek lagi ejaannya. Contoh jawaban: {model_answer}"),
                grammar_note=None,
            )
        return TranslateFeedbackAiOutput(
            is_meaning_correct=False,
            feedback=_clip(f"Belum sama dengan contoh jawaban: {model_answer}"),
            grammar_note=None,
        )

    if not result.is_meaning_correct and best_similarity >= TRANSLATE_TYPO_SIMILARITY:
        result = TranslateFeedbackAiOutput(
            is_meaning_correct=True,
            feedback=_clip(f"Benar, cuma ada salah ketik kecil. Contoh jawaban: {model_answer}"),
            grammar_note=result.grammar_note,
        )

    _cache_set(key, result)
    return result
