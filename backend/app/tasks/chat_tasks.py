import logging

from app.chat.notifications import send_unread_chat_email_notifications
from app.config import settings
from app.database import async_session_factory

from app.announcements import models as announcement_models  # noqa: F401
from app.chat import models as chat_models  # noqa: F401
from app.departments import models as department_models  # noqa: F401
from app.employees import models as employee_models  # noqa: F401
from app.knowledge import models as knowledge_models  # noqa: F401
from app.tickets import models as ticket_models  # noqa: F401
from app.users import models as user_models  # noqa: F401

logger = logging.getLogger(__name__)


async def process_unread_chat_notifications() -> None:
    logger.warning("process_unread_chat_notifications started")

    async with async_session_factory() as db:
        sent = await send_unread_chat_email_notifications(
            db=db,
            portal_url=settings.frontend_url.rstrip("/"),
        )

    logger.warning("process_unread_chat_notifications finished, sent=%s", sent)

    if sent:
        logger.info("Unread chat email notifications sent: %s", sent)