from uuid import UUID

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.users.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    username = username.strip()

    if not username or not password:
        return None

    stmt = select(User).where(
        User.username == username,
        User.is_active.is_(True),
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    stmt = select(User).where(
        User.id == user_id,
        User.is_active.is_(True),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()