import logging
from typing import Optional
from uuid import UUID, uuid4

import bcrypt

from app.database import get_service_client

logger = logging.getLogger("app.services.credential_service")

TABLE_NAME = "app_user"


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        logger.warning("Hash password di database tidak valid/corrupt")
        return False


def email_exists(email: str) -> bool:
    client = get_service_client()
    result = (
        client.table(TABLE_NAME)
        .select("user_id")
        .eq("email", email.lower())
        .limit(1)
        .execute()
    )
    return bool(result.data)


def create_user_with_password(email: str, password: str) -> UUID:
    client = get_service_client()
    user_id = uuid4()
    client.table(TABLE_NAME).insert(
        {
            "user_id": str(user_id),
            "email": email.lower(),
            "password_hash": _hash_password(password),
        }
    ).execute()
    return user_id


def verify_user_credentials(email: str, password: str) -> Optional[UUID]:
    client = get_service_client()
    result = (
        client.table(TABLE_NAME)
        .select("user_id, password_hash")
        .eq("email", email.lower())
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    row = result.data[0]
    if not _verify_password(password, row["password_hash"]):
        return None
    return UUID(row["user_id"])
