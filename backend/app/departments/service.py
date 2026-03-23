from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.departments.models import Department
from app.departments.schemas import DepartmentCreate, DepartmentUpdate


async def get_departments(db: AsyncSession) -> list[Department]:
    result = await db.execute(select(Department).order_by(Department.name))
    return list(result.scalars().all())


async def get_department_by_id(db: AsyncSession, dept_id: UUID) -> Department | None:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    return result.scalar_one_or_none()


async def create_department(db: AsyncSession, data: DepartmentCreate) -> Department:
    dept = Department(name=data.name, head_id=data.head_id)
    db.add(dept)
    await db.flush()
    await db.refresh(dept)
    return dept


async def update_department(db: AsyncSession, dept: Department, data: DepartmentUpdate) -> Department:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(dept, field, value)
    await db.flush()
    await db.refresh(dept)
    return dept


async def delete_department(db: AsyncSession, dept: Department) -> None:
    await db.delete(dept)
    await db.flush()