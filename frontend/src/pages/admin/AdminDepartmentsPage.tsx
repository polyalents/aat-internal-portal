import { useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import { Building2, Pencil, Plus, Trash2 } from "lucide-react"

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
import { cn } from "@/lib/utils"

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
      {error && <Alert tone="error">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/25 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Отделы</h2>
              <p className="text-sm text-muted-foreground">Создание, редактирование и удаление отделов.</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Создать отдел</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Название отдела" value={name} onChange={(e) => setName(e.target.value)} />
              <select
                className="admin-input h-10 rounded-md px-3 text-sm"
                value={headId}
                onChange={(e) => setHeadId(e.target.value)}
              >
                <option value="">Руководитель не назначен</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                ))}
              </select>
              <Button onClick={() => void handleCreate()}>Создать</Button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border/60">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/30 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Название</th>
                    <th className="px-4 py-3 font-medium">Руководитель</th>
                    <th className="px-4 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => {
                    const isEditing = editingId === department.id

                    return (
                      <tr key={department.id} className="border-t border-border/60 align-top">
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                          ) : (
                            <span className="font-medium">{department.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              className="admin-input h-10 rounded-md px-3 text-sm"
                              value={editHeadId}
                              onChange={(e) => setEditHeadId(e.target.value)}
                            >
                              <option value="">Руководитель не назначен</option>
                              {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-muted-foreground">{renderHeadName(department.head_id)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => void handleSave(department.id)}>
                                Сохранить
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                Отмена
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => startEdit(department)}>
                                <Pencil className="mr-1 h-3.5 w-3.5" />
                                Редактировать
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => void handleDelete(department)}>
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
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
            </div>

            {departments.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Отделы пока не созданы.</div>
            )}
          </div>
        </div>
      </section>

      <style>{`
        .admin-input {
          border: 1px solid rgb(209 213 219);
          background: rgb(249 250 251);
          color: rgb(17 24 39);
          transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .admin-input:hover {
          border-color: rgb(156 163 175);
          background: #fff;
        }
        .admin-input:focus {
          outline: none;
          border-color: rgb(99 102 241);
          background: #fff;
          box-shadow: 0 0 0 3px rgb(99 102 241 / .15);
        }
        .dark .admin-input {
          border-color: rgb(51 65 85);
          background: rgb(30 41 59);
          color: rgb(241 245 249);
        }
        .dark .admin-input:hover {
          border-color: rgb(71 85 105);
          background: rgb(35 46 66);
        }
        .dark .admin-input:focus {
          border-color: rgb(56 189 248);
          background: rgb(35 46 66);
          box-shadow: 0 0 0 3px rgb(56 189 248 / .2);
        }
      `}</style>
    </div>
  )
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success"
  children: React.ReactNode
}) {
  const styles =
    tone === "error"
      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"

  return <div className={cn("rounded-xl border px-4 py-3 text-sm", styles)}>{children}</div>
}