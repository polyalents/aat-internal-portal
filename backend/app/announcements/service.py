from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.announcements.models import Announcement
from app.announcements.schemas import AnnouncementCreate, AnnouncementUpdate


async def get_announcements(
    db: AsyncSession,
    page: int = 1,
    size: int = 10,
    active_only: bool = True,
) -> tuple[list[Announcement], int]:
    stmt = select(Announcement).options(joinedload(Announcement.author))
    count_stmt = select(func.count()).select_from(Announcement)

    if active_only:
        stmt = stmt.where(Announcement.is_active.is_(True))
        count_stmt = count_stmt.where(Announcement.is_active.is_(True))

    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        stmt.order_by(Announcement.published_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )

    result = await db.execute(stmt)
    return list(result.scalars().unique().all()), total


async def get_announcement_by_id(db: AsyncSession, announcement_id: UUID) -> Announcement | None:
    result = await db.execute(
        select(Announcement)
        .options(joinedload(Announcement.author))
        .where(Announcement.id == announcement_id)
    )
    return result.scalar_one_or_none()


async def create_announcement(
    db: AsyncSession,
    data: AnnouncementCreate,
    author_id: UUID,
) -> Announcement:
    announcement = Announcement(
        title=data.title.strip(),
        content=data.content.strip(),
        author_id=author_id,
        expires_at=data.expires_at,
        is_active=True,
    )
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)
    return announcement


async def update_announcement(
    db: AsyncSession,
    announcement: Announcement,
    data: AnnouncementUpdate,
) -> Announcement:
    if data.title is not None:
        announcement.title = data.title.strip()

    if data.content is not None:
        announcement.content = data.content.strip()

    if data.expires_at is not None:
        announcement.expires_at = data.expires_at

    if data.is_active is not None:
        announcement.is_active = data.is_active

    await db.commit()
    await db.refresh(announcement)
    return announcement


async def delete_announcement(
    db: AsyncSession,
    announcement: Announcement,
) -> None:
    await db.delete(announcement)
    await db.commit()