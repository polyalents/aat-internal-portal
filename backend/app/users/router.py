from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.users.models import User, UserRole
from app.users.schemas import UserCreate, UserListResponse, UserRead, UserUpdate
from app.users.service import create_user, deactivate_user, get_user_by_id, get_users, update_user

router = APIRouter()


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserListResponse:
    users, total = await get_users(db, page=page, size=size, role=role, is_active=is_active, search=search)
    return UserListResponse(items=users, total=total, page=page, size=size)


@router.get("/{user_id}", response_model=UserRead)
async def read_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    return await create_user(db, body)


@router.patch("/{user_id}", response_model=UserRead)
async def update_existing_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await update_user(db, user, body)


@router.delete("/{user_id}", response_model=UserRead)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await deactivate_user(db, user)