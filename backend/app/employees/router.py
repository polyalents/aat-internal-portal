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
    deactivate_employee,
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


@router.get("/", response_model=EmployeeListResponse)
async def list_employees(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=200),
    department_id: UUID | None = Query(None),
    is_active: bool | None = Query(True),
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


@router.delete("/{emp_id}", response_model=EmployeeRead)
async def delete_employee(
    emp_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> EmployeeRead:
    employee = await get_employee_by_id(db, emp_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    employee = await deactivate_employee(db, employee)
    return EmployeeRead(**_employee_to_read_dict(employee))


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
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo size must be under 5 MB",
        )

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid4().hex}.{ext}"

    photo_dir = Path(settings.upload_dir) / "photos"
    photo_dir.mkdir(parents=True, exist_ok=True)
    photo_path = photo_dir / filename

    with open(photo_path, "wb") as f:
        f.write(content)

    await file.close()

    if employee.photo_url and employee.photo_url.startswith("/uploads/"):
        relative_path = employee.photo_url.removeprefix("/uploads/")
        old_path = Path(settings.upload_dir) / relative_path
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    employee.photo_url = f"/uploads/photos/{filename}"
    await db.flush()
    await db.refresh(employee)

    employee = await get_employee_by_id(db, employee.id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload employee")

    return EmployeeRead(**_employee_to_read_dict(employee))