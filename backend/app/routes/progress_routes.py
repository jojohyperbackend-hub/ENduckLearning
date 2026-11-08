from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.middleware import get_current_user_id
from app.models.schemas import ApiResponse
from app.services.progress_service import get_user_progress
from app.utils.helpers import success_response

router = APIRouter(prefix="/progress", tags=["Progress"])


@router.get("/me", response_model=ApiResponse)
def get_my_progress(user_id: UUID = Depends(get_current_user_id)) -> ApiResponse:
    progress = get_user_progress(user_id)
    return success_response(progress)
