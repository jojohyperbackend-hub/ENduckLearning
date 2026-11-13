from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.middleware import get_current_user_id
from app.database import get_service_client
from app.models.schemas import ApiResponse, CourseOut, LessonSummaryOut, UnitWithLessonsOut
from app.services.progress_service import ensure_user_progress_exists
from app.services.unlock_service import (
    compute_unit_states,
    fetch_completed_lesson_ids,
    load_all_courses,
    load_units_with_lessons,
)
from app.utils.cache import get_or_set_cache
from app.utils.helpers import success_response

router = APIRouter(tags=["courses"])


@router.get("/courses", response_model=ApiResponse)
def get_courses() -> ApiResponse:
    courses_data = get_or_set_cache("courses:all", load_all_courses)
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

    ensure_user_progress_exists(user_id)
    units_data = load_units_with_lessons(course_id)
    completed_lesson_ids = fetch_completed_lesson_ids(user_id)

    units_out: List[UnitWithLessonsOut] = []
    for unit_state in compute_unit_states(units_data, completed_lesson_ids):
        units_out.append(
            UnitWithLessonsOut(
                unit_id=UUID(unit_state["unit_id"]),
                course_id=UUID(unit_state["course_id"]),
                title=unit_state["title"],
                order_index=unit_state["order_index"],
                locked=unit_state["locked"],
                lessons=[
                    LessonSummaryOut(
                        lesson_id=UUID(lesson["lesson_id"]),
                        order_index=lesson["order_index"],
                        xp_reward_base=lesson["xp_reward_base"],
                        locked=lesson["locked"],
                        completed=lesson["completed"],
                    )
                    for lesson in unit_state["lessons"]
                ],
            )
        )

    return success_response(units_out)
