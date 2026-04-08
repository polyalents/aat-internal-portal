from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.departments.models import Department
from app.departments.schemas import DepartmentCreate, DepartmentUpdate
from app.employees.models import Employee


async def get_departments(db: AsyncSession) -> list[Department]:
    result = await db.execute(select(Department).order_by(Department.name))
    return list(result.scalars().all())


async def get_department_by_id(db: AsyncSession, dept_id: UUID) -> Department | None:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    return result.scalar_one_or_none()


async def create_department(db: AsyncSession, data: DepartmentCreate) -> Department:
    dept = Department(name=data.name.strip(), head_id=data.head_id)
    db.add(dept)
    try:
        await db.flush()
        await db.refresh(dept)
        return dept
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Отдел с таким названием уже существует",
        ) from exc


async def update_department(db: AsyncSession, dept: Department, data: DepartmentUpdate) -> Department:
    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(dept, field, value)
    try:
        await db.flush()
        await db.refresh(dept)
        return dept
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Отдел с таким названием уже существует",
        ) from exc


async def delete_department(db: AsyncSession, dept: Department) -> None:
    linked_employee = await db.execute(
        select(Employee.id).where(Employee.department_id == dept.id).limit(1)
    )
    if linked_employee.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя удалить отдел: в нём есть сотрудники",
        )

    try:
        await db.delete(dept)
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя удалить отдел: есть связанные данные",
        ) from exc