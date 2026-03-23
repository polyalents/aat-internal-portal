from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.departments.schemas import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.departments.service import (
    create_department,
    delete_department,
    get_department_by_id,
    get_departments,
    update_department,
)
from app.users.models import User

router = APIRouter()


@router.get("/", response_model=list[DepartmentRead])
async def list_departments(
    db: AsyncSession = Depends(get_db),
) -> list[DepartmentRead]:
    return await get_departments(db)


@router.get("/{dept_id}", response_model=DepartmentRead)
async def read_department(
    dept_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> DepartmentRead:
    dept = await get_department_by_id(db, dept_id)
    if dept is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return dept


@router.post("/", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
async def create_new_department(
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> DepartmentRead:
    return await create_department(db, body)


@router.patch("/{dept_id}", response_model=DepartmentRead)
async def update_existing_department(
    dept_id: UUID,
    body: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> DepartmentRead:
    dept = await get_department_by_id(db, dept_id)
    if dept is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return await update_department(db, dept, body)


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_department(
    dept_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    dept = await get_department_by_id(db, dept_id)
    if dept is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    await delete_department(db, dept)