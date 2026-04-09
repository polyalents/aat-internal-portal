from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_it
from app.employees.schemas import (
    BirthdayEntry,
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeRead,
    EmployeeUpdate,
    OrgTreeNode,
)
from app.employees.service import (
    _employee_to_read_dict,
    create_employee,
    delete_employee_permanently,
    get_birthdays,
    get_employee_by_id,
    get_employees,
    get_org_tree,
    update_employee,
)
from app.users.models import User

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024


def _save_employee_photo(employee: object, content: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    safe_ext = ext if ext in {"jpg", "jpeg", "png", "webp"} else "jpg"
    generated_filename = f"{uuid4().hex}.{safe_ext}"

    photo_dir = Path(settings.upload_dir) / "photos"
    photo_dir.mkdir(parents=True, exist_ok=True)

    photo_path = photo_dir / generated_filename
    photo_path.write_bytes(content)

    old_photo_url = getattr(employee, "photo_url", None)
    if old_photo_url and old_photo_url.startswith("/uploads/photos/"):
        old_path = Path(settings.upload_dir) / "photos" / Path(old_photo_url).name
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    return f"/uploads/photos/{generated_filename}"


@router.get("/", response_model=EmployeeListResponse)
async def list_employees(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=200),
    department_id: UUID | None = Query(None),
    is_active: bool | None = Query(True),
    sort_by: str = Query("name", description="name or birth_date"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> EmployeeListResponse:
    employees, total = await get_employees(
        db,
        page=page,
        size=size,
        search=search,
        department_id=department_id,
        is_active=is_active,
        sort_by=sort_by,
    )
    items = [EmployeeRead(**_employee_to_read_dict(employee)) for employee in employees]
    return EmployeeListResponse(items=items, total=total, page=page, size=size)


@router.get("/org-tree", response_model=list[OrgTreeNode])
async def org_tree(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[OrgTreeNode]:
    return await get_org_tree(db)


@router.get("/birthdays", response_model=list[BirthdayEntry])
async def birthdays(
    period: str = Query("today", description="today, tomorrow, week, or month number (1-12)"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[BirthdayEntry]:
    return await get_birthdays(db, period=period)


@router.get("/{emp_id}", response_model=EmployeeRead)
async def read_employee(
    emp_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> EmployeeRead:
    employee = await get_employee_by_id(db, emp_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return EmployeeRead(**_employee_to_read_dict(employee))


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
async def create_new_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> EmployeeRead:
    employee = await create_employee(db, body)
    employee = await get_employee_by_id(db, employee.id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload employee")
    return EmployeeRead(**_employee_to_read_dict(employee))


@router.patch("/{emp_id}", response_model=EmployeeRead)
async def update_existing_employee(
    emp_id: UUID,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> EmployeeRead:
    employee = await get_employee_by_id(db, emp_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    employee = await update_employee(db, employee, body)
    employee = await get_employee_by_id(db, employee.id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload employee")
    return EmployeeRead(**_employee_to_read_dict(employee))


@router.delete("/{emp_id}")
async def delete_employee(
    emp_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> dict[str, str]:
    employee = await get_employee_by_id(db, emp_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    await delete_employee_permanently(db, employee)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{emp_id}/photo", response_model=EmployeeRead)
async def upload_photo(
    emp_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> EmployeeRead:
    employee = await get_employee_by_id(db, emp_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, and WebP images are allowed",
        )

    content = await file.read()
    await file.close()

    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo size must be under 5 MB",
        )

    employee.photo_url = _save_employee_photo(employee, content, file.filename or "photo.jpg")
    await db.flush()
    await db.refresh(employee)

    employee = await get_employee_by_id(db, employee.id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload employee")

    return EmployeeRead(**_employee_to_read_dict(employee))