from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.middleware import get_current_user_id
from app.config import settings
from app.models.schemas import ApiResponse
from app.services.milestone_service import check_and_award_badges
from app.services.progress_service import add_xp, get_user_progress
from app.utils.helpers import success_response

router = APIRouter(prefix="/progress", tags=["progress"])

# Cheat demo: Ctrl + Alt + X di frontend. Cuma aktif kalau ENVIRONMENT bukan "production",
# jadi aman buat demo/presentasi lokal tapi gak bisa dipakai user di server production.
CHEAT_XP_AMOUNT = 290


def cheats_enabled() -> bool:
    return settings.ENVIRONMENT.strip().lower() != "production"


@router.get("/me", response_model=ApiResponse)
def get_my_progress(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    progress = get_user_progress(user_id)
    return success_response(progress)


@router.post("/cheat-xp", response_model=ApiResponse)
def claim_cheat_xp(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    if not cheats_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    add_xp(user_id, CHEAT_XP_AMOUNT)
    check_and_award_badges(user_id)
    return success_response(get_user_progress(user_id))
