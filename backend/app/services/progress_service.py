import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.database import get_service_client
from app.models.schemas import BadgeOut, ProgressOut
from app.utils.helpers import utcnow

HEARTS_MIN = 0
HEARTS_MAX = 5

# 1 heart balik 4 menit setelah heart itu hilang. Dihitung pakai jam server (UTC),
# jadi tetap jalan walau app ditutup dan gak bisa dicurangi dengan ubah jam device.
HEART_REGEN_SECONDS = 1080

HEARTS_EMPTY_CODE = "HEARTS_EMPTY"

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


def _clamp_hearts(value: Any) -> int:
    try:
        hearts = int(value)
    except (TypeError, ValueError):
        hearts = HEARTS_MAX
    return max(HEARTS_MIN, min(HEARTS_MAX, hearts))


def _settle_hearts(row: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    """Tambahin heart yang waktunya sudah lewat, rapihin antrean waktu regenerasi.

    Tiap heart yang hilang punya jadwal balik sendiri-sendiri (heart_regen_timestamps).
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

    # Data lama (sebelum ada kolom regenerasi): heart yang kurang tanpa jadwal
    # dianggap baru hilang sekarang.
    missing = HEARTS_MAX - hearts - len(pending)
    if missing > 0:
        pending.extend([now + timedelta(seconds=HEART_REGEN_SECONDS)] * missing)
        pending.sort()
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


def fetch_user_badges(user_id: UUID) -> List[BadgeOut]:
    client = get_service_client()
    result = (
        client.table("user_badge")
        .select("badge_id, earned_at, badge(criteria_type, criteria_value)")
        .eq("user_id", str(user_id))
        .execute()
    )
    badges: List[BadgeOut] = []
    for row in result.data:
        badge_info = row.get("badge") or {}
        badges.append(
            BadgeOut(
                badge_id=UUID(row["badge_id"]),
                criteria_type=badge_info.get("criteria_type", ""),
                criteria_value=badge_info.get("criteria_value", 0),
                earned_at=row["earned_at"],
            )
        )
    return badges


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


def apply_heart_loss(user_id: UUID) -> Dict[str, Any]:
    """Kurangi 1 heart dan jadwalkan heart itu balik 4 menit dari sekarang.

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
        pending = [
            timestamp
            for timestamp in (_parse_timestamp(item) for item in row["heart_regen_timestamps"])
            if timestamp
        ]
        pending.append(now + timedelta(seconds=HEART_REGEN_SECONDS))
        pending.sort()
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
