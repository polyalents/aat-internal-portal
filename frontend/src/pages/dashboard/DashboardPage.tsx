import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  Ticket,
  Cake,
  Megaphone,
  BookOpen,
  FolderKanban,
  Briefcase,
} from "lucide-react"

import { useAuthStore } from "@/features/auth/store"
import type { BirthdayEntry, Dashboard } from "@/shared/types"
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  cn,
  formatRelative,
  formatDateTime,
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
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Загрузка...</div>
  }

  if (!data) {
    return <div className="py-12 text-center text-muted-foreground">Ошибка загрузки</div>
  }

  const stats = data.ticket_stats

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Главная</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Всего заявок" value={stats.total} color="text-foreground" />
        <StatCard label="Новых" value={stats.new} color="text-blue-800 dark:text-blue-500" />
        <StatCard label="В работе" value={stats.in_progress} color="text-amber-800 dark:text-amber-500" />
        <StatCard label="Завершено" value={stats.completed} color="text-emerald-800 dark:text-emerald-500" />
      </div>

      {isIT() && data.unassigned_tickets.length > 0 && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-orange-500 dark:text-orange-300" />
            Последние заявки без исполнителя
          </h2>

          <div className="space-y-2">
            {data.unassigned_tickets.slice(0, 3).map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    #{t.number} {t.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelative(t.created_at)}</p>
                </div>

                <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", PRIORITY_COLORS[t.priority])}>
                  {PRIORITY_LABELS[t.priority]}
                </span>
              </Link>
            ))}
          </div>

          <Link to="/tickets?scope=unassigned" className="text-sm text-primary hover:underline">
            Все новые без исполнителя →
          </Link>
        </section>
      )}

      {isIT() && data.assigned_tickets && data.assigned_tickets.length > 0 && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Briefcase className="h-4 w-4 text-blue-500 dark:text-blue-300" />
            Мои заявки, принятые в работу
          </h2>

          <div className="space-y-2">
            {data.assigned_tickets.slice(0, 3).map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    #{t.number} {t.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelative(t.created_at)}</p>
                </div>

                <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", STATUS_COLORS[t.status])}>
                  {STATUS_LABELS[t.status]}
                </span>
              </Link>
            ))}
          </div>

          <Link to="/tickets?scope=assigned" className="text-sm text-primary hover:underline">
            Все мои принятые заявки →
          </Link>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Ticket className="h-4 w-4" />
            {isIT() ? "Последние заявки" : "Мои заявки"}
          </h2>

          {data.recent_tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет заявок</p>
          ) : (
            <div className="space-y-2">
              {data.recent_tickets.slice(0, 3).map((t) => (
                <Link
                  key={t.id}
                  to={`/tickets/${t.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{t.number} {t.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRelative(t.created_at)}</p>
                  </div>

                  <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", STATUS_COLORS[t.status])}>
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

        <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Cake className="h-4 w-4 text-pink-500 dark:text-pink-300" />
            Ближайшие дни рождения
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Сегодня</p>
              {data.birthdays_today.length === 0 ? (
                <p className="text-muted-foreground">Нет именинников</p>
              ) : (
                <ul className="space-y-1">
                  {data.birthdays_today.slice(0, 2).map((item) => (
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
                  {birthdaysTomorrow.slice(0, 2).map((item) => (
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
                  {data.birthdays_week.slice(0, 2).map((item) => (
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

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Megaphone className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
            Последние объявления
          </h2>

          {data.recent_announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет актуальных объявлений</p>
          ) : (
            <div className="space-y-3">
              {data.recent_announcements.slice(0, 2).map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(item.published_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link to="/announcements" className="text-sm text-primary hover:underline">
            Все объявления →
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <Link
            to="/knowledge"
            className="group block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-semibold">
                  <BookOpen className="h-5 w-5 text-violet-500 dark:text-violet-300" />
                  База знаний
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Инструкции, ответы на частые вопросы и полезные материалы для сотрудников.
                </p>
                <div className="mt-4 inline-flex items-center text-sm font-medium text-primary group-hover:underline">
                  Открыть базу знаний →
                </div>
              </div>

              <div className="hidden shrink-0 rounded-full bg-violet-500/10 p-3 text-violet-500 dark:text-violet-300 sm:block">
                <FolderKanban className="h-5 w-5" />
              </div>
            </div>
          </Link>
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
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold text-foreground", color)}>{value}</p>
    </div>
  )
} 