from app.models.schemas import (
    CourseOut,
    UnitWithLessonsOut
)
from typing import List
from fastapi import APIRouter, HTTPException
from app.database import get_anon_client

routes = APIRouter(prefix="/courses", tags=["Course"])

@routes.get("", response_model=[CourseOut])
def get_course():
    try:
        supabase = get_anon_client()
        response = supabase.table("courses").select("*").execute()

        return response.data
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil daftar course {str(exc)}" 
        )

@routes.get("/{course_id}/units", response_model=List[UnitWithLessonsOut])
def get_unit_by_course(course_id: str):
    try:
        supabase = get_anon_client()
        response = (
            supabase.table("units")
            .select("*, lessons(*)")
            .eq("course_id", course_id)
            .execute()
        )
        return response.data
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail= f"Gagal mengambil unit dan lesson: {str(exc)}"
        )

