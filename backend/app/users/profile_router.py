from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.employees.schemas import EmployeeRead, EmployeeUpdate
from app.employees.service import _employee_to_read_dict, get_employee_by_user_id
from app.users.models import User

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024


@router.get("/", response_model=EmployeeRead)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeRead:
    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found")
    return EmployeeRead(**_employee_to_read_dict(employee))


@router.patch("/", response_model=EmployeeRead)
async def update_profile(
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeRead:
    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found")

    allowed_fields = {
        "mobile_phone",
        "internal_phone",
        "room_number",
        "vacation_start",
        "vacation_end",
        "telegram_chat_id",
    }
    update_data = body.model_dump(exclude_unset=True)
    filtered = {key: value for key, value in update_data.items() if key in allowed_fields}

    if not filtered:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No allowed fields to update")

    for field, value in filtered.items():
        setattr(employee, field, value)

    await db.flush()
    await db.refresh(employee)

    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload employee profile",
        )

    return EmployeeRead(**_employee_to_read_dict(employee))


@router.post("/photo", response_model=EmployeeRead)
async def upload_own_photo(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeRead:
    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, and WebP images are allowed",
        )

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo must be under 5 MB",
        )

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid4().hex}.{ext}"

    photo_dir = Path(settings.upload_dir) / "photos"
    photo_dir.mkdir(parents=True, exist_ok=True)
    photo_path = photo_dir / filename

    with open(photo_path, "wb") as output_file:
        output_file.write(content)

    await file.close()

    if employee.photo_url and employee.photo_url.startswith("/uploads/"):
        relative_path = employee.photo_url.removeprefix("/uploads/")
        old_path = Path(settings.upload_dir) / relative_path
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    employee.photo_url = f"/uploads/photos/{filename}"
    await db.flush()
    await db.refresh(employee)

    employee = await get_employee_by_user_id(db, current_user.id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload employee profile",
        )

    return EmployeeRead(**_employee_to_read_dict(employee))