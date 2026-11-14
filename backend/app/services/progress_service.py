import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.database import get_service_client
from app.models.schemas import BadgeOut, ProgressOut
from app.utils.helpers import utcnow

HEARTS_MIN = 0
HEARTS_MAX = 5

# Heart balik satu-satu, ngantre berurutan:
# - heart pertama di antrean balik 18 menit setelah hilang,
# - tiap heart berikutnya balik 7 menit setelah heart sebelumnya balik.
# Kurang 1 heart = 18 menit. Habis semua (5 heart) = 18 + 4 x 7 = 46 menit sampai penuh.
# Contoh: salah 18:00 -> balik 18:18. Salah lagi 18:00:20 -> balik 18:25 (bukan 18:18:20).
# Dihitung pakai jam server (UTC), tetap jalan walau app ditutup dan gak bisa dicurangi
# dengan ubah jam device.
HEART_FIRST_REGEN_SECONDS = 18 * 60
HEART_NEXT_REGEN_SECONDS = 7 * 60

HEARTS_EMPTY_CODE = "HEARTS_EMPTY"

logger = logging.getLogger("app.services.progress_service")

_PROGRESS_COLUMNS = (
    "user_id, total_xp, current_streak, hearts_remaining, current_lesson_id, heart_regen_timestamps"
)
_MAX_UPDATE_RETRIES = 3


class HeartsEmptyError(Exception):
    def __init__(self) -> None:
        super().__init__(HEARTS_EMPTY_CODE)


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _serialize_timestamps(timestamps: List[datetime]) -> List[str]:
    return [timestamp.astimezone(timezone.utc).isoformat() for timestamp in timestamps]


def _next_regen_slot(pending: List[datetime], now: datetime) -> datetime:
    """Jadwal balik heart yang baru hilang.

    Antrean kosong (semua heart lain udah balik) -> 18 menit dari sekarang.
    Masih ada heart yang nunggu -> 7 menit setelah heart terakhir di antrean balik.
    """
    waiting = [timestamp for timestamp in pending if timestamp > now]
    if not waiting:
        return now + timedelta(seconds=HEART_FIRST_REGEN_SECONDS)
    return max(waiting) + timedelta(seconds=HEART_NEXT_REGEN_SECONDS)


def _clamp_hearts(value: Any) -> int:
    try:
        hearts = int(value)
    except (TypeError, ValueError):
        hearts = HEARTS_MAX
    return max(HEARTS_MIN, min(HEARTS_MAX, hearts))


def _settle_hearts(row: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    """Tambahin heart yang waktunya sudah lewat, rapihin antrean waktu regenerasi.

    heart_regen_timestamps = antrean jam balik tiap heart yang hilang, berurutan
    dengan jarak minimal 7 menit satu sama lain.
    Return dict berisi hearts & pending terbaru plus flag changed kalau perlu disimpan.
    """
    original_hearts = row.get("hearts_remaining")
    raw_pending = row.get("heart_regen_timestamps") or []
    if not isinstance(raw_pending, list):
        raw_pending = []

    hearts = _clamp_hearts(original_hearts)
    pending = sorted(
        timestamp for timestamp in (_parse_timestamp(item) for item in raw_pending) if timestamp
    )

    # Antrean dari versi lama (jarak 4 menit atau paralel) dirapihin:
    # tiap jadwal minimal 7 menit setelah jadwal sebelumnya.
    for position in range(1, len(pending)):
        earliest = pending[position - 1] + timedelta(seconds=HEART_NEXT_REGEN_SECONDS)
        if pending[position] < earliest:
            pending[position] = earliest

    # Data lama (sebelum ada kolom regenerasi): heart yang kurang tanpa jadwal
    # dianggap baru hilang sekarang, masuk antrean paling belakang.
    missing = HEARTS_MAX - hearts - len(pending)
    if missing > 0:
        for _ in range(missing):
            pending.append(_next_regen_slot(pending, now))
    elif missing < 0:
        pending = pending[: HEARTS_MAX - hearts]

    due_count = sum(1 for timestamp in pending if timestamp <= now)
    if due_count:
        hearts = min(HEARTS_MAX, hearts + due_count)
        pending = [timestamp for timestamp in pending if timestamp > now]
    if hearts >= HEARTS_MAX:
        pending = []

    serialized = _serialize_timestamps(pending)
    changed = original_hearts != hearts or [str(item) for item in raw_pending] != serialized
    return {"hearts": hearts, "pending": pending, "serialized": serialized, "changed": changed}


def heart_fields(row: Dict[str, Any], now: Optional[datetime] = None) -> Dict[str, Any]:
    """Field heart yang dikirim ke frontend: jumlah heart + sisa detik tiap heart balik.

    Sisa detik dihitung di server, frontend cukup hitung mundur sendiri tiap detik.
    """
    current_time = now or utcnow()
    pending = sorted(
        timestamp
        for timestamp in (_parse_timestamp(item) for item in row.get("heart_regen_timestamps") or [])
        if timestamp
    )
    regen_seconds = [
        max(1, math.ceil((timestamp - current_time).total_seconds())) for timestamp in pending
    ]
    return {
        "hearts_remaining": _clamp_hearts(row.get("hearts_remaining")),
        "heart_max": HEARTS_MAX,
        "heart_regen_in_seconds": regen_seconds,
        "next_heart_in_seconds": regen_seconds[0] if regen_seconds else None,
    }


def ensure_user_progress_exists(user_id: UUID) -> None:
    client = get_service_client()
    existing = (
        client.table("user_progress")
        .select("user_id")
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    if existing.data:
        return

    client.table("user_progress").insert(
        {
            "user_id": str(user_id),
            "total_xp": 0,
            "current_streak": 0,
            "hearts_remaining": HEARTS_MAX,
            "current_lesson_id": None,
            "heart_regen_timestamps": [],
        }
    ).execute()


def fetch_user_progress_row(user_id: UUID) -> Dict[str, Any]:
    """Ambil baris progress dengan heart yang sudah diperbarui sesuai jam sekarang."""
    client = get_service_client()
    ensure_user_progress_exists(user_id)
    result = (
        client.table("user_progress")
        .select(_PROGRESS_COLUMNS)
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    row = dict(result.data[0])

    settled = _settle_hearts(row, utcnow())
    if settled["changed"]:
        client.table("user_progress").update(
            {
                "hearts_remaining": settled["hearts"],
                "heart_regen_timestamps": settled["serialized"],
            }
        ).eq("user_id", str(user_id)).execute()
    row["hearts_remaining"] = settled["hearts"]
    row["heart_regen_timestamps"] = settled["serialized"]
    return row


def require_hearts(user_id: UUID) -> Dict[str, Any]:
    """Jaring pengaman API: tolak proses jawaban kalau heart di database 0."""
    row = fetch_user_progress_row(user_id)
    if row["hearts_remaining"] <= HEARTS_MIN:
        raise HeartsEmptyError()
    return row


_BADGE_JOIN_FULL = "badge_id, earned_at, badge(name, code, criteria_type, criteria_value)"
_BADGE_JOIN_LEGACY = "badge_id, earned_at, badge(criteria_type, criteria_value)"


def fetch_user_badges(user_id: UUID) -> List[BadgeOut]:
    client = get_service_client()
    try:
        result = (
            client.table("user_badge")
            .select(_BADGE_JOIN_FULL)
            .eq("user_id", str(user_id))
            .execute()
        )
    except Exception:
        # Kolom name/code belum ada (migration 005 belum dijalanin): tetep tampilin badge lama.
        logger.warning("Kolom badge.name/code belum ada, jalanin migrations/005_badges.sql")
        result = (
            client.table("user_badge")
            .select(_BADGE_JOIN_LEGACY)
            .eq("user_id", str(user_id))
            .execute()
        )
    badges: List[BadgeOut] = []
    for row in result.data:
        badge_info = row.get("badge") or {}
        badges.append(
            BadgeOut(
                badge_id=UUID(row["badge_id"]),
                name=badge_info.get("name"),
                code=badge_info.get("code"),
                criteria_type=badge_info.get("criteria_type", ""),
                criteria_value=badge_info.get("criteria_value", 0),
                earned_at=row["earned_at"],
            )
        )
    return badges


def fetch_lesson_answer_streaks(user_id: UUID) -> Dict[str, int]:
    """Jumlah jawaban bener/salah berturut-turut di lesson (lintas lesson/unit)."""
    client = get_service_client()
    ensure_user_progress_exists(user_id)
    try:
        result = (
            client.table("user_progress")
            .select("lesson_correct_streak, lesson_wrong_streak")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
    except Exception:
        logger.warning("Kolom streak lesson belum ada, jalanin migrations/005_badges.sql")
        return {"lesson_correct_streak": 0, "lesson_wrong_streak": 0}
    row = result.data[0] if result.data else {}
    return {
        "lesson_correct_streak": int(row.get("lesson_correct_streak") or 0),
        "lesson_wrong_streak": int(row.get("lesson_wrong_streak") or 0),
    }


def record_lesson_answer(user_id: UUID, is_correct: bool) -> Dict[str, int]:
    """Catat 1 jawaban lesson. Bener: counter bener +1, counter salah balik 0. Salah: kebalikannya."""
    current = fetch_lesson_answer_streaks(user_id)
    if is_correct:
        updated = {
            "lesson_correct_streak": current["lesson_correct_streak"] + 1,
            "lesson_wrong_streak": 0,
        }
    else:
        updated = {
            "lesson_correct_streak": 0,
            "lesson_wrong_streak": current["lesson_wrong_streak"] + 1,
        }
    client = get_service_client()
    try:
        client.table("user_progress").update(updated).eq("user_id", str(user_id)).execute()
    except Exception:
        logger.warning("Gagal simpan streak lesson, jalanin migrations/005_badges.sql")
    return updated


def get_user_progress(user_id: UUID) -> ProgressOut:
    progress_row = fetch_user_progress_row(user_id)
    badges = fetch_user_badges(user_id)
    current_lesson_id = progress_row.get("current_lesson_id")
    return ProgressOut(
        user_id=user_id,
        total_xp=progress_row["total_xp"],
        current_streak=progress_row["current_streak"],
        current_lesson_id=UUID(current_lesson_id) if current_lesson_id else None,
        badges=badges,
        **heart_fields(progress_row),
    )


def add_xp(user_id: UUID, xp_amount: int) -> int:
    client = get_service_client()
    progress_row = fetch_user_progress_row(user_id)
    new_total_xp = progress_row["total_xp"] + xp_amount
    client.table("user_progress").update({"total_xp": new_total_xp}).eq(
        "user_id", str(user_id)
    ).execute()
    return new_total_xp


def deduct_xp(user_id: UUID, xp_amount: int) -> int:
    """Potong XP, total gak pernah di bawah 0. Return jumlah XP yang beneran kepotong."""
    client = get_service_client()
    progress_row = fetch_user_progress_row(user_id)
    current_xp = max(0, int(progress_row["total_xp"]))
    deducted = min(current_xp, max(0, xp_amount))
    if deducted:
        client.table("user_progress").update({"total_xp": current_xp - deducted}).eq(
            "user_id", str(user_id)
        ).execute()
    return deducted


def apply_heart_loss(user_id: UUID) -> Dict[str, Any]:
    """Kurangi 1 heart dan taruh di antrean balik: 7 menit setelah heart terakhir
    di antrean balik, atau 18 menit dari sekarang kalau antrean kosong.

    Update cuma jalan kalau jumlah heart di database masih sama dengan yang dibaca,
    jadi 2 tab yang jawab barengan gak bisa bikin heart minus.
    Raise HeartsEmptyError kalau heart sudah 0.
    """
    client = get_service_client()
    for _ in range(_MAX_UPDATE_RETRIES):
        row = fetch_user_progress_row(user_id)
        current_hearts = row["hearts_remaining"]
        if current_hearts <= HEARTS_MIN:
            raise HeartsEmptyError()

        now = utcnow()
        pending = sorted(
            timestamp
            for timestamp in (_parse_timestamp(item) for item in row["heart_regen_timestamps"])
            if timestamp
        )
        pending.append(_next_regen_slot(pending, now))
        serialized = _serialize_timestamps(pending)
        new_hearts = current_hearts - 1

        result = (
            client.table("user_progress")
            .update({"hearts_remaining": new_hearts, "heart_regen_timestamps": serialized})
            .eq("user_id", str(user_id))
            .eq("hearts_remaining", current_hearts)
            .execute()
        )
        if result.data:
            row["hearts_remaining"] = new_hearts
            row["heart_regen_timestamps"] = serialized
            return row

    raise RuntimeError("Gagal memperbarui heart karena ada perubahan bersamaan, coba lagi")


def update_current_lesson(user_id: UUID, lesson_id: Optional[UUID]) -> None:
    client = get_service_client()
    client.table("user_progress").update(
        {"current_lesson_id": str(lesson_id) if lesson_id else None}
    ).eq("user_id", str(user_id)).execute()


def update_streak(user_id: UUID, new_streak: int) -> None:
    client = get_service_client()
    client.table("user_progress").update({"current_streak": new_streak}).eq(
        "user_id", str(user_id)
    ).execute()
