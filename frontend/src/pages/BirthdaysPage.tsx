import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Cake, CalendarDays, Gift, User } from "lucide-react"

import type { BirthdayEntry } from "@/shared/types"
import { getBirthdays } from "@/features/employees/api"
import { cn } from "@/lib/utils"

type Period = "today" | "week"

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Сегодня" },
  { value: "week", label: "На этой неделе" },
]

function formatBirthday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  })
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const d = new Date(`${dateStr}T00:00:00`)

  return (
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth()
  )
}

export default function BirthdaysPage() {
  const [period, setPeriod] = useState<Period>("week")
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    getBirthdays(period)
      .then(setBirthdays)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Дни рождения</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Не забудьте поздравить коллег
          </p>
        </div>

        <Cake className="h-8 w-8 text-pink-400" />
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPeriod(opt.value)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-all",
              period === opt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : birthdays.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <CalendarDays className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            Нет дней рождения за выбранный период
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {birthdays.map((entry) => {
            const today = isToday(entry.birth_date)

            return (
              <Link
                key={entry.id}
                to={`/employees/${entry.id}`}
                className={cn(
                  "group rounded-xl border bg-card p-5 transition-all hover:shadow-md",
                  today
                    ? "border-pink-200 bg-pink-50/50 ring-1 ring-pink-200 dark:border-pink-500/30 dark:bg-pink-500/10 dark:ring-pink-500/20"
                    : "border-border"
                )}
              >
                <div className="flex items-center gap-4">
                  {entry.photo_url ? (
                    <img
                      src={entry.photo_url}
                      alt={entry.full_name}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {entry.full_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.position}
                    </p>
                    {entry.department_name && (
                      <p className="truncate text-xs text-muted-foreground/80">
                        {entry.department_name}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-4 flex items-center gap-2 text-sm",
                    today ? "font-semibold text-pink-600 dark:text-pink-300" : "text-muted-foreground"
                  )}
                >
                  {today ? (
                    <Gift className="h-4 w-4 animate-bounce" />
                  ) : (
                    <Cake className="h-4 w-4" />
                  )}

                  <span>{formatBirthday(entry.birth_date)}</span>

                  {today && (
                    <span className="ml-auto rounded-full bg-pink-200 px-2 py-0.5 text-xs text-pink-700 dark:bg-pink-500/20 dark:text-pink-300">
                      Сегодня!
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}