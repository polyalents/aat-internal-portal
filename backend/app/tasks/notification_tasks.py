import logging
from datetime import datetime, timezone

from sqlalchemy import update

from app.announcements.models import Announcement
from app.tasks.celery_app import celery_app
from app.tasks.ticket_tasks import SyncSession

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notification_tasks.cleanup_expired_announcements")
def cleanup_expired_announcements() -> dict:
    """Deactivate expired announcements."""
    now = datetime.now(timezone.utc)

    with SyncSession() as db:
        result = db.execute(
            update(Announcement)
            .where(
                Announcement.expires_at.is_not(None),
                Announcement.expires_at <= now,
                Announcement.is_active == True,  # noqa: E712
            )
            .values(is_active=False)
        )

        count = result.rowcount or 0
        db.commit()

    logger.info("Deactivated %d expired announcements", count)
    return {"deactivated": count}