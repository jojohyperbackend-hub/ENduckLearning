from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import ApiResponse, CourseOut, LessonSummaryOut, UnitWithLessonsOut
from app.services.progress_service import fetch_user_progress_row
from app.utils.cache import get_or_set_cache
from app.utils.helpers import error_response, success_response

router = APIRouter(tags=["courses"])


def _load_all_courses() -> List[Dict[str, Any]]:
    client = get_service_client()
    result = client.table("course").select("course_id, title").order("title").execute()
    return result.data


def _load_units_with_lessons(course_id: UUID) -> List[Dict[str, Any]]:
    client = get_service_client()
    units_result = (
        client.table("unit")
        .select("unit_id, course_id, title, order_index")
        .eq("course_id", str(course_id))
        .order("order_index")
        .execute()
    )
    units = units_result.data

    lessons_result = (
        client.table("lesson")
        .select("lesson_id, unit_id, order_index, xp_reward_base")
        .in_("unit_id", [u["unit_id"] for u in units])
        .order("order_index")
        .execute()
    )
    lessons_by_unit: Dict[str, List[Dict[str, Any]]] = {}
    for lesson_row in lessons_result.data:
        lessons_by_unit.setdefault(lesson_row["unit_id"], []).append(lesson_row)

    for unit_row in units:
        unit_row["lessons"] = lessons_by_unit.get(unit_row["unit_id"], [])

    return units


@router.get("/courses", response_model=ApiResponse)
def get_courses() -> ApiResponse:
    courses_data = get_or_set_cache("courses:all", _load_all_courses)
    courses = [CourseOut(course_id=UUID(c["course_id"]), title=c["title"]) for c in courses_data]
    return success_response(courses)


@router.get("/units/{course_id}", response_model=ApiResponse)
def get_units(course_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    client = get_service_client()
    course_check = (
        client.table("course")
        .select("course_id")
        .eq("course_id", str(course_id))
        .limit(1)
        .execute()
    )
    if not course_check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course tidak ditemukan")

    units_data = get_or_set_cache(
        f"units:{course_id}", lambda: _load_units_with_lessons(course_id)
    )

    progress_row = fetch_user_progress_row(user_id)
    current_lesson_id = progress_row.get("current_lesson_id")

    completed_lessons_result = (
        client.table("lesson_completion")
        .select("lesson_id")
        .eq("user_id", str(user_id))
        .execute()
    )
    completed_lesson_ids = {row["lesson_id"] for row in completed_lessons_result.data}

    units_out: List[UnitWithLessonsOut] = []
    previous_unit_fully_completed = True

    for unit_row in units_data:
        lessons_out: List[LessonSummaryOut] = []
        previous_lesson_completed_in_unit = True

        for lesson_row in unit_row["lessons"]:
            lesson_id = lesson_row["lesson_id"]
            is_completed = lesson_id in completed_lesson_ids
            is_locked = (not previous_unit_fully_completed) or (not previous_lesson_completed_in_unit)

            lessons_out.append(
                LessonSummaryOut(
                    lesson_id=UUID(lesson_id),
                    order_index=lesson_row["order_index"],
                    xp_reward_base=lesson_row["xp_reward_base"],
                    locked=is_locked and not is_completed,
                    completed=is_completed,
                )
            )
            previous_lesson_completed_in_unit = is_completed

        unit_fully_completed = all(lo.completed for lo in lessons_out) if lessons_out else False
        unit_locked = not previous_unit_fully_completed

        units_out.append(
            UnitWithLessonsOut(
                unit_id=UUID(unit_row["unit_id"]),
                course_id=UUID(unit_row["course_id"]),
                title=unit_row["title"],
                order_index=unit_row["order_index"],
                locked=unit_locked,
                lessons=lessons_out,
            )
        )
        previous_unit_fully_completed = unit_fully_completed

    return success_response(units_out)
