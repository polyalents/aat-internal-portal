from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import SettingRead, SettingsUpdate
from app.admin.service import get_all_settings, upsert_settings
from app.database import get_db
from app.dependencies import require_admin
from app.users.models import User

router = APIRouter()


@router.get("/settings", response_model=list[SettingRead])
async def list_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[SettingRead]:
    return await get_all_settings(db)


@router.patch("/settings", response_model=list[SettingRead])
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[SettingRead]:
    return await upsert_settings(db, body.settings)