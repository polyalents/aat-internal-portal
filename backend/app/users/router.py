from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.tasks.celery_app import celery_app
from app.users.models import User, UserRole
from app.users.schemas import UserCreate, UserListResponse, UserPasswordChange, UserRead, UserUpdate
from app.users.service import (
    change_user_password,
    create_user,
    deactivate_user,
    delete_user_permanently,
    get_user_by_id,
    get_users,
    restore_user,
    update_user,
)

router = APIRouter()


def _to_user_read(user: User) -> UserRead:
    return UserRead.model_validate(
        {
            **user.__dict__,
            "employee_id": user.employee.id if user.employee else None,
        }
    )


@router.get("/", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    role: UserRole | None = Query(None),
    is_active: bool | None = Query(True),
    search: str | None = Query(None, max_length=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserListResponse:
    users, total = await get_users(
        db,
        page=page,
        size=size,
        role=role,
        is_active=is_active,
        search=search,
    )
    return UserListResponse(
        items=[_to_user_read(user) for user in users],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{user_id}", response_model=UserRead)
async def read_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_user_read(user)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    raw_password = body.password

    user = await create_user(db, body)
    await db.commit()

    reloaded = await get_user_by_id(db, user.id)
    if reloaded is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload user")

    try:
        full_name = reloaded.employee.full_name if reloaded.employee else reloaded.username
        celery_app.send_task(
            "app.tasks.ticket_tasks.notify_user_credentials",
            args=[
                reloaded.email,
                full_name,
                reloaded.username,
                raw_password,
            ],
        )
    except Exception:
        pass

    return _to_user_read(reloaded)


@router.patch("/{user_id}", response_model=UserRead)
async def update_existing_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = await update_user(db, user, body)
    await db.commit()

    reloaded = await get_user_by_id(db, user.id)
    if reloaded is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload user")
    return _to_user_read(reloaded)


@router.patch("/{user_id}/password", response_model=UserRead)
async def change_existing_user_password(
    user_id: UUID,
    body: UserPasswordChange,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = await change_user_password(db, user, body)
    await db.commit()

    reloaded = await get_user_by_id(db, user.id)
    if reloaded is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload user")
    return _to_user_read(reloaded)


@router.post("/{user_id}/deactivate", response_model=UserRead)
async def deactivate_existing_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = await deactivate_user(db, user)
    await db.commit()

    reloaded = await get_user_by_id(db, user.id)
    if reloaded is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload user")
    return _to_user_read(reloaded)


@router.post("/{user_id}/restore", response_model=UserRead)
async def restore_existing_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = await restore_user(db, user)
    await db.commit()

    reloaded = await get_user_by_id(db, user.id)
    if reloaded is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload user")
    return _to_user_read(reloaded)


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, str]:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await delete_user_permanently(db, user)
    await db.commit()
    return {"status": "deleted"}