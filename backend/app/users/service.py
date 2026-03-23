from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import hash_password
from app.users.models import User, UserRole
from app.users.schemas import UserCreate, UserUpdate


async def get_users(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: str | None = None,
) -> tuple[list[User], int]:
    stmt = select(User)
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

    return list(result.scalars().all()), total


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    user = User(
        username=data.username.strip(),
        email=str(data.email).lower(),
        hashed_password=hash_password(data.password),
        role=data.role,
        is_it_manager=data.is_it_manager,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user: User, data: UserUpdate) -> User:
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] is not None:
        update_data["email"] = str(update_data["email"]).lower()

    if "password" in update_data and update_data["password"] is not None:
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    else:
        update_data.pop("password", None)

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


async def deactivate_user(db: AsyncSession, user: User) -> User:
    user.is_active = False
    await db.flush()
    await db.refresh(user)
    return user