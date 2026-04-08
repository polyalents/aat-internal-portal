import { useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"

import {
  changeAdminUserPassword,
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
} from "@/features/admin/api"
import type { User, UserRole } from "@/shared/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const ROLES: Array<{ value: UserRole; label: string }> = [
  { value: "employee", label: "Сотрудник" },
  { value: "it_specialist", label: "IT-специалист" },
  { value: "admin", label: "Администратор" },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("employee")

  async function loadUsers(query?: string) {
    setLoading(true)
    setError(null)

    try {
      const data = await getAdminUsers({
        page: 1,
        size: 100,
        search: query || undefined,
      })
      setUsers(data.items)
    } catch {
      setError("Не удалось загрузить учётные записи")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const stats = useMemo(
    () => ({
      total: users.length,
      it: users.filter((u) => u.role === "it_specialist").length,
      admins: users.filter((u) => u.role === "admin").length,
      managers: users.filter((u) => u.is_it_manager).length,
    }),
    [users]
  )

  async function handleCreate() {
    if (!username || !email || !password) {
      setError("Заполните логин, email и пароль")
      return
    }

    setError(null)
    setInfo(null)

    try {
      await createAdminUser({ username, email, password, role, is_it_manager: false })
      setUsername("")
      setEmail("")
      setPassword("")
      setRole("employee")
      setInfo("Учётная запись создана")
      await loadUsers(search)
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError("Конфликт: логин или email уже существует")
        return
      }
      setError("Не удалось создать учётную запись")
    }
  }

  async function handleRoleChange(user: User, nextRole: UserRole) {
    setError(null)
    setInfo(null)
    try {
      const patch: { role: UserRole; is_it_manager?: boolean } = { role: nextRole }
      if (nextRole === "employee") {
        patch.is_it_manager = false
      }
      await updateAdminUser(user.id, patch)
      setInfo("Роль обновлена")
      await loadUsers(search)
    } catch {
      setError("Не удалось обновить роль")
    }
  }

  async function handleManagerToggle(user: User) {
    setError(null)
    setInfo(null)
    try {
      await updateAdminUser(user.id, { is_it_manager: !user.is_it_manager })
      setInfo("Признак IT-менеджера обновлён")
      await loadUsers(search)
    } catch {
      setError("Не удалось обновить признак IT-менеджера")
    }
  }

  async function handleDelete(user: User) {
    setError(null)
    setInfo(null)
    try {
      await deleteAdminUser(user.id)
      setInfo(`Учётная запись ${user.username} удалена`)
      await loadUsers(search)
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError("Удаление недоступно: учётная запись используется в связанных данных")
        return
      }
      setError("Не удалось удалить учётную запись")
    }
  }

  async function handlePasswordChange(user: User) {
    const newPassword = window.prompt(`Введите новый пароль для ${user.username}`)
    if (newPassword === null) {
      return
    }

    if (!newPassword.trim()) {
      setError("Новый пароль не может быть пустым")
      return
    }

    setError(null)
    setInfo(null)
    try {
      await changeAdminUserPassword(user.id, { password: newPassword })
      setInfo(`Пароль пользователя ${user.username} успешно обновлён`)
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 422) {
        setError("Пароль должен быть длиной от 6 до 128 символов")
        return
      }
      setError("Не удалось изменить пароль")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Учётные записи</h2>
        <p className="text-sm text-muted-foreground">
          Создание и управление аккаунтами для входа в портал.
        </p>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{info}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border p-3 text-sm">Всего учётных записей: {stats.total}</div>
        <div className="rounded-lg border p-3 text-sm">IT-специалистов: {stats.it}</div>
        <div className="rounded-lg border p-3 text-sm">Администраторов: {stats.admins}</div>
        <div className="rounded-lg border p-3 text-sm">IT-менеджеров: {stats.managers}</div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">Создать учётную запись</h3>
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <Button onClick={() => void handleCreate()}>Создать</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="min-w-72 flex-1" placeholder="Поиск по логину или email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" onClick={() => void loadUsers(search)}>
          Найти
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">Логин</th>
              <th className="p-3">Email</th>
              <th className="p-3">Роль</th>
              <th className="p-3">IT-менеджер</th>
              <th className="p-3">Связь с сотрудником</th>
              <th className="p-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-3">{user.username}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">
                  <select
                    className="h-9 rounded-md border bg-background px-2"
                    value={user.role}
                    onChange={(e) => void handleRoleChange(user, e.target.value as UserRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={user.is_it_manager}
                    disabled={user.role === "employee"}
                    onChange={() => void handleManagerToggle(user)}
                  />
                </td>
                <td className="p-3">{user.employee_id ? "Привязана" : "Не привязана"}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handlePasswordChange(user)}>
                      Сменить пароль
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => void handleDelete(user)}>
                      Удалить
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Данные не найдены.</div>
        )}
      </div>
    </div>
  )
}