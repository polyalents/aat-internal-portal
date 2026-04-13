from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import (
    build_refresh_claims,
    create_access_token,
    encode_refresh_token,
    verify_refresh_token,
)
from app.auth.models import RefreshTokenSession
from app.auth.schemas import LoginRequest, RefreshRequest, TokenResponse
from app.auth.service import authenticate_user, get_user_by_id
from app.database import get_db
from app.dependencies import get_current_user
from app.users.models import User

router = APIRouter()


def _request_meta(request: Request) -> tuple[str | None, str | None]:
    ip = (
        request.headers.get("X-Real-IP")
        or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else None)
    )
    user_agent = request.headers.get("User-Agent")
    return ip, user_agent


def _ts_to_dt(value) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromtimestamp(int(value), tz=timezone.utc)


async def _issue_refresh_token(db: AsyncSession, user_id: UUID, request: Request) -> str:
    claims = build_refresh_claims(user_id)
    refresh_token = encode_refresh_token(claims)

    ip, user_agent = _request_meta(request)
    session = RefreshTokenSession(
        jti=UUID(claims["jti"]),
        user_id=user_id,
        issued_at=_ts_to_dt(claims["iat"]),
        expires_at=_ts_to_dt(claims["exp"]),
        ip_address=ip,
        user_agent=user_agent,
    )
    db.add(session)
    await db.commit()
    return refresh_token


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await authenticate_user(db, body.username, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = await _issue_refresh_token(db, user.id, request)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    payload = verify_refresh_token(body.refresh_token)
    if payload is None or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(payload["sub"])
        jti = UUID(payload["jti"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    session = await db.get(RefreshTokenSession, jti)

    if session is None or session.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is not recognized",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.now(timezone.utc)
    if session.revoked_at is not None or session.replaced_by_jti is not None:
        await db.execute(
            update(RefreshTokenSession)
            .where(RefreshTokenSession.user_id == user_id, RefreshTokenSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if session.expires_at < now:
        session.revoked_at = now
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    next_claims = build_refresh_claims(user.id)
    next_refresh_token = encode_refresh_token(next_claims)
    next_jti = UUID(next_claims["jti"])
    ip, user_agent = _request_meta(request)

    db.add(
        RefreshTokenSession(
            jti=next_jti,
            user_id=user.id,
            issued_at=_ts_to_dt(next_claims["iat"]),
            expires_at=_ts_to_dt(next_claims["exp"]),
            ip_address=ip,
            user_agent=user_agent,
        )
    )
    session.replaced_by_jti = next_jti
    session.revoked_at = now
    await db.commit()

    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token, refresh_token=next_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> None:
    payload = verify_refresh_token(body.refresh_token)
    if payload is None:
        return

    try:
        jti = UUID(payload["jti"])
    except ValueError:
        return

    session = await db.get(RefreshTokenSession, jti)
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        await db.commit()


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_it_manager": current_user.is_it_manager,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
    }