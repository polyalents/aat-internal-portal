import { useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"

import {
  createAdminEmployee,
  deleteAdminEmployee,
  getAdminDepartments,
  getAdminEmployees,
  getAdminUsers,
  updateAdminEmployee,
} from "@/features/admin/api"
import type { Department, Employee, User } from "@/shared/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface EmployeeFormState {
  first_name: string
  last_name: string
  middle_name: string
  position: string
  email: string
  room_number: string
  internal_phone: string
  mobile_phone: string
  birth_date: string
  vacation_start: string
  vacation_end: string
  manager_id: string
  department_id: string
  user_id: string
}

const EMPTY_FORM: EmployeeFormState = {
  first_name: "",
  last_name: "",
  middle_name: "",
  position: "",
  email: "",
  room_number: "",
  internal_phone: "",
  mobile_phone: "",
  birth_date: "",
  vacation_start: "",
  vacation_end: "",
  manager_id: "",
  department_id: "",
  user_id: "",
}

function toForm(employee: Employee): EmployeeFormState {
  return {
    first_name: employee.first_name,
    last_name: employee.last_name,
    middle_name: employee.middle_name ?? "",
    position: employee.position,
    email: employee.email,
    room_number: employee.room_number ?? "",
    internal_phone: employee.internal_phone ?? "",
    mobile_phone: employee.mobile_phone ?? "",
    birth_date: employee.birth_date ?? "",
    vacation_start: employee.vacation_start ?? "",
    vacation_end: employee.vacation_end ?? "",
    manager_id: employee.manager_id ?? "",
    department_id: employee.department_id ?? "",
    user_id: employee.user_id ?? "",
  }
}

function formToPayload(form: EmployeeFormState) {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    middle_name: form.middle_name.trim() || null,
    position: form.position.trim(),
    email: form.email.trim(),
    room_number: form.room_number.trim() || null,
    internal_phone: form.internal_phone.trim() || null,
    mobile_phone: form.mobile_phone.trim() || null,
    birth_date: form.birth_date || null,
    vacation_start: form.vacation_start || null,
    vacation_end: form.vacation_end || null,
    manager_id: form.manager_id || null,
    department_id: form.department_id || null,
    user_id: form.user_id || null,
  }
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState<EmployeeFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EmployeeFormState>(EMPTY_FORM)

  async function loadData(query?: string) {
    setError(null)

    try {
      const [employeesData, usersData, departmentsData] = await Promise.all([
        getAdminEmployees({ page: 1, size: 100, search: query || undefined }),
        getAdminUsers({ page: 1, size: 100, is_active: true }),
        getAdminDepartments(),
      ])
      setEmployees(employeesData.items)
      setUsers(usersData.items)
      setDepartments(departmentsData)
    } catch {
      setError("Не удалось загрузить карточки сотрудников")
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const managerOptions = useMemo(() => employees, [employees])

  function availableUsersForEmployee(employee: Employee | null): User[] {
    if (!employee) {
      return users.filter((u) => !u.employee_id)
    }
    return users.filter((u) => !u.employee_id || u.id === employee.user_id)
  }

  function handleCreateFormChange<K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) {
    setCreateForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleEditFormChange<K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreateEmployee() {
    setError(null)
    setInfo(null)

    if (
      !createForm.first_name.trim() ||
      !createForm.last_name.trim() ||
      !createForm.position.trim() ||
      !createForm.email.trim()
    ) {
      setError("Для создания карточки заполните: Имя, Фамилия, Должность, Email")
      return
    }

    try {
      await createAdminEmployee(formToPayload(createForm))
      setInfo("Карточка сотрудника создана")
      setCreateForm(EMPTY_FORM)
      await loadData(search)
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError("Конфликт привязки: выбранная учётная запись уже связана с другим сотрудником")
        return
      }
      setError("Не удалось создать карточку сотрудника")
    }
  }

  function startEdit(employee: Employee) {
    setEditingId(employee.id)
    setEditForm(toForm(employee))
    setError(null)
    setInfo(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY_FORM)
  }

  async function saveEdit(employeeId: string) {
    setError(null)
    setInfo(null)

    if (!editForm.first_name.trim() || !editForm.last_name.trim() || !editForm.position.trim() || !editForm.email.trim()) {
      setError("Для сохранения карточки заполните: Имя, Фамилия, Должность, Email")
      return
    }

    try {
      await updateAdminEmployee(employeeId, formToPayload(editForm))
      setInfo("Карточка сотрудника обновлена")
      cancelEdit()
      await loadData(search)
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError("Конфликт привязки: выбранная учётная запись уже связана с другим сотрудником")
        return
      }
      setError("Не удалось обновить карточку сотрудника")
    }
  }

  async function deleteEmployee(employee: Employee) {
    setError(null)
    setInfo(null)
    try {
      await deleteAdminEmployee(employee.id)
      setInfo(`Карточка сотрудника ${employee.full_name} удалена`)
      await loadData(search)
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError("Удаление недоступно: карточка используется в связанных данных")
        return
      }
      setError("Не удалось удалить карточку сотрудника")
    }
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Карточки сотрудников</h2>
        <p className="text-sm text-muted-foreground">
          Создание и редактирование карточек сотрудников, назначение руководителя, отдела и учётной записи.
        </p>
      </header>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{info}</div>}

      <section className="space-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold">Новая карточка сотрудника</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Input placeholder="Имя*" value={createForm.first_name} onChange={(e) => handleCreateFormChange("first_name", e.target.value)} />
          <Input placeholder="Фамилия*" value={createForm.last_name} onChange={(e) => handleCreateFormChange("last_name", e.target.value)} />
          <Input placeholder="Отчество" value={createForm.middle_name} onChange={(e) => handleCreateFormChange("middle_name", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Input placeholder="Должность*" value={createForm.position} onChange={(e) => handleCreateFormChange("position", e.target.value)} />
          <Input placeholder="Email*" value={createForm.email} onChange={(e) => handleCreateFormChange("email", e.target.value)} />
          <Input placeholder="Кабинет" value={createForm.room_number} onChange={(e) => handleCreateFormChange("room_number", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Input placeholder="Внутренний телефон" value={createForm.internal_phone} onChange={(e) => handleCreateFormChange("internal_phone", e.target.value)} />
          <Input placeholder="Мобильный телефон" value={createForm.mobile_phone} onChange={(e) => handleCreateFormChange("mobile_phone", e.target.value)} />
          <label className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Дата рождения
            <Input className="mt-1" type="date" value={createForm.birth_date} onChange={(e) => handleCreateFormChange("birth_date", e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Начало отпуска
            <Input className="mt-1" type="date" value={createForm.vacation_start} onChange={(e) => handleCreateFormChange("vacation_start", e.target.value)} />
          </label>
          <label className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Конец отпуска
            <Input className="mt-1" type="date" value={createForm.vacation_end} onChange={(e) => handleCreateFormChange("vacation_end", e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <select className="h-11 rounded-md border bg-background px-2.5 text-sm" value={createForm.department_id} onChange={(e) => handleCreateFormChange("department_id", e.target.value)}>
            <option value="">Отдел не выбран</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>

          <select className="h-11 rounded-md border bg-background px-2.5 text-sm" value={createForm.manager_id} onChange={(e) => handleCreateFormChange("manager_id", e.target.value)}>
            <option value="">Руководитель не выбран</option>
            {managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.full_name}</option>
            ))}
          </select>

          <select className="h-11 rounded-md border bg-background px-2.5 text-sm" value={createForm.user_id} onChange={(e) => handleCreateFormChange("user_id", e.target.value)}>
            <option value="">Учётная запись не привязана</option>
            {availableUsersForEmployee(null).map((user) => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </div>

        <Button className="w-full sm:w-auto" onClick={() => void handleCreateEmployee()}>Создать карточку</Button>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input className="w-full sm:min-w-72 sm:flex-1" placeholder="Поиск по ФИО, должности или email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => void loadData(search)}>Найти</Button>
        </div>

        <div className="space-y-4">
          {employees.map((employee) => {
            const isEditing = editingId === employee.id
            const currentForm = isEditing ? editForm : toForm(employee)
            return (
              <article key={employee.id} className="space-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{employee.full_name}</h4>
                    <p className="text-sm text-muted-foreground">{employee.position} · {employee.email}</p>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    {!isEditing ? (
                      <>
                        <Button className="w-full sm:w-auto" size="sm" onClick={() => startEdit(employee)}>Редактировать</Button>
                        <Button className="w-full sm:w-auto" size="sm" variant="destructive" onClick={() => void deleteEmployee(employee)}>Удалить</Button>
                      </>
                    ) : (
                      <>
                        <Button className="w-full sm:w-auto" size="sm" onClick={() => void saveEdit(employee.id)}>Сохранить</Button>
                        <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={cancelEdit}>Отмена</Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Input disabled={!isEditing} placeholder="Имя" value={currentForm.first_name} onChange={(e) => handleEditFormChange("first_name", e.target.value)} />
                  <Input disabled={!isEditing} placeholder="Фамилия" value={currentForm.last_name} onChange={(e) => handleEditFormChange("last_name", e.target.value)} />
                  <Input disabled={!isEditing} placeholder="Отчество" value={currentForm.middle_name} onChange={(e) => handleEditFormChange("middle_name", e.target.value)} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Input disabled={!isEditing} placeholder="Должность" value={currentForm.position} onChange={(e) => handleEditFormChange("position", e.target.value)} />
                  <Input disabled={!isEditing} placeholder="Email" value={currentForm.email} onChange={(e) => handleEditFormChange("email", e.target.value)} />
                  <Input disabled={!isEditing} placeholder="Кабинет" value={currentForm.room_number} onChange={(e) => handleEditFormChange("room_number", e.target.value)} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Input disabled={!isEditing} placeholder="Внутренний телефон" value={currentForm.internal_phone} onChange={(e) => handleEditFormChange("internal_phone", e.target.value)} />
                  <Input disabled={!isEditing} placeholder="Мобильный телефон" value={currentForm.mobile_phone} onChange={(e) => handleEditFormChange("mobile_phone", e.target.value)} />
                  <label className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Дата рождения
                    <Input disabled={!isEditing} className="mt-1" type="date" value={currentForm.birth_date} onChange={(e) => handleEditFormChange("birth_date", e.target.value)} />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Начало отпуска
                    <Input disabled={!isEditing} className="mt-1" type="date" value={currentForm.vacation_start} onChange={(e) => handleEditFormChange("vacation_start", e.target.value)} />
                  </label>
                  <label className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Конец отпуска
                    <Input disabled={!isEditing} className="mt-1" type="date" value={currentForm.vacation_end} onChange={(e) => handleEditFormChange("vacation_end", e.target.value)} />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <select disabled={!isEditing} className="h-11 rounded-md border bg-background px-2.5 text-sm" value={currentForm.department_id} onChange={(e) => handleEditFormChange("department_id", e.target.value)}>
                    <option value="">Отдел не выбран</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>

                  <select disabled={!isEditing} className="h-11 rounded-md border bg-background px-2.5 text-sm" value={currentForm.manager_id} onChange={(e) => handleEditFormChange("manager_id", e.target.value)}>
                    <option value="">Руководитель не выбран</option>
                    {managerOptions.filter((m) => m.id !== employee.id).map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.full_name}</option>
                    ))}
                  </select>

                  <select disabled={!isEditing} className="h-11 rounded-md border bg-background px-2.5 text-sm" value={currentForm.user_id} onChange={(e) => handleEditFormChange("user_id", e.target.value)}>
                    <option value="">Учётная запись не привязана</option>
                    {availableUsersForEmployee(employee).map((user) => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}