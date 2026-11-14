import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.database import get_service_client
from app.models.schemas import BadgeOut
from app.services.progress_service import fetch_lesson_answer_streaks, fetch_user_progress_row
from app.utils.helpers import utcnow

logger = logging.getLogger("app.services.milestone_service")

# Jenis syarat badge yang dihitung server (bukan AI):
#   total_xp               -> Calon Juara (450), Sang Juara (1800)
#   current_streak         -> streak hari belajar (badge lama, kalau ada)
#   lesson_correct_streak  -> Cie Udah Compe Nih (bener 4x berturut di lesson)
#   lesson_wrong_streak    -> Miss Mulu (salah lebih dari 5x berturut di lesson = 6x)
SUPPORTED_CRITERIA_TYPES = (
    "total_xp",
    "current_streak",
    "lesson_correct_streak",
    "lesson_wrong_streak",
)

# Badge berjenjang: badge kiri cuma bisa didapet kalau udah punya badge kanan.
# Sang Juara (1800 XP) butuh Calon Juara (450 XP) dulu.
BADGE_PREREQUISITES = {
    "sang_juara": "calon_juara",
}

_BADGE_COLUMNS_FULL = "badge_id, name, code, criteria_type, criteria_value"
_BADGE_COLUMNS_LEGACY = "badge_id, criteria_type, criteria_value"


def _fetch_all_badge_definitions() -> List[Dict[str, Any]]:
    client = get_service_client()
    try:
        result = (
            client.table("badge")
            .select(_BADGE_COLUMNS_FULL)
            .in_("criteria_type", list(SUPPORTED_CRITERIA_TYPES))
            .execute()
        )
    except Exception:
        logger.warning("Kolom badge.name/code belum ada, jalanin migrations/005_badges.sql")
        result = (
            client.table("badge")
            .select(_BADGE_COLUMNS_LEGACY)
            .in_("criteria_type", list(SUPPORTED_CRITERIA_TYPES))
            .execute()
        )
    # Urut dari syarat paling gampang, biar badge yang kebuka bareng urutannya masuk akal.
    return sorted(result.data, key=lambda row: (row["criteria_type"], row["criteria_value"]))


def _fetch_already_earned_badge_ids(user_id: UUID) -> set:
    client = get_service_client()
    result = (
        client.table("user_badge")
        .select("badge_id")
        .eq("user_id", str(user_id))
        .execute()
    )
    return {row["badge_id"] for row in result.data}


def _user_metric_values(
    user_id: UUID, lesson_streaks: Optional[Dict[str, int]]
) -> Dict[str, int]:
    progress_row = fetch_user_progress_row(user_id)
    streaks = lesson_streaks if lesson_streaks is not None else fetch_lesson_answer_streaks(user_id)
    return {
        "total_xp": int(progress_row["total_xp"]),
        "current_streak": int(progress_row["current_streak"]),
        "lesson_correct_streak": int(streaks.get("lesson_correct_streak", 0)),
        "lesson_wrong_streak": int(streaks.get("lesson_wrong_streak", 0)),
    }


def award_new_badges(
    user_id: UUID, lesson_streaks: Optional[Dict[str, int]] = None
) -> List[BadgeOut]:
    """Kasih SEMUA badge yang syaratnya udah kepenuhin dan belum dimiliki user.

    lesson_streaks: counter streak yang barusan diupdate (biar gak baca ulang database).
    Badge yang udah didapet gak pernah dicabut, walau XP turun atau streak putus.
    """
    badge_definitions = _fetch_all_badge_definitions()
    if not badge_definitions:
        return []

    already_earned_ids = _fetch_already_earned_badge_ids(user_id)
    metric_values = _user_metric_values(user_id, lesson_streaks)

    badge_id_by_code = {
        row["code"]: row["badge_id"] for row in badge_definitions if row.get("code")
    }

    client = get_service_client()
    newly_earned: List[BadgeOut] = []
    # Urutan definisi udah dari syarat paling kecil, jadi kalau XP langsung lompat
    # lewat 1800, Calon Juara dikasih duluan baru Sang Juara di putaran yang sama.
    for badge_def in badge_definitions:
        if badge_def["badge_id"] in already_earned_ids:
            continue
        current_value = metric_values.get(badge_def["criteria_type"])
        if current_value is None or current_value < badge_def["criteria_value"]:
            continue
        required_code = BADGE_PREREQUISITES.get(badge_def.get("code") or "")
        if required_code:
            required_id = badge_id_by_code.get(required_code)
            if required_id is None or required_id not in already_earned_ids:
                continue

        earned_at = utcnow()
        try:
            client.table("user_badge").insert(
                {
                    "user_id": str(user_id),
                    "badge_id": badge_def["badge_id"],
                    "earned_at": earned_at.isoformat(),
                }
            ).execute()
        except Exception:
            # Gagal nyimpen badge (misal foreign key user_badge -> users, lihat
            # migrations/006_user_fk_fix.sql) gak boleh bikin jawaban/XP user jadi error 500.
            logger.exception("Gagal nyimpen badge %s buat user %s", badge_def["badge_id"], user_id)
            continue
        already_earned_ids.add(badge_def["badge_id"])
        newly_earned.append(
            BadgeOut(
                badge_id=UUID(badge_def["badge_id"]),
                name=badge_def.get("name"),
                code=badge_def.get("code"),
                criteria_type=badge_def["criteria_type"],
                criteria_value=badge_def["criteria_value"],
                earned_at=earned_at,
            )
        )
    return newly_earned


def check_and_award_badges(
    user_id: UUID, lesson_streaks: Optional[Dict[str, int]] = None
) -> Optional[BadgeOut]:
    """Kasih semua badge baru, return yang pertama buat ditampilin di respons.
    Sisanya tetep kesimpen dan muncul di halaman Progress."""
    newly_earned = award_new_badges(user_id, lesson_streaks)
    return newly_earned[0] if newly_earned else None
