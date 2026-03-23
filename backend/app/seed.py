"""
Seed script: creates first admin user and default ticket categories.

Usage:
    cd ~/aat-internal-portal/backend
    source .venv/bin/activate
    python -m app.seed
"""

import asyncio

from sqlalchemy import select

from app.admin.models import SystemSettings  # noqa: F401
from app.announcements.models import Announcement  # noqa: F401
from app.auth.service import hash_password
from app.chat.models import ChatMessage  # noqa: F401
from app.database import async_session_factory
from app.departments.models import Department  # noqa: F401
from app.employees.models import Employee  # noqa: F401
from app.knowledge.models import KnowledgeArticle, KnowledgeCategory  # noqa: F401
from app.tickets.models import TicketCategory
from app.users.models import User, UserRole
from app.config import settings


DEFAULT_CATEGORIES = [
    "Оборудование",
    "Программное обеспечение",
    "Сеть / Интернет",
    "Электронная почта",
    "Телефония",
    "1С / ERP",
    "Доступ / Учётные записи",
    "Другое",
]


async def seed() -> None:
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.username == settings.admin_username))
        existing = result.scalar_one_or_none()

        if existing is None:
            admin = User(
                username=settings.admin_username,
                email=settings.admin_email.lower(),
                hashed_password=hash_password(settings.admin_password),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(admin)
            print(f"Created admin user: {settings.admin_username}")
        else:
            print(f"Admin user '{settings.admin_username}' already exists. Skipping user creation.")

        for category_name in DEFAULT_CATEGORIES:
            result = await db.execute(select(TicketCategory).where(TicketCategory.name == category_name))
            if result.scalar_one_or_none() is None:
                db.add(TicketCategory(name=category_name))
                print(f"Created ticket category: {category_name}")

        await db.commit()

    print("\nSeed completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed())