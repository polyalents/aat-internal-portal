import { useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"

import {
  createAdminDepartment,
  deleteAdminDepartment,
  getAdminDepartments,
  getAdminEmployees,
  updateAdminDepartment,
} from "@/features/admin/api"
import type { Department, Employee } from "@/shared/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [name, setName] = useState("")
  const [headId, setHeadId] = useState("")

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editHeadId, setEditHeadId] = useState("")

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function loadData() {
    setError(null)
    try {
      const [deps, emps] = await Promise.all([
        getAdminDepartments(),
        getAdminEmployees({ page: 1, size: 100 }),
      ])
      setDepartments(deps)
      setEmployees(emps.items)
    } catch {
      setError("Не удалось загрузить список отделов")
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const employeeById = useMemo(() => {
    return new Map(employees.map((employee) => [employee.id, employee]))
  }, [employees])

  function startEdit(department: Department) {
    setEditingId(department.id)
    setEditName(department.name)
    setEditHeadId(department.head_id ?? "")
    setError(null)
    setInfo(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName("")
    setEditHeadId("")
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Введите название отдела")
      return
    }

    setError(null)
    setInfo(null)
    try {
      await createAdminDepartment({ name: name.trim(), head_id: headId || null })
      setName("")
      setHeadId("")
      setInfo("Отдел создан")
      await loadData()
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError("Не удалось создать отдел: название уже используется")
        return
      }
      setError("Не удалось создать отдел")
    }
  }

  async function handleSave(id: string) {
    if (!editName.trim()) {
      setError("Введите название отдела")
      return
    }

    setError(null)
    setInfo(null)
    try {
      await updateAdminDepartment(id, { name: editName.trim(), head_id: editHeadId || null })
      setInfo("Отдел обновлён")
      cancelEdit()
      await loadData()
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError("Не удалось обновить отдел: название уже используется")
        return
      }
      setError("Не удалось обновить отдел")
    }
  }

  async function handleDelete(department: Department) {
    setError(null)
    setInfo(null)
    try {
      await deleteAdminDepartment(department.id)
      setInfo(`Отдел «${department.name}» удалён`)
      await loadData()
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError("Нельзя удалить отдел: в нём есть сотрудники или связанные данные")
        return
      }
      setError("Не удалось удалить отдел")
    }
  }

  function renderHeadName(headIdValue: string | null) {
    if (!headIdValue) return "Не назначен"
    return employeeById.get(headIdValue)?.full_name ?? "Не назначен"
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Отделы</h2>
        <p className="text-sm text-muted-foreground">Создание, редактирование и удаление отделов.</p>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{info}</div>}

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-medium">Создать отдел</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Название отдела" value={name} onChange={(e) => setName(e.target.value)} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={headId}
            onChange={(e) => setHeadId(e.target.value)}
          >
            <option value="">Руководитель не назначен</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
          <Button onClick={() => void handleCreate()}>Создать</Button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">Название</th>
              <th className="p-3">Руководитель</th>
              <th className="p-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => {
              const isEditing = editingId === department.id
              return (
                <tr key={department.id} className="border-t">
                  <td className="p-3">
                    {isEditing ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      department.name
                    )}
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={editHeadId}
                        onChange={(e) => setEditHeadId(e.target.value)}
                      >
                        <option value="">Руководитель не назначен</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      renderHeadName(department.head_id)
                    )}
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void handleSave(department.id)}>
                          Сохранить
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Отмена
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => startEdit(department)}>
                          Редактировать
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void handleDelete(department)}>
                          Удалить
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {departments.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Отделы пока не созданы.</div>
        )}
      </div>
    </div>
  )
}