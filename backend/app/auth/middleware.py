from datetime import timedelta
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from app.config import settings
from app.utils.helpers import utcnow

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_SECONDS = 900
REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
ACCESS_TOKEN_COOKIE_NAME = "access_token"
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"

SESI_TIDAK_VALID_MESSAGE = "Sesi kamu udah habis atau gak valid, coba login ulang ya."


def _create_token(user_id: UUID, token_type: Literal["access", "refresh"], ttl_seconds: int) -> str:
    now = utcnow()
    claims = {
        "sub": str(user_id),
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
    }
    return jwt.encode(claims, settings.JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_access_token(user_id: UUID) -> str:
    return _create_token(user_id, "access", ACCESS_TOKEN_TTL_SECONDS)


def create_refresh_token(user_id: UUID) -> str:
    return _create_token(user_id, "refresh", REFRESH_TOKEN_TTL_SECONDS)


def decode_token(token: str, expected_type: Literal["access", "refresh"]) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=SESI_TIDAK_VALID_MESSAGE) from exc
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=SESI_TIDAK_VALID_MESSAGE)
    if "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=SESI_TIDAK_VALID_MESSAGE)
    return payload


def get_current_user_id(request: Request) -> UUID:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=SESI_TIDAK_VALID_MESSAGE)
    payload = decode_token(token, "access")
    try:
        return UUID(payload["sub"])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=SESI_TIDAK_VALID_MESSAGE) from exc