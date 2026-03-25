from celery import Celery
from celery.schedules import crontab

from app.config import settings


celery_app = Celery(
    "portal",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.ticket_tasks",
        "app.tasks.notification_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Moscow",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,  # чтобы не падал при старте
)

# Beat schedule
celery_app.conf.beat_schedule = {
    "check-escalation-every-minute": {
        "task": "app.tasks.ticket_tasks.check_escalation",
        "schedule": 60.0,
    },
    "cleanup-expired-announcements-daily": {
        "task": "app.tasks.notification_tasks.cleanup_expired_announcements",
        "schedule": crontab(hour=1, minute=0),
    },
}

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.tasks"])