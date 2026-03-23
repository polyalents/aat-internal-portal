from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.announcements.schemas import (
    AnnouncementCreate,
    AnnouncementListResponse,
    AnnouncementRead,
    AnnouncementUpdate,
)
from app.announcements.service import (
    create_announcement,
    delete_announcement,
    get_announcement_by_id,
    get_announcements,
    update_announcement,
)
from app.database import get_db
from app.dependencies import get_current_user, require_it
from app.users.models import User

router = APIRouter()


def _ann_to_read(announcement) -> AnnouncementRead:
    return AnnouncementRead(
        id=announcement.id,
        title=announcement.title,
        content=announcement.content,
        author_id=announcement.author_id,
        author_name=announcement.author.username if announcement.author else None,
        published_at=announcement.published_at,
        expires_at=announcement.expires_at,
        is_active=announcement.is_active,
    )


@router.get("/", response_model=AnnouncementListResponse)
async def list_announcements(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AnnouncementListResponse:
    announcements, total = await get_announcements(db, page=page, size=size, active_only=active_only)
    return AnnouncementListResponse(
        items=[_ann_to_read(announcement) for announcement in announcements],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{ann_id}", response_model=AnnouncementRead)
async def read_announcement(
    ann_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AnnouncementRead:
    announcement = await get_announcement_by_id(db, ann_id)
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    return _ann_to_read(announcement)


@router.post("/", response_model=AnnouncementRead, status_code=status.HTTP_201_CREATED)
async def create_new_announcement(
    body: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_it),
) -> AnnouncementRead:
    announcement = await create_announcement(db, body, current_user.id)
    announcement = await get_announcement_by_id(db, announcement.id)
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload announcement",
        )
    return _ann_to_read(announcement)


@router.patch("/{ann_id}", response_model=AnnouncementRead)
async def update_existing_announcement(
    ann_id: UUID,
    body: AnnouncementUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> AnnouncementRead:
    announcement = await get_announcement_by_id(db, ann_id)
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    announcement = await update_announcement(db, announcement, body)
    announcement = await get_announcement_by_id(db, announcement.id)
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload announcement",
        )

    return _ann_to_read(announcement)


@router.delete("/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_announcement(
    ann_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> None:
    announcement = await get_announcement_by_id(db, ann_id)
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    await delete_announcement(db, announcement)