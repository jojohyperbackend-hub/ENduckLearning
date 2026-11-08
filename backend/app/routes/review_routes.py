from fastapi import APIRouter, HTTPException
from app.database import get_anon_client
from typing import List
from app.models.schemas import (
    ReviewQueueItemOut,
    ReviewAttemptRequest,
    
)

routes = APIRouter(prefix="/review", tags=["Review"])

@routes.get("/queue", response_model=List[ReviewQueueItemOut])
def get_review():
    try:
        supabase = get_anon_client()
        response = (
            supabase.table("review")
            .select("review_id, created_at, exercise(*)")
            .execute()
        )

        
        formatted_queue = []
        for row in response.data:
            formatted_queue.append({
                "review_id": row.get("review_id"),
                "added_at": row.get("created_at"),
                "exercise": row.get("exercise"),
            })
        return formatted_queue
    except Exception as exc:
        raise HTTPException(
            status_code= 500,
            detail=f"Gagal memuat antrian review: {str(exc)}"
        )

@routes.post("/attempt", response_model= [ReviewAttemptRequest])
def post_review(data: ReviewAttemptRequest):
    try:
        supabase = get_anon_client()
        review_item = (
            supabase.table("review")
            .select("review_id, exercise(exercise_id, user_answer)")
            .eq("review_id", str(data.review_id))
            .single()
            .execute()
        )
        if not review_item.data:
            raise HTTPException(
                status_code= 404,
                detail="Sesi review tidak ditemukan di antrean"
            )

        exercise_data = review_item.data.get("exercise")
        correct_answer = exercise_data.get("answer") if exercise_data else None

        #validasi jawaban
        is_correct = False
        if correct_answer and data.user_answer.strip().lower() == str(correct_answer).strip().lower():
            is_correct = True

        #jika jawaban benar
        if is_correct:
            supabase.table("review_queue").delete().eq("id", str(data.review_id)).execute()
            message = "Jawaban benar! Soal telah dihapus dari antrean review."
        else:
            message = "Jawaban kurang tepat. Coba lagi nanti."
            
        return {
            "is_correct": is_correct,
            "correct_answer": correct_answer if not is_correct else None, 
            "message": message
        }

    except HTTPException as he :
        raise he
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memproses jawaban review: {str(exc)}"
        )