from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import extract, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.departments.models import Department
from app.employees.models import Employee
from app.employees.schemas import (
    BirthdayEntry,
    EmployeeCreate,
    EmployeeUpdate,
    OrgTreeDepartmentNode,
    OrgTreeEmployeeNode,
)


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


async def _get_department_head_id(
    db: AsyncSession,
    department_id: UUID | None,
    current_employee_id: UUID | None = None,
) -> UUID | None:
    if department_id is None:
        return None

    result = await db.execute(
        select(Department.head_id).where(Department.id == department_id)
    )
    head_id = result.scalar_one_or_none()

    if head_id is None:
        return None

    if current_employee_id is not None and head_id == current_employee_id:
        return None

    return head_id


async def get_employees(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    search: str | None = None,
    department_id: UUID | None = None,
    is_active: bool | None = True,
    sort_by: str = "name",
) -> tuple[list[Employee], int]:
    stmt = (
        select(Employee)
        .options(
            joinedload(Employee.department),
            joinedload(Employee.manager),
        )
    )
    count_stmt = select(func.count(func.distinct(Employee.id))).select_from(Employee)

    if is_active is not None:
        stmt = stmt.where(Employee.is_active == is_active)
        count_stmt = count_stmt.where(Employee.is_active == is_active)

    if department_id is not None:
        stmt = stmt.where(Employee.department_id == department_id)
        count_stmt = count_stmt.where(Employee.department_id == department_id)

    search_value = search.strip() if search else ""
    if search_value:
        pattern = f"%{search_value}%"

        stmt = stmt.outerjoin(Department, Employee.department_id == Department.id)
        count_stmt = count_stmt.outerjoin(Department, Employee.department_id == Department.id)

        search_filter = or_(
            Employee.first_name.ilike(pattern),
            Employee.last_name.ilike(pattern),
            Employee.middle_name.ilike(pattern),
            Employee.position.ilike(pattern),
            Employee.email.ilike(pattern),
            Department.name.ilike(pattern),
        )

        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    total = (await db.execute(count_stmt)).scalar() or 0

    if sort_by == "birth_date":
        stmt = stmt.order_by(
            Employee.birth_date.is_(None),
            extract("month", Employee.birth_date),
            extract("day", Employee.birth_date),
            Employee.last_name,
            Employee.first_name,
        )
    else:
        stmt = stmt.order_by(Employee.last_name, Employee.first_name)

    stmt = stmt.offset((page - 1) * size).limit(size)

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

    payload["manager_id"] = await _get_department_head_id(
        db,
        payload.get("department_id"),
    )

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

    if "department_id" in update_data:
        update_data["manager_id"] = await _get_department_head_id(
            db,
            update_data["department_id"],
            employee.id,
        )
    else:
        update_data["manager_id"] = await _get_department_head_id(
            db,
            employee.department_id,
            employee.id,
        )

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


def _build_employee_tree(employees: list[Employee]) -> list[OrgTreeEmployeeNode]:
    employees_by_id = {employee.id: employee for employee in employees}
    children_map: dict[UUID | None, list[Employee]] = {}

    for employee in employees:
        manager_id = employee.manager_id
        if manager_id is not None and manager_id not in employees_by_id:
            manager_id = None
        children_map.setdefault(manager_id, []).append(employee)

    for _, items in children_map.items():
        items.sort(key=lambda item: (item.last_name.lower(), item.first_name.lower()))

    def build_node(employee: Employee) -> OrgTreeEmployeeNode:
        return OrgTreeEmployeeNode(
            id=employee.id,
            full_name=_build_full_name(employee.last_name, employee.first_name, employee.middle_name),
            position=employee.position,
            photo_url=employee.photo_url,
            is_on_vacation=employee.is_on_vacation,
            children=[build_node(child) for child in children_map.get(employee.id, [])],
        )

    roots = children_map.get(None, [])
    return [build_node(root) for root in roots]


async def get_org_tree(db: AsyncSession) -> list[OrgTreeDepartmentNode]:
    dept_result = await db.execute(
        select(Department)
        .options(joinedload(Department.head))
        .order_by(Department.name)
    )
    departments = list(dept_result.scalars().unique().all())

    emp_result = await db.execute(
        select(Employee)
        .options(
            joinedload(Employee.department),
            joinedload(Employee.manager),
        )
        .where(Employee.is_active.is_(True))
        .order_by(Employee.last_name, Employee.first_name)
    )
    employees = list(emp_result.scalars().unique().all())

    departments_by_id = {department.id: department for department in departments}

    department_children_map: dict[UUID | None, list[Department]] = {}
    for department in departments:
        parent_id = department.parent_id
        if parent_id is not None and parent_id not in departments_by_id:
            parent_id = None
        department_children_map.setdefault(parent_id, []).append(department)

    for _, items in department_children_map.items():
        items.sort(key=lambda item: item.name.lower())

    employees_by_department: dict[UUID, list[Employee]] = {}
    for employee in employees:
        if employee.department_id is None:
            continue
        employees_by_department.setdefault(employee.department_id, []).append(employee)

    def build_department_node(department: Department) -> OrgTreeDepartmentNode:
        department_employees = employees_by_department.get(department.id, [])
        employee_tree = _build_employee_tree(department_employees)
        child_departments = department_children_map.get(department.id, [])

        head_name = None
        if department.head is not None:
            head_name = _build_full_name(
                department.head.last_name,
                department.head.first_name,
                department.head.middle_name,
            )

        return OrgTreeDepartmentNode(
            id=department.id,
            name=department.name,
            head_id=department.head_id,
            head_name=head_name,
            employee_count=len(department_employees),
            children_count=len(child_departments),
            employees=employee_tree,
            children=[build_department_node(child) for child in child_departments],
        )

    roots = department_children_map.get(None, [])
    return [build_department_node(root) for root in roots]


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