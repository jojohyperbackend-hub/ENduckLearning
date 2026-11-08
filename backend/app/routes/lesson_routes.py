from app.models.schemas import(
    LessonCompleteResultOut,
    LessonDetailOut,
    LessonSummaryOut,
    AttemptStandardRequest

)
from typing import List
from fastapi import APIRouter, HTTPException
from app.database import get_anon_client

routes = APIRouter(prefix="/lessons", tags=["Lessons"])

@routes.get("/{lesson_id}", response_model=[LessonDetailOut])
def get_detail_lesson(lesson_id: str):
    try:
        supabase = get_anon_client()
        response = (
            supabase.table("lessons")
            .select("*, exercises(*)")
            .eq("lesson_id", lesson_id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Lesson tidak ditemukan"
            )

        return response.data

    except HTTPException as he:
        raise he
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memuat data lesson: {str(exc)}"
        )

@routes.post("/{lesson_id}/attempt/standard", response_model=[AttemptStandardRequest])
def post_lesson_standard(exercise_id:str, data: AttemptStandardRequest):
    try:
        supabase = get_anon_client()
        response = supabase.table("user_attempts").insert({
            "exercise_id": exercise_id,
            "user_answer": data.user_answer
        }).execute()

        return {"message": "Jawaban berhasil dikirim", "data": response.data}
    except HTTPException as he:
        raise he
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail= f"Gagal mengirim jawaban: {str(exc)}"
        )