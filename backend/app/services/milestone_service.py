from typing import Any, Dict, List, Optional
from uuid import UUID

from app.database import get_service_client
from app.models.schemas import BadgeOut
from app.services.progress_service import fetch_user_progress_row
from app.utils.helpers import utcnow

SUPPORTED_CRITERIA_TYPES = ("total_xp", "current_streak")


def _fetch_all_badge_definitions() -> List[Dict[str, Any]]:
    client = get_service_client()
    result = (
        client.table("badge")
        .select("badge_id, criteria_type, criteria_value")
        .in_("criteria_type", list(SUPPORTED_CRITERIA_TYPES))
        .execute()
    )
    return result.data


def _fetch_already_earned_badge_ids(user_id: UUID) -> set:
    client = get_service_client()
    result = (
        client.table("user_badge")
        .select("badge_id")
        .eq("user_id", str(user_id))
        .execute()
    )
    return {row["badge_id"] for row in result.data}


def check_and_award_badges(user_id: UUID) -> Optional[BadgeOut]:
    client = get_service_client()
    progress_row = fetch_user_progress_row(user_id)
    badge_definitions = _fetch_all_badge_definitions()
    if not badge_definitions:
        return None

    already_earned_ids = _fetch_already_earned_badge_ids(user_id)

    user_metric_values = {
        "total_xp": progress_row["total_xp"],
        "current_streak": progress_row["current_streak"],
    }

    newly_earned_badge: Optional[Dict[str, Any]] = None
    for badge_def in badge_definitions:
        if badge_def["badge_id"] in already_earned_ids:
            continue
        criteria_type = badge_def["criteria_type"]
        criteria_value = badge_def["criteria_value"]
        current_value = user_metric_values.get(criteria_type)
        if current_value is None:
            continue
        if current_value >= criteria_value:
            newly_earned_badge = badge_def
            break

    if newly_earned_badge is None:
        return None

    earned_at = utcnow()
    client.table("user_badge").insert(
        {
            "user_id": str(user_id),
            "badge_id": newly_earned_badge["badge_id"],
            "earned_at": earned_at.isoformat(),
        }
    ).execute()

    return BadgeOut(
        badge_id=UUID(newly_earned_badge["badge_id"]),
        criteria_type=newly_earned_badge["criteria_type"],
        criteria_value=newly_earned_badge["criteria_value"],
        earned_at=earned_at,
    )
