from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from jose import JWTError, jwt

from app.config import settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def create_access_token(user_id: UUID, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    payload = {
        "sub": str(user_id),
        "role": role,
        "type": TOKEN_TYPE_ACCESS,
        "iat": now,
        "nbf": now,
        "exp": expire,
    }

    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def build_refresh_claims(user_id: UUID) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.refresh_token_expire_days)
    jti = uuid4()

    payload = {
        "sub": str(user_id),
        "jti": str(jti),
        "type": TOKEN_TYPE_REFRESH,
        "iat": now,
        "nbf": now,
        "exp": expire,
    }
    return payload


def encode_refresh_token(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
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
    if payload is None:
        return None
    if payload.get("type") != TOKEN_TYPE_REFRESH:
        return None
    if "jti" not in payload:
        return None
    return payload