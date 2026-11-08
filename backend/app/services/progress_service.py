from typing import List
from uuid import UUID

from app.database import get_service_client
from app.models.schemas import BadgeOut, ProgressOut

HEARTS_MIN = 0
HEARTS_MAX = 5


def ensure_user_progress_exists(user_id: UUID) -> None:
    service_client = get_service_client()
    existing = service_client.table("user_progress").select("user_id").eq("user_id", str(user_id)).execute()
    if not existing.data:
        service_client.table("user_progress").insert({"user_id": str(user_id)}).execute()


def fetch_user_progress_row(user_id: UUID) -> dict:
    service_client = get_service_client()
    result = service_client.table("user_progress").select("*").eq("user_id", str(user_id)).execute()
    rows = result.data or []
    if not rows:
        ensure_user_progress_exists(user_id)
        result = service_client.table("user_progress").select("*").eq("user_id", str(user_id)).execute()
        rows = result.data or []
    return rows[0]


def fetch_user_badges(user_id: UUID) -> List[BadgeOut]:
    service_client = get_service_client()
    result = (
        service_client.table("user_badge")
        .select("earned_at, badge(badge_id, criteria_type, criteria_value)")
        .eq("user_id", str(user_id))
        .execute()
    )
    badges: List[BadgeOut] = []
    for row in result.data or []:
        badge_data = row.get("badge")
        if not badge_data:
            continue
        badges.append(
            BadgeOut(
                badge_id=badge_data["badge_id"],
                criteria_type=badge_data["criteria_type"],
                criteria_value=badge_data["criteria_value"],
                earned_at=row["earned_at"],
            )
        )
    return badges


def get_user_progress(user_id: UUID) -> ProgressOut:
    progress_row = fetch_user_progress_row(user_id)
    badges = fetch_user_badges(user_id)
    return ProgressOut(
        user_id=progress_row["user_id"],
        total_xp=progress_row["total_xp"],
        current_streak=progress_row["current_streak"],
        hearts_remaining=progress_row["hearts_remaining"],
        current_lesson_id=progress_row.get("current_lesson_id"),
        badges=badges,
    )


def add_xp(user_id: UUID, amount: int) -> int:
    progress_row = fetch_user_progress_row(user_id)
    if amount <= 0:
        return progress_row["total_xp"]
    new_total = progress_row["total_xp"] + amount
    get_service_client().table("user_progress").update({"total_xp": new_total}).eq("user_id", str(user_id)).execute()
    return new_total


def apply_heart_loss(user_id: UUID) -> int:
    progress_row = fetch_user_progress_row(user_id)
    new_hearts = progress_row["hearts_remaining"] - 1
    if new_hearts <= HEARTS_MIN:
        new_hearts = HEARTS_MAX
    get_service_client().table("user_progress").update({"hearts_remaining": new_hearts}).eq(
        "user_id", str(user_id)
    ).execute()
    return new_hearts


def reset_hearts(user_id: UUID) -> None:
    get_service_client().table("user_progress").update({"hearts_remaining": HEARTS_MAX}).eq(
        "user_id", str(user_id)
    ).execute()


def update_current_lesson(user_id: UUID, lesson_id: UUID) -> None:
    get_service_client().table("user_progress").update({"current_lesson_id": str(lesson_id)}).eq(
        "user_id", str(user_id)
    ).execute()


def update_streak(user_id: UUID, new_streak: int) -> None:
    get_service_client().table("user_progress").update({"current_streak": max(0, new_streak)}).eq(
        "user_id", str(user_id)
    ).execute()