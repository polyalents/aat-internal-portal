import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Ticket, CalendarHeart, Megaphone, AlertTriangle } from "lucide-react"

import { getDashboard } from "@/features/portal/api"
import { useAuthStore } from "@/features/auth/store"
import {
  formatDate,
  formatRelative,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  cn,
} from "@/lib/utils"

import type { Dashboard } from "@/shared/types"

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const { isIT } = useAuthStore()

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
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