from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.auth.service import hash_password
from app.users.models import User, UserRole
from app.users.schemas import UserCreate, UserPasswordChange, UserUpdate


async def get_users(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: str | None = None,
) -> tuple[list[User], int]:
    stmt = select(User).options(joinedload(User.employee))
    count_stmt = select(func.count()).select_from(User)

    if role is not None:
        stmt = stmt.where(User.role == role)
        count_stmt = count_stmt.where(User.role == role)

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
        count_stmt = count_stmt.where(User.is_active == is_active)

    if search:
        pattern = f"%{search.strip()}%"
        search_filter = or_(User.username.ilike(pattern), User.email.ilike(pattern))
        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)

    return list(result.scalars().unique().all()), total


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(
        select(User).options(joinedload(User.employee)).where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def _assert_unique_identity(db: AsyncSession, username: str, email: str) -> None:
    existing = await db.execute(
        select(User).where(
            or_(
                User.username == username,
                User.email == email,
            )
        )
    )
    user = existing.scalar_one_or_none()
    if user is None:
        return

    if user.username == username:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")


async def _assert_email_available_for_update(
    db: AsyncSession,
    user_id: UUID,
    email: str,
) -> None:
    existing = await db.execute(
        select(User).where(
            User.email == email,
            User.id != user_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    clean_username = data.username.strip()
    clean_email = str(data.email).lower()

    await _assert_unique_identity(db, clean_username, clean_email)

    is_it_manager = data.is_it_manager and data.role in {UserRole.admin, UserRole.it_specialist}

    user = User(
        username=clean_username,
        email=clean_email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_it_manager=is_it_manager,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user: User, data: UserUpdate) -> User:
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] is not None:
        normalized_email = str(update_data["email"]).lower()
        await _assert_email_available_for_update(db, user.id, normalized_email)
        update_data["email"] = normalized_email

    if "password" in update_data and update_data["password"] is not None:
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    else:
        update_data.pop("password", None)

    for field, value in update_data.items():
        setattr(user, field, value)

    if not user.is_active:
        user.is_it_manager = False
    elif user.role not in {UserRole.admin, UserRole.it_specialist}:
        user.is_it_manager = False

    await db.flush()
    await db.refresh(user)
    return user


async def change_user_password(db: AsyncSession, user: User, data: UserPasswordChange) -> User:
    user.hashed_password = hash_password(data.password)
    await db.flush()
    await db.refresh(user)
    return user


async def delete_user_permanently(db: AsyncSession, user: User) -> None:
    if user.employee is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete user while linked to an employee card",
        )

    try:
        await db.delete(user)
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete user because it is referenced by related records",
        ) from exc