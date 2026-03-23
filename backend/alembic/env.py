import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.database import Base

# Импорт ВСЕХ моделей, чтобы Alembic видел их через Base.metadata
from app.admin.models import SystemSettings  # noqa: F401
from app.announcements.models import Announcement  # noqa: F401
from app.chat.models import ChatMessage  # noqa: F401
from app.departments.models import Department  # noqa: F401
from app.employees.models import Employee  # noqa: F401
from app.knowledge.models import KnowledgeArticle, KnowledgeCategory  # noqa: F401
from app.tickets.models import (  # noqa: F401
    Ticket,
    TicketAttachment,
    TicketCategory,
    TicketComment,
    TicketHistory,
)
from app.users.models import User  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url.replace("+asyncpg", ""),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())