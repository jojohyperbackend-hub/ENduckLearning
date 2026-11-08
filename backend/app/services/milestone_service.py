from typing import Optional
from uuid import UUID

from app.database import get_service_client
from app.models.schemas import BadgeOut
from app.services.progress_service import fetch_user_progress_row

SUPPORTED_CRITERIA_TYPES = ("total_xp", "current_streak")


def _already_has_badge(user_id: UUID, badge_id: str) -> bool:
    service_client = get_service_client()
    result = (
        service_client.table("user_badge")
        .select("user_badge_id")
        .eq("user_id", str(user_id))
        .eq("badge_id", badge_id)
        .execute()
    )
    return bool(result.data)


def _award_badge(user_id: UUID, badge_row: dict) -> BadgeOut:
    service_client = get_service_client()
    insert_result = (
        service_client.table("user_badge")
        .insert({"user_id": str(user_id), "badge_id": badge_row["badge_id"]})
        .execute()
    )
    earned_at = insert_result.data[0]["earned_at"] if insert_result.data else None
    return BadgeOut(
        badge_id=badge_row["badge_id"],
        criteria_type=badge_row["criteria_type"],
        criteria_value=badge_row["criteria_value"],
        earned_at=earned_at,
    )


def check_and_award_badges(user_id: UUID) -> Optional[BadgeOut]:
    service_client = get_service_client()
    badges_result = (
        service_client.table("badge")
        .select("badge_id, criteria_type, criteria_value")
        .in_("criteria_type", list(SUPPORTED_CRITERIA_TYPES))
        .execute()
    )
    badge_rows = badges_result.data or []
    if not badge_rows:
        return None

    progress_row = fetch_user_progress_row(user_id)
    latest_awarded: Optional[BadgeOut] = None

    for badge_row in badge_rows:
        if _already_has_badge(user_id, badge_row["badge_id"]):
            continue

        current_value = progress_row.get(badge_row["criteria_type"])
        if current_value is None:
            continue

        if current_value >= badge_row["criteria_value"]:
            latest_awarded = _award_badge(user_id, badge_row)

    return latest_awarded