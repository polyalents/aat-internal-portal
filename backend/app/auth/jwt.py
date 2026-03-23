from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from jose import JWTError, jwt

from app.config import settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def create_access_token(user_id: UUID, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    payload = {
        "sub": str(user_id),
        "role": role,
        "type": TOKEN_TYPE_ACCESS,
        "iat": now,
        "nbf": now,
        "exp": expire,
    }

    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_refresh_token_expire_days)

    payload = {
        "sub": str(user_id),
        "type": TOKEN_TYPE_REFRESH,
        "iat": now,
        "nbf": now,
        "exp": expire,
    }

    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if "sub" not in payload:
            return None
        return payload
    except JWTError:
        return None


def verify_access_token(token: str) -> dict[str, Any] | None:
    payload = decode_token(token)
    if payload is None or payload.get("type") != TOKEN_TYPE_ACCESS:
        return None
    return payload


def verify_refresh_token(token: str) -> dict[str, Any] | None:
    payload = decode_token(token)
    if payload is None or payload.get("type") != TOKEN_TYPE_REFRESH:
        return None
    return payload