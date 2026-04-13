from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.employees.schemas import EmployeeRead, EmployeeUpdate
from app.employees.service import (
    _employee_to_read_dict,
    get_employee_by_user_id,
    update_employee,
)
from app.uploads.security import validate_profile_photo
from app.users.models import User

router = APIRouter()

MAX_PHOTO_SIZE = 5 * 1024 * 1024


def _save_profile_photo(old_photo_url: str | None, content: bytes, filename: str) -> str:
    _, ext, _ = validate_profile_photo(filename, content)
    generated_filename = f"{uuid4().hex}.{ext}"

    photo_dir = Path(settings.upload_dir) / "photos"
    photo_dir.mkdir(parents=True, exist_ok=True)

    photo_path = photo_dir / generated_filename
    photo_path.write_bytes(content)

    if old_photo_url and old_photo_url.startswith("/uploads/photos/"):
        old_path = Path(settings.upload_dir) / "photos" / Path(old_photo_url).name
        old_path.unlink(missing_ok=True)

    return f"/uploads/photos/{generated_filename}"


@router.get("", response_model=EmployeeRead)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeRead:
    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    return EmployeeRead(**_employee_to_read_dict(employee))


@router.patch("", response_model=EmployeeRead)
async def patch_profile(
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeRead:
    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    allowed_fields = {
        "mobile_phone",
        "internal_phone",
        "room_number",
        "birth_date",
        "vacation_start",
        "vacation_end",
    }

    payload = body.model_dump(exclude_unset=True)
    filtered_payload = {key: value for key, value in payload.items() if key in allowed_fields}
    update_data = EmployeeUpdate(**filtered_payload)

    employee = await update_employee(db, employee, update_data)
    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload profile",
        )

    return EmployeeRead(**_employee_to_read_dict(employee))


@router.post("/photo", response_model=EmployeeRead)
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeRead:
    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    content = await file.read()
    await file.close()

    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo size must be under 5 MB",
        )

    original_name = file.filename or "photo.jpg"
    employee.photo_url = _save_profile_photo(employee.photo_url, content, original_name)
    await db.commit()
    await db.refresh(employee)

    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload profile",
        )

    return EmployeeRead(**_employee_to_read_dict(employee))