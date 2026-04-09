import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Ticket, Cake } from "lucide-react"

import { useAuthStore } from "@/features/auth/store"
import type { BirthdayEntry, Dashboard } from "@/shared/types"
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  cn,
  formatRelative,
} from "@/lib/utils"
import { getBirthdays } from "@/features/employees/api"

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [birthdaysTomorrow, setBirthdaysTomorrow] = useState<BirthdayEntry[]>([])
  const [loading, setLoading] = useState(true)

  const { isIT } = useAuthStore()

  useEffect(() => {
    const token = localStorage.getItem("access_token")

    fetch("/api/dashboard", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        }
        return res.json()
      })
      .then((json: Dashboard) => {
        setData(json)
      })
      .catch((err) => {
        console.error("DASHBOARD FETCH ERROR:", err)
        setData(null)
      })
      .finally(() => {
        setLoading(false)
      })

    getBirthdays("tomorrow")
      .then(setBirthdaysTomorrow)
      .catch((err) => {
        console.error("DASHBOARD BIRTHDAYS TOMORROW ERROR:", err)
        setBirthdaysTomorrow([])
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Загрузка...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Ошибка загрузки
      </div>
    )
  }

  const stats = data.ticket_stats

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Главная</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Всего заявок" value={stats.total} />
        <StatCard label="Новых" value={stats.new} color="text-blue-600" />
        <StatCard label="В работе" value={stats.in_progress} color="text-yellow-600" />
        <StatCard label="Завершено" value={stats.completed} color="text-green-600" />
      </div>

      {isIT() && data.unassigned_tickets.length > 0 && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Нераспределённые заявки ({data.unassigned_tickets.length})
          </h2>

          <div className="space-y-2">
            {data.unassigned_tickets.slice(0, 5).map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    #{t.number} {t.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelative(t.created_at)}
                  </p>
                </div>

                <span
                  className={cn(
                    "whitespace-nowrap rounded-full px-2 py-0.5 text-xs",
                    PRIORITY_COLORS[t.priority]
                  )}
                >
                  {PRIORITY_LABELS[t.priority]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Ticket className="h-4 w-4" />
            {isIT() ? "Последние заявки" : "Мои заявки"}
          </h2>

          {data.recent_tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет заявок</p>
          ) : (
            <div className="space-y-2">
              {data.recent_tickets.map((t) => (
                <Link
                  key={t.id}
                  to={`/tickets/${t.id}`}
                  className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{t.number} {t.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelative(t.created_at)}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-2 py-0.5 text-xs",
                      STATUS_COLORS[t.status]
                    )}
                  >
                    {STATUS_LABELS[t.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <Link to="/tickets" className="text-sm text-primary hover:underline">
            Все заявки →
          </Link>
        </section>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Cake className="h-4 w-4 text-pink-500" />
            Ближайшие дни рождения
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Сегодня</p>
              {data.birthdays_today.length === 0 ? (
                <p className="text-muted-foreground">Нет именинникв</p>
              ) : (
                <ul className="space-y-1">
                  {data.birthdays_today.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <Link to={`/employees/${item.id}`} className="hover:underline">
                        {item.full_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Завтра</p>
              {birthdaysTomorrow.length === 0 ? (
                <p className="text-muted-foreground">Нет именинников</p>
              ) : (
                <ul className="space-y-1">
                  {birthdaysTomorrow.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <Link to={`/employees/${item.id}`} className="hover:underline">
                        {item.full_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">На этой неделе</p>
              {data.birthdays_week.length === 0 ? (
                <p className="text-muted-foreground">Нет именинников</p>
              ) : (
                <ul className="space-y-1">
                  {data.birthdays_week.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <Link to={`/employees/${item.id}`} className="hover:underline">
                        {item.full_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/birthdays" className="text-primary hover:underline">
              Все дни рождения →
            </Link>
            <Link to="/employees?sort=birth_date" className="text-primary hover:underline">
              Сотрудники по дате рождения →
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
    </div>
  )
}