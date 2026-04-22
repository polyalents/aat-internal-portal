import { useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import { useNavigate } from "react-router-dom"
import { KeyRound, Plus, Search, Shield, UserCog, Users } from "lucide-react"

import {
  changeAdminUserPassword,
  createAdminUser,
  deactivateAdminUser,
  deleteAdminUser,
  getAdminUsers,
  restoreAdminUser,
  updateAdminUser,
} from "@/features/admin/api"
import type { User, UserRole } from "@/shared/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const ROLES: Array<{ value: UserRole; label: string }> = [
  { value: "employee", label: "Сотрудник" },
  { value: "it_specialist", label: "IT-специалист" },
  { value: "admin", label: "Администратор" },
]

type Mode = "active" | "inactive"

export default function AdminUsersPage() {
  const navigate = useNavigate()

  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState("")
  const [mode, setMode] = useState<Mode>("active")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("employee")

  async function loadUsers(query?: string, nextMode: Mode = mode) {
    setLoading(true)
    setError(null)

    try {
      const data = await getAdminUsers({
        page: 1,
        size: 100,
        search: query || undefined,
        is_active: nextMode === "active",
      })
      setUsers(data.items)
    } catch {
      setError("Не удалось загрузить учётные записи")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers("", mode)
  }, [mode])

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
      const created = await createAdminUser({
        username,
        email,
        password,
        role,
        is_it_manager: false,
      })

      setUsername("")
      setEmail("")
      setPassword("")
      setRole("employee")

      navigate(`/admin/employees?create_for_user=${created.id}`, {
        state: {
          infoMessage: `Создайте карточку сотрудника для профиля «${created.username}».`,
        },
      })
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

  async function handleDeactivate(user: User) {
    setError(null)
    setInfo(null)
    try {
      await deactivateAdminUser(user.id)
      setInfo(`Учётная запись ${user.username} деактивирована`)
      await loadUsers(search)
    } catch {
      setError("Не удалось деактивировать учётную запись")
    }
  }

  async function handleRestore(user: User) {
    setError(null)
    setInfo(null)
    try {
      await restoreAdminUser(user.id)
      setInfo(`Учётная запись ${user.username} восстановлена`)
      await loadUsers(search)
    } catch {
      setError("Не удалось восстановить учётную запись")
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
        setError("Удаление недоступно: учётная запись связана с историческими данными. Используйте деактивацию.")
        return
      }
      setError("Не удалось удалить учётную запись")
    }
  }

  async function handlePasswordChange(user: User) {
    const newPassword = window.prompt(`Введите новый пароль для ${user.username}`)
    if (newPassword === null) return

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
      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/25 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Учётные записи</h2>
                <p className="text-sm text-muted-foreground">
                  Деактивируйте учётные записи с историей данных, удаляйте только неиспользуемые.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={mode === "active" ? "default" : "outline"} onClick={() => setMode("active")}>
                Активные
              </Button>
              <Button variant={mode === "inactive" ? "default" : "outline"} onClick={() => setMode("inactive")}>
                Деактивированные
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-border px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Всего" value={stats.total} />
          <StatCard icon={<UserCog className="h-4 w-4" />} label="IT-специалистов" value={stats.it} />
          <StatCard icon={<Shield className="h-4 w-4" />} label="Администраторов" value={stats.admins} />
          <StatCard icon={<KeyRound className="h-4 w-4" />} label="IT-менеджеров" value={stats.managers} />
        </div>

        <div className="px-5 py-5">
          {error && <Alert tone="error">{error}</Alert>}
          {info && <Alert tone="success">{info}</Alert>}

          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Создать учётную запись</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <Input placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
              <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
              <select
                className="admin-input h-10 rounded-md px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <Button onClick={() => void handleCreate()}>Создать</Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <div className="relative min-w-72 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Поиск по логину или email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void loadUsers(search)}>Найти</Button>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border/60">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/30 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Логин</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Роль</th>
                    <th className="px-4 py-3 font-medium">IT-менеджер</th>
                    <th className="px-4 py-3 font-medium">Связь с сотрудником</th>
                    <th className="px-4 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-border/60 align-top">
                      <td className="px-4 py-3 font-medium">{user.username}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <select
                          className="admin-input h-9 rounded-md px-2.5 text-sm"
                          value={user.role}
                          onChange={(e) => void handleRoleChange(user, e.target.value as UserRole)}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={user.is_it_manager}
                            disabled={user.role === "employee"}
                            onChange={() => void handleManagerToggle(user)}
                          />
                          <span className="text-muted-foreground">{user.is_it_manager ? "Да" : "Нет"}</span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            user.employee_id
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {user.employee_id ? "Привязана" : "Не привязана"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => void handlePasswordChange(user)}>
                            Сменить пароль
                          </Button>
                          {mode === "active" ? (
                            <Button variant="secondary" size="sm" onClick={() => void handleDeactivate(user)}>
                              Деактивировать
                            </Button>
                          ) : (
                            <Button variant="default" size="sm" onClick={() => void handleRestore(user)}>
                              Восстановить
                            </Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => void handleDelete(user)}>
                            Удалить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loading && users.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Данные не найдены.</div>
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold leading-none">{value}</div>
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