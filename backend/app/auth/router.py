from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi import status as http_status

from app.auth.middleware import (
    ACCESS_TOKEN_COOKIE_NAME,
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_TTL_SECONDS,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.database import get_anon_client, get_service_client
from app.models.schemas import ApiResponse, AuthUserData, GoogleCallbackRequest
from app.utils.helpers import error_response, success_response

router = APIRouter(prefix="/auth", tags=["auth"])

SESI_HABIS_MESSAGE = "Sesi kamu abis, silakan login ulang."
LOGIN_GAGAL_MESSAGE = "Login Google gagal diverifikasi, coba login ulang ya."


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        max_age=ACCESS_TOKEN_TTL_SECONDS,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        max_age=REFRESH_TOKEN_TTL_SECONDS,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key=ACCESS_TOKEN_COOKIE_NAME, path="/")
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE_NAME, path="/")


def _user_progress_exists(user_id: UUID) -> bool:
    service_client = get_service_client()
    result = service_client.table("user_progress").select("user_id").eq("user_id", str(user_id)).execute()
    return bool(result.data)


def _ensure_user_progress_exists(user_id: UUID) -> None:
    if not _user_progress_exists(user_id):
        get_service_client().table("user_progress").insert({"user_id": str(user_id)}).execute()


@router.post("/google/callback", response_model=ApiResponse)
def google_callback(payload: GoogleCallbackRequest, response: Response) -> ApiResponse:
    anon_client = get_anon_client()
    try:
        auth_result = anon_client.auth.get_user(payload.supabase_access_token)
        supabase_user = auth_result.user
        if supabase_user is None or not supabase_user.id:
            return error_response(LOGIN_GAGAL_MESSAGE)
    except Exception:
        return error_response(LOGIN_GAGAL_MESSAGE)

    user_id = UUID(supabase_user.id)
    email = supabase_user.email or ""

    _ensure_user_progress_exists(user_id)

    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    _set_auth_cookies(response, access_token, refresh_token)

    return success_response(AuthUserData(user_id=user_id, email=email))


@router.post("/refresh", response_model=ApiResponse)
def refresh_session(request: Request, response: Response) -> ApiResponse:
    refresh_token_value = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if not refresh_token_value:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail=SESI_HABIS_MESSAGE)

    payload = decode_token(refresh_token_value, "refresh")
    user_id = UUID(payload["sub"])

    if not _user_progress_exists(user_id):
        _clear_auth_cookies(response)
        raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail=SESI_HABIS_MESSAGE)

    new_access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)
    _set_auth_cookies(response, new_access_token, new_refresh_token)

    return success_response(None)


@router.post("/logout", response_model=ApiResponse)
def logout(response: Response) -> ApiResponse:
    _clear_auth_cookies(response)
    return success_response(None)