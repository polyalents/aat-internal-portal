from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.announcements.models import Announcement
from app.announcements.schemas import AnnouncementCreate, AnnouncementUpdate


async def get_announcements(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    active_only: bool = True,
) -> tuple[list[Announcement], int]:
    stmt = select(Announcement).options(selectinload(Announcement.author))
    count_stmt = select(func.count()).select_from(Announcement)

    if active_only:
        now = datetime.now(timezone.utc)
        active_filter = Announcement.is_active.is_(True) & (
            Announcement.expires_at.is_(None) | (Announcement.expires_at > now)
        )
        stmt = stmt.where(active_filter)
        count_stmt = count_stmt.where(active_filter)

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(Announcement.published_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def get_announcement_by_id(db: AsyncSession, ann_id: UUID) -> Announcement | None:
    stmt = select(Announcement).options(selectinload(Announcement.author)).where(Announcement.id == ann_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_announcement(db: AsyncSession, data: AnnouncementCreate, author_id: UUID) -> Announcement:
    announcement = Announcement(
        title=data.title.strip(),
        content=data.content.strip(),
        author_id=author_id,
        expires_at=data.expires_at,
    )
    db.add(announcement)
    await db.flush()
    await db.refresh(announcement)
    return announcement


async def update_announcement(db: AsyncSession, announcement: Announcement, data: AnnouncementUpdate) -> Announcement:
    update_data = data.model_dump(exclude_unset=True)

    if "title" in update_data and update_data["title"] is not None:
        update_data["title"] = update_data["title"].strip()

    if "content" in update_data and update_data["content"] is not None:
        update_data["content"] = update_data["content"].strip()

    for field, value in update_data.items():
        setattr(announcement, field, value)

    await db.flush()
    await db.refresh(announcement)
    return announcement


async def delete_announcement(db: AsyncSession, announcement: Announcement) -> None:
    await db.delete(announcement)
    await db.flush()