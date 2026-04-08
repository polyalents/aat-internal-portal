from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import extract, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.departments.models import Department
from app.employees.models import Employee
from app.employees.schemas import BirthdayEntry, EmployeeCreate, EmployeeUpdate, OrgTreeNode


def _build_full_name(last_name: str | None, first_name: str | None, middle_name: str | None) -> str:
    parts = [last_name, first_name, middle_name]
    return " ".join(part.strip() for part in parts if part and part.strip())


async def _ensure_user_binding_available(
    db: AsyncSession,
    user_id: UUID | None,
    current_employee_id: UUID | None = None,
) -> None:
    if user_id is None:
        return

    existing = await db.execute(select(Employee).where(Employee.user_id == user_id))
    bound_employee = existing.scalar_one_or_none()
    if bound_employee is None:
        return

    if current_employee_id is not None and bound_employee.id == current_employee_id:
        return

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Selected user is already bound to another employee",
    )


async def get_employees(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    search: str | None = None,
    department_id: UUID | None = None,
    is_active: bool | None = True,
) -> tuple[list[Employee], int]:
    stmt = (
        select(Employee)
        .options(
            joinedload(Employee.department),
            joinedload(Employee.manager),
        )
    )
    count_stmt = select(func.count()).select_from(Employee)

    if is_active is not None:
        stmt = stmt.where(Employee.is_active == is_active)
        count_stmt = count_stmt.where(Employee.is_active == is_active)

    if department_id is not None:
        stmt = stmt.where(Employee.department_id == department_id)
        count_stmt = count_stmt.where(Employee.department_id == department_id)

    if search:
        pattern = f"%{search.strip()}%"
        search_filter = or_(
            Employee.first_name.ilike(pattern),
            Employee.last_name.ilike(pattern),
            Employee.middle_name.ilike(pattern),
            Employee.position.ilike(pattern),
            Employee.email.ilike(pattern),
        )
        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        stmt.order_by(Employee.last_name, Employee.first_name)
        .offset((page - 1) * size)
        .limit(size)
    )

    result = await db.execute(stmt)
    employees = list(result.scalars().unique().all())

    return employees, total


async def get_employee_by_id(db: AsyncSession, emp_id: UUID) -> Employee | None:
    stmt = (
        select(Employee)
        .options(
            joinedload(Employee.department),
            joinedload(Employee.manager),
        )
        .where(Employee.id == emp_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_employee_by_user_id(db: AsyncSession, user_id: UUID) -> Employee | None:
    stmt = (
        select(Employee)
        .options(
            joinedload(Employee.department),
            joinedload(Employee.manager),
        )
        .where(Employee.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_employee(db: AsyncSession, data: EmployeeCreate) -> Employee:
    payload = data.model_dump()
    payload["email"] = str(data.email).lower()
    payload["first_name"] = payload["first_name"].strip()
    payload["last_name"] = payload["last_name"].strip()
    payload["position"] = payload["position"].strip()

    if payload.get("middle_name"):
        payload["middle_name"] = payload["middle_name"].strip()

    for field in ("room_number", "internal_phone", "mobile_phone"):
        if payload.get(field) is not None:
            payload[field] = payload[field].strip() or None

    await _ensure_user_binding_available(db, payload.get("user_id"))

    employee = Employee(**payload)
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return employee


async def update_employee(db: AsyncSession, employee: Employee, data: EmployeeUpdate) -> Employee:
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] is not None:
        update_data["email"] = str(update_data["email"]).lower()

    for field in ("first_name", "last_name", "middle_name", "position"):
        if field in update_data and update_data[field] is not None:
            update_data[field] = update_data[field].strip()

    for field in ("room_number", "internal_phone", "mobile_phone"):
        if field in update_data and update_data[field] is not None:
            update_data[field] = update_data[field].strip() or None

    if "user_id" in update_data:
        await _ensure_user_binding_available(db, update_data["user_id"], employee.id)

    for field, value in update_data.items():
        setattr(employee, field, value)

    await db.commit()
    await db.refresh(employee)
    return employee


async def delete_employee_permanently(db: AsyncSession, employee: Employee) -> None:
    subordinate = await db.execute(
        select(Employee.id).where(Employee.manager_id == employee.id).limit(1)
    )
    if subordinate.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete employee who is assigned as manager for other employees",
        )

    headed_department = await db.execute(
        select(Department.id).where(Department.head_id == employee.id).limit(1)
    )
    if headed_department.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete employee who is assigned as department head",
        )

    try:
        await db.delete(employee)
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete employee because it is referenced by related records",
        ) from exc


def _employee_to_read_dict(emp: Employee) -> dict:
    full_name = _build_full_name(emp.last_name, emp.first_name, emp.middle_name)

    manager_name = None
    if emp.manager is not None:
        manager_name = _build_full_name(
            emp.manager.last_name,
            emp.manager.first_name,
            emp.manager.middle_name,
        )

    return {
        "id": emp.id,
        "user_id": emp.user_id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "middle_name": emp.middle_name,
        "full_name": full_name,
        "position": emp.position,
        "department_id": emp.department_id,
        "department_name": emp.department.name if emp.department else None,
        "room_number": emp.room_number,
        "internal_phone": emp.internal_phone,
        "mobile_phone": emp.mobile_phone,
        "email": emp.email,
        "birth_date": emp.birth_date,
        "photo_url": emp.photo_url,
        "manager_id": emp.manager_id,
        "manager_name": manager_name,
        "vacation_start": emp.vacation_start,
        "vacation_end": emp.vacation_end,
        "is_on_vacation": emp.is_on_vacation,
        "is_active": emp.is_active,
        "created_at": emp.created_at,
        "updated_at": emp.updated_at,
    }


async def get_org_tree(db: AsyncSession) -> list[OrgTreeNode]:
    stmt = (
        select(Employee)
        .options(joinedload(Employee.department))
        .where(Employee.is_active.is_(True))
        .order_by(Employee.last_name, Employee.first_name)
    )
    result = await db.execute(stmt)
    all_employees = list(result.scalars().unique().all())

    children_map: dict[UUID | None, list[Employee]] = {}
    for employee in all_employees:
        children_map.setdefault(employee.manager_id, []).append(employee)

    def build_node(employee: Employee) -> OrgTreeNode:
        children = children_map.get(employee.id, [])
        return OrgTreeNode(
            id=employee.id,
            full_name=_build_full_name(employee.last_name, employee.first_name, employee.middle_name),
            position=employee.position,
            department_name=employee.department.name if employee.department else None,
            photo_url=employee.photo_url,
            is_on_vacation=employee.is_on_vacation,
            children=[build_node(child) for child in children],
        )

    roots = children_map.get(None, [])
    return [build_node(root) for root in roots]


async def get_birthdays(
    db: AsyncSession,
    period: str = "today",
) -> list[BirthdayEntry]:
    today = date.today()

    stmt = (
        select(Employee)
        .options(joinedload(Employee.department))
        .where(Employee.is_active.is_(True), Employee.birth_date.is_not(None))
    )

    if period == "today":
        stmt = stmt.where(
            extract("month", Employee.birth_date) == today.month,
            extract("day", Employee.birth_date) == today.day,
        )
    elif period == "tomorrow":
        tomorrow = today + timedelta(days=1)
        stmt = stmt.where(
            extract("month", Employee.birth_date) == tomorrow.month,
            extract("day", Employee.birth_date) == tomorrow.day,
        )
    elif period == "week":
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        conditions = []
        current = week_start
        while current <= week_end:
            conditions.append(
                (extract("month", Employee.birth_date) == current.month)
                & (extract("day", Employee.birth_date) == current.day)
            )
            current += timedelta(days=1)

        if conditions:
            stmt = stmt.where(or_(*conditions))
    elif period.isdigit():
        month = int(period)
        if 1 <= month <= 12:
            stmt = stmt.where(extract("month", Employee.birth_date) == month)

    stmt = stmt.order_by(
        extract("month", Employee.birth_date),
        extract("day", Employee.birth_date),
    )

    result = await db.execute(stmt)
    employees = list(result.scalars().unique().all())

    return [
        BirthdayEntry(
            id=employee.id,
            full_name=_build_full_name(employee.last_name, employee.first_name, employee.middle_name),
            position=employee.position,
            department_name=employee.department.name if employee.department else None,
            birth_date=employee.birth_date,
            photo_url=employee.photo_url,
        )
        for employee in employees
    ]