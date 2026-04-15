from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.departments.models import Department
from app.departments.schemas import DepartmentCreate, DepartmentUpdate
from app.employees.models import Employee


async def get_departments(db: AsyncSession) -> list[Department]:
    result = await db.execute(
        select(Department)
        .options(
            joinedload(Department.parent),
            joinedload(Department.head),
        )
        .order_by(Department.name)
    )
    return list(result.scalars().unique().all())


async def get_department_by_id(db: AsyncSession, dept_id: UUID) -> Department | None:
    result = await db.execute(
        select(Department)
        .options(
            joinedload(Department.parent),
            joinedload(Department.head),
        )
        .where(Department.id == dept_id)
    )
    return result.scalar_one_or_none()


async def _validate_department_links(
    db: AsyncSession,
    *,
    head_id: UUID | None,
    parent_id: UUID | None,
    current_department_id: UUID | None = None,
) -> None:
    if current_department_id is not None and parent_id == current_department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Отдел не может быть родителем самого себя",
        )

    if head_id is not None:
        head_exists = await db.execute(
            select(Employee.id).where(Employee.id == head_id).limit(1)
        )
        if head_exists.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Указан несуществующий руководитель отдела",
            )

    if parent_id is not None:
        parent_exists = await db.execute(
            select(Department.id).where(Department.id == parent_id).limit(1)
        )
        if parent_exists.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Указан несуществующий родительский отдел",
            )

    if current_department_id is not None and parent_id is not None:
        visited: set[UUID] = set()
        cursor = parent_id

        while cursor is not None:
            if cursor == current_department_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Нельзя создать циклическую иерархию отделов",
                )

            if cursor in visited:
                break

            visited.add(cursor)
            parent_row = await db.execute(
                select(Department.parent_id).where(Department.id == cursor)
            )
            cursor = parent_row.scalar_one_or_none()


async def _sync_department_head_as_manager(
    db: AsyncSession,
    *,
    department_id: UUID,
    head_id: UUID | None,
) -> None:
    """
    Если у отдела появился руководитель, то всем сотрудникам этого отдела,
    у которых manager_id пустой, назначаем этого руководителя.

    Самому руководителю manager_id не трогаем.
    Если head_id=None, ничего не делаем.
    """
    if head_id is None:
        return

    result = await db.execute(
        select(Employee).where(Employee.department_id == department_id)
    )
    employees = list(result.scalars().all())

    for employee in employees:
        if employee.id == head_id:
            continue
        if employee.manager_id is None:
            employee.manager_id = head_id

    await db.flush()


async def create_department(db: AsyncSession, data: DepartmentCreate) -> Department:
    await _validate_department_links(
        db,
        head_id=data.head_id,
        parent_id=data.parent_id,
    )

    dept = Department(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        head_id=data.head_id,
        parent_id=data.parent_id,
    )
    db.add(dept)

    try:
        await db.flush()
        await _sync_department_head_as_manager(
            db,
            department_id=dept.id,
            head_id=dept.head_id,
        )
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

    if "description" in update_data and update_data["description"] is not None:
        update_data["description"] = update_data["description"].strip() or None

    next_head_id = update_data["head_id"] if "head_id" in update_data else dept.head_id
    next_parent_id = update_data["parent_id"] if "parent_id" in update_data else dept.parent_id

    await _validate_department_links(
        db,
        head_id=next_head_id,
        parent_id=next_parent_id,
        current_department_id=dept.id,
    )

    for field, value in update_data.items():
        setattr(dept, field, value)

    try:
        await db.flush()
        await _sync_department_head_as_manager(
            db,
            department_id=dept.id,
            head_id=dept.head_id,
        )
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

    child_department = await db.execute(
        select(Department.id).where(Department.parent_id == dept.id).limit(1)
    )
    if child_department.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя удалить отдел: у него есть дочерние отделы",
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