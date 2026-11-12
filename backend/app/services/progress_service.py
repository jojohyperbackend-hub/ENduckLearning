from typing import Any, Dict, List, Optional
from uuid import UUID

from app.database import get_service_client
from app.models.schemas import BadgeOut, ProgressOut
from app.utils.helpers import utcnow

HEARTS_MIN = 0
HEARTS_MAX = 5


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
            "last_activity_at": utcnow().isoformat(),
        }
    ).execute()


def fetch_user_progress_row(user_id: UUID) -> Dict[str, Any]:
    client = get_service_client()
    ensure_user_progress_exists(user_id)
    result = (
        client.table("user_progress")
        .select("user_id, total_xp, current_streak, hearts_remaining, current_lesson_id")
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    return result.data[0]


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
        hearts_remaining=progress_row["hearts_remaining"],
        current_lesson_id=UUID(current_lesson_id) if current_lesson_id else None,
        badges=badges,
    )


def add_xp(user_id: UUID, xp_amount: int) -> int:
    client = get_service_client()
    progress_row = fetch_user_progress_row(user_id)
    new_total_xp = progress_row["total_xp"] + xp_amount
    client.table("user_progress").update(
        {"total_xp": new_total_xp, "last_activity_at": utcnow().isoformat()}
    ).eq("user_id", str(user_id)).execute()
    return new_total_xp


def apply_heart_loss(user_id: UUID) -> int:
    client = get_service_client()
    progress_row = fetch_user_progress_row(user_id)
    current_hearts = progress_row["hearts_remaining"]

    if current_hearts <= HEARTS_MIN:
        new_hearts = HEARTS_MAX
    else:
        new_hearts = current_hearts - 1

    client.table("user_progress").update({"hearts_remaining": new_hearts}).eq(
        "user_id", str(user_id)
    ).execute()
    return new_hearts


def reset_hearts(user_id: UUID) -> int:
    client = get_service_client()
    client.table("user_progress").update({"hearts_remaining": HEARTS_MAX}).eq(
        "user_id", str(user_id)
    ).execute()
    return HEARTS_MAX


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
