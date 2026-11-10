from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import ApiResponse, CourseOut, LessonSummaryOut, UnitWithLessonsOut
from app.utils.cache import content_cache, get_or_set_cache
from app.utils.helpers import success_response

router = APIRouter(tags=["Course"])


@router.get("/courses", response_model=ApiResponse)
def get_courses(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    service_client = get_service_client()
    result = service_client.table("course").select("course_id, title").execute()
    courses = [CourseOut(**row) for row in (result.data or [])]
    return success_response(courses)


def _fetch_units_with_lessons_raw(course_id: str) -> List[dict]:
    service_client = get_service_client()
    result = (
        service_client.table("unit")
        .select("unit_id, course_id, title, order_index, lesson(lesson_id, order_index, xp_reward_base)")
        .eq("course_id", course_id)
        .order("order_index")
        .execute()
    )
    units = result.data or []
    for unit in units:
        unit["lesson"] = sorted(unit.get("lesson") or [], key=lambda item: item["order_index"])
    return units


@router.get("/units/{course_id}", response_model=ApiResponse)
def get_units_by_course(course_id: UUID, user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    cache_key = f"units_by_course:{course_id}"
    units_raw = get_or_set_cache(content_cache, cache_key, lambda: _fetch_units_with_lessons_raw(str(course_id)))

    if not units_raw:
        raise HTTPException(status_code=404, detail="Course gak ketemu atau belum ada unit-nya.")

    flattened_lesson_ids: List[str] = []
    for unit in units_raw:
        for lesson in unit["lesson"]:
            flattened_lesson_ids.append(lesson["lesson_id"])

    service_client = get_service_client()
    progress_result = (
        service_client.table("user_progress")
        .select("current_lesson_id")
        .eq("user_id", str(user_id))
        .execute()
    )
    progress_rows = progress_result.data or []
    current_lesson_id = progress_rows[0]["current_lesson_id"] if progress_rows else None

    if current_lesson_id is not None and current_lesson_id in flattened_lesson_ids:
        current_position = flattened_lesson_ids.index(current_lesson_id)
    else:
        current_position = -1

    units_out: List[UnitWithLessonsOut] = []
    global_index = 0
    for unit in units_raw:
        lessons_out: List[LessonSummaryOut] = []
        for lesson in unit["lesson"]:
            if current_position == -1:
                completed = False
                locked = global_index > 0
            else:
                completed = global_index < current_position
                locked = global_index > current_position
            lessons_out.append(
                LessonSummaryOut(
                    lesson_id=lesson["lesson_id"],
                    order_index=lesson["order_index"],
                    xp_reward_base=lesson["xp_reward_base"],
                    locked=locked,
                    completed=completed,
                )
            )
            global_index += 1

        unit_locked = lessons_out[0].locked if lessons_out else True
        units_out.append(
            UnitWithLessonsOut(
                unit_id=unit["unit_id"],
                course_id=unit["course_id"],
                title=unit["title"],
                order_index=unit["order_index"],
                locked=unit_locked,
                lessons=lessons_out,
            )
        )

    return success_response(units_out)
