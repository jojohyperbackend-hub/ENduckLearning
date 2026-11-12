import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.auth.middleware import (
    ACCESS_TOKEN_COOKIE_NAME,
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_TTL_SECONDS,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.config import settings
from app.database import get_anon_client
from app.models.schemas import (
    ApiResponse,
    AuthUserData,
    GoogleCallbackRequest,
    LoginRequest,
    RegisterRequest,
)
from app.services.progress_service import ensure_user_progress_exists
from app.utils.helpers import error_response, success_response

logger = logging.getLogger("app.auth.router")

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_SECURE = settings.ENVIRONMENT.strip().lower() == "production"

GOOGLE_LOGIN_GAGAL_MESSAGE = "Login dengan Google gagal, silakan coba lagi"
REGISTER_GAGAL_MESSAGE = "Registrasi gagal, periksa kembali email dan password Anda"
EMAIL_SUDAH_TERDAFTAR_MESSAGE = "Email sudah terdaftar, silakan login"
LOGIN_GAGAL_MESSAGE = "Email atau password salah"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        max_age=ACCESS_TOKEN_TTL_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        max_age=REFRESH_TOKEN_TTL_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def _finalize_login(user_id: UUID, email: str, response: Response) -> ApiResponse:
    ensure_user_progress_exists(user_id)
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    _set_auth_cookies(response, access_token, refresh_token)
    return success_response(AuthUserData(user_id=user_id, email=email))


@router.post("/google/callback", response_model=ApiResponse)
def google_callback(payload: GoogleCallbackRequest, response: Response) -> ApiResponse:
    anon_client = get_anon_client()
    try:
        user_result = anon_client.auth.get_user(payload.supabase_access_token)
    except Exception as exc:
        logger.warning("Verifikasi token Google gagal: %s", str(exc))
        return error_response(GOOGLE_LOGIN_GAGAL_MESSAGE)

    supabase_user = user_result.user if user_result else None
    if supabase_user is None or not supabase_user.id:
        return error_response(GOOGLE_LOGIN_GAGAL_MESSAGE)

    user_id = UUID(supabase_user.id)
    email = supabase_user.email or ""
    return _finalize_login(user_id, email, response)


@router.post("/register", response_model=ApiResponse)
def register(payload: RegisterRequest, response: Response) -> ApiResponse:
    anon_client = get_anon_client()
    try:
        auth_result = anon_client.auth.sign_up(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        message = getattr(exc, "message", str(exc)).lower()
        if "already registered" in message or "already exists" in message or "already been registered" in message:
            return error_response(EMAIL_SUDAH_TERDAFTAR_MESSAGE)
        logger.warning("Registrasi gagal: %s", str(exc))
        return error_response(REGISTER_GAGAL_MESSAGE)

    supabase_user = auth_result.user if auth_result else None
    if supabase_user is None or not supabase_user.id:
        return error_response(REGISTER_GAGAL_MESSAGE)

    user_id = UUID(supabase_user.id)
    ensure_user_progress_exists(user_id)

    if auth_result.session is None or not auth_result.session.access_token:
        return success_response(AuthUserData(user_id=user_id, email=payload.email))

    return _finalize_login(user_id, payload.email, response)


@router.post("/login", response_model=ApiResponse)
def login(payload: LoginRequest, response: Response) -> ApiResponse:
    anon_client = get_anon_client()
    try:
        auth_result = anon_client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        logger.warning("Login gagal: %s", str(exc))
        return error_response(LOGIN_GAGAL_MESSAGE)

    supabase_user = auth_result.user if auth_result else None
    if supabase_user is None or not supabase_user.id or auth_result.session is None:
        return error_response(LOGIN_GAGAL_MESSAGE)

    user_id = UUID(supabase_user.id)
    return _finalize_login(user_id, payload.email, response)


@router.post("/refresh", response_model=ApiResponse)
def refresh_session(request: Request, response: Response) -> ApiResponse:
    refresh_token_value = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if refresh_token_value is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token tidak ditemukan, silakan login ulang",
        )

    user_id = decode_token(refresh_token_value, "refresh")

    new_access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)
    _set_auth_cookies(response, new_access_token, new_refresh_token)
    return success_response(None)


@router.post("/logout", response_model=ApiResponse)
def logout(response: Response) -> ApiResponse:
    response.delete_cookie(key=ACCESS_TOKEN_COOKIE_NAME, path="/")
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE_NAME, path="/")
    return success_response(None)
