from app.celery_app import celery_app
from app.database import SessionLocal
from app.tickets.service import cleanup_old_tickets


@celery_app.task
def cleanup_old_tickets_task() -> int:
    import asyncio

    async def _run() -> int:
        async with SessionLocal() as db:
            return await cleanup_old_tickets(db)

    return asyncio.run(_run())