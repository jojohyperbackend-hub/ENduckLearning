import logging
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger("app.auth.middleware")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_SECONDS = 900
REFRESH_TOKEN_TTL_SECONDS = 2592000
ACCESS_TOKEN_COOKIE_NAME = "access_token"
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"

TokenTypeLiteral = Literal["access", "refresh"]


def _create_token(user_id: UUID, token_type: TokenTypeLiteral, ttl_seconds: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + timedelta(seconds=ttl_seconds),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_access_token(user_id: UUID) -> str:
    return _create_token(user_id, "access", ACCESS_TOKEN_TTL_SECONDS)


def create_refresh_token(user_id: UUID) -> str:
    return _create_token(user_id, "refresh", REFRESH_TOKEN_TTL_SECONDS)


def decode_token(token: str, expected_type: TokenTypeLiteral) -> UUID:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        logger.warning("Gagal decode token: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah kedaluwarsa",
        ) from exc

    token_type = payload.get("type")
    if token_type != expected_type:
        logger.warning(
            "Token type tidak sesuai: diharapkan '%s' tapi dapat '%s'", expected_type, token_type
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid untuk operasi ini",
        )

    subject = payload.get("sub")
    if subject is None:
        logger.warning("Token tidak memiliki field 'sub'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid",
        )

    try:
        return UUID(subject)
    except ValueError as exc:
        logger.warning("Field 'sub' pada token bukan UUID valid: %s", subject)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid",
        ) from exc


def get_current_user_id(request: Request) -> UUID:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if token is None:
        logger.warning(
            "Cookie '%s' tidak ditemukan di request. Cookie yang ada: %s",
            ACCESS_TOKEN_COOKIE_NAME,
            list(request.cookies.keys()),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Belum login atau sesi sudah berakhir",
        )
    return decode_token(token, "access")
