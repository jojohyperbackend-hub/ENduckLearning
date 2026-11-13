from typing import Any, Dict, List, Set
from uuid import UUID

from app.database import get_service_client
from app.utils.cache import get_or_set_cache

GATE1_MESSAGE = "Selesaikan 1 lesson dulu buat buka Latihan AI"


def load_all_courses() -> List[Dict[str, Any]]:
    client = get_service_client()
    result = client.table("course").select("course_id, title").order("title").execute()
    return result.data


def _load_units_with_lessons_uncached(course_id: str) -> List[Dict[str, Any]]:
    client = get_service_client()
    units_result = (
        client.table("unit")
        .select("unit_id, course_id, title, order_index")
        .eq("course_id", course_id)
        .order("order_index")
        .execute()
    )
    units = [dict(unit_row) for unit_row in units_result.data]
    if not units:
        return []

    lessons_result = (
        client.table("lesson")
        .select("lesson_id, unit_id, order_index, xp_reward_base")
        .in_("unit_id", [unit_row["unit_id"] for unit_row in units])
        .order("order_index")
        .execute()
    )
    lessons_by_unit: Dict[str, List[Dict[str, Any]]] = {}
    for lesson_row in lessons_result.data:
        lessons_by_unit.setdefault(lesson_row["unit_id"], []).append(lesson_row)

    for unit_row in units:
        unit_row["lessons"] = lessons_by_unit.get(unit_row["unit_id"], [])
    return units


def load_units_with_lessons(course_id: UUID) -> List[Dict[str, Any]]:
    return get_or_set_cache(
        f"units:{course_id}", lambda: _load_units_with_lessons_uncached(str(course_id))
    )


def fetch_completed_lesson_ids(user_id: UUID) -> Set[str]:
    client = get_service_client()
    result = (
        client.table("lesson_completion")
        .select("lesson_id")
        .eq("user_id", str(user_id))
        .execute()
    )
    return {row["lesson_id"] for row in result.data}


def compute_unit_states(
    units_data: List[Dict[str, Any]], completed_lesson_ids: Set[str]
) -> List[Dict[str, Any]]:
    """Status kunci tiap unit & lesson. Satu sumber aturan buat /units dan Latihan AI.

    Unit pertama selalu terbuka. Unit berikutnya terbuka kalau semua lesson di unit
    sebelumnya selesai. Di dalam unit, lesson terbuka kalau lesson sebelumnya selesai.
    """
    states: List[Dict[str, Any]] = []
    previous_unit_fully_completed = True

    for unit_row in units_data:
        lesson_states: List[Dict[str, Any]] = []
        previous_lesson_completed_in_unit = True

        for lesson_row in unit_row["lessons"]:
            is_completed = lesson_row["lesson_id"] in completed_lesson_ids
            is_locked = (not previous_unit_fully_completed) or (
                not previous_lesson_completed_in_unit
            )
            lesson_states.append(
                {
                    "lesson_id": lesson_row["lesson_id"],
                    "order_index": lesson_row["order_index"],
                    "xp_reward_base": lesson_row["xp_reward_base"],
                    "locked": is_locked and not is_completed,
                    "completed": is_completed,
                }
            )
            previous_lesson_completed_in_unit = is_completed

        unit_fully_completed = (
            all(lesson["completed"] for lesson in lesson_states) if lesson_states else False
        )
        states.append(
            {
                "unit_id": unit_row["unit_id"],
                "course_id": unit_row["course_id"],
                "title": unit_row["title"],
                "order_index": unit_row["order_index"],
                "locked": not previous_unit_fully_completed,
                "lessons": lesson_states,
            }
        )
        previous_unit_fully_completed = unit_fully_completed

    return states


def has_completed_any_lesson(user_id: UUID) -> bool:
    """Gerbang 1 Latihan AI. Sekali lolos, lolos selamanya (completion gak pernah dihapus)."""
    client = get_service_client()
    result = (
        client.table("lesson_completion")
        .select("lesson_id")
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    return bool(result.data)


def get_unlocked_topics(user_id: UUID) -> List[str]:
    """Topik soal dari semua lesson di unit yang sudah terbuka buat user ini."""
    completed_lesson_ids = fetch_completed_lesson_ids(user_id)
    unlocked_lesson_ids: List[str] = []

    for course in get_or_set_cache("courses:all", load_all_courses):
        units_data = load_units_with_lessons(UUID(course["course_id"]))
        for unit_state in compute_unit_states(units_data, completed_lesson_ids):
            if unit_state["locked"]:
                continue
            unlocked_lesson_ids.extend(lesson["lesson_id"] for lesson in unit_state["lessons"])

    if not unlocked_lesson_ids:
        return []

    client = get_service_client()
    result = (
        client.table("exercise")
        .select("topic")
        .in_("lesson_id", unlocked_lesson_ids)
        .execute()
    )
    return sorted({row["topic"] for row in result.data if row.get("topic")})
