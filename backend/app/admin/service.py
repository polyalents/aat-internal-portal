from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.models import SystemSettings


async def get_all_settings(db: AsyncSession) -> list[SystemSettings]:
    result = await db.execute(
        select(SystemSettings).order_by(SystemSettings.key)
    )
    return list(result.scalars().all())


async def upsert_settings(
    db: AsyncSession,
    settings_dict: dict[str, str],
) -> list[SystemSettings]:
    for key, value in settings_dict.items():
        clean_key = key.strip()
        if not clean_key:
            continue

        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == clean_key)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.value = value
        else:
            db.add(SystemSettings(key=clean_key, value=value))

    await db.flush()
    return await get_all_settings(db)