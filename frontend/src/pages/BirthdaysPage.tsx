import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  User,
  X,
} from "lucide-react"

import type { BirthdayEntry } from "@/shared/types"
import { getBirthdays } from "@/features/employees/api"
import { cn } from "@/lib/utils"

type PeriodMode = "today" | "tomorrow" | "week" | "month"

type BirthdayPopoverState = {
  day: number
  x: number
  y: number
} | null

const PERIOD_OPTIONS: { value: PeriodMode; label: string }[] = [
  { value: "today", label: "Сегодня" },
  { value: "tomorrow", label: "Завтра" },
  { value: "week", label: "На неделе" },
  { value: "month", label: "Месяц" },
]

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function formatBirthday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}

function isTodayDate(day: number, month: number, year: number): boolean {
  const now = new Date()
  return (
    now.getDate() === day &&
    now.getMonth() + 1 === month &&
    now.getFullYear() === year
  )
}

function periodToApiValue(mode: PeriodMode, month: number): string {
  return mode === "month" ? String(month) : mode
}

function mondayBasedWeekday(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

function buildMonthCells(year: number, month: number): Array<{ day: number | null }> {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const leadingEmpty = mondayBasedWeekday(firstDay)

  const cells: Array<{ day: number | null }> = []

  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push({ day: null })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null })
  }

  return cells
}

export default function BirthdaysPage() {
  const todayRef = useMemo(() => new Date(), [])
  const calendarRef = useRef<HTMLDivElement | null>(null)

  const [mode, setMode] = useState<PeriodMode>("week")
  const [displayedMonth, setDisplayedMonth] = useState(
    new Date(todayRef.getFullYear(), todayRef.getMonth(), 1)
  )
  const [selectedDay, setSelectedDay] = useState(todayRef.getDate())
  const [popover, setPopover] = useState<BirthdayPopoverState>(null)
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([])
  const [loading, setLoading] = useState(true)

  const month = displayedMonth.getMonth() + 1
  const year = displayedMonth.getFullYear()

  useEffect(() => {
    if (mode !== "month") {
      setPopover(null)
      return
    }

    const daysInMonth = new Date(year, month, 0).getDate()
    const defaultDay =
      todayRef.getFullYear() === year && todayRef.getMonth() + 1 === month
        ? todayRef.getDate()
        : 1

    setSelectedDay((prev) => {
      if (prev >= 1 && prev <= daysInMonth) return prev
      return defaultDay
    })
  }, [mode, month, year, todayRef])

  useEffect(() => {
    setLoading(true)

    getBirthdays(periodToApiValue(mode, month))
      .then((data) => {
        setBirthdays(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [mode, month])

  const birthdaysByDay = useMemo(() => {
    const grouped = new Map<number, BirthdayEntry[]>()

    birthdays.forEach((entry) => {
      const day = new Date(`${entry.birth_date}T00:00:00`).getDate()
      const current = grouped.get(day) ?? []
      current.push(entry)
      grouped.set(day, current)
    })

    for (const [day, items] of grouped.entries()) {
      grouped.set(
        day,
        [...items].sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"))
      )
    }

    return grouped
  }, [birthdays])

  const monthCells = useMemo(() => buildMonthCells(year, month), [year, month])
  const popoverItems = popover ? birthdaysByDay.get(popover.day) ?? [] : []

  function goToPrevMonth() {
    setDisplayedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    setPopover(null)
  }

  function goToNextMonth() {
    setDisplayedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    setPopover(null)
  }

  function handleDayClick(
    day: number,
    hasBirthdays: boolean,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    setSelectedDay(day)

    if (!hasBirthdays) {
      setPopover(null)
      return
    }

    const calendarRect = calendarRef.current?.getBoundingClientRect()
    const buttonRect = event.currentTarget.getBoundingClientRect()

    if (!calendarRect) {
      setPopover({ day, x: 0, y: 0 })
      return
    }

    const rawX = buttonRect.left - calendarRect.left + buttonRect.width + 8
    const rawY = buttonRect.top - calendarRect.top

    const maxX = Math.max(12, calendarRect.width - 280)
    const maxY = Math.max(12, calendarRect.height - 180)

    setPopover({
      day,
      x: Math.min(rawX, maxX),
      y: Math.min(rawY, maxY),
    })
  }

  function renderList(items: BirthdayEntry[]) {
    return (
      <div className="space-y-2">
        {items.map((entry) => (
          <Link
            key={entry.id}
            to={`/employees/${entry.id}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition hover:bg-accent"
          >
            {entry.photo_url ? (
              <img
                src={entry.photo_url}
                alt={entry.full_name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{entry.position}</p>
            </div>

            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBirthday(entry.birth_date)}
            </span>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Дни рождения</h1>
          <p className="mt-1 text-sm text-muted-foreground">Не забудьте поздравить коллег</p>
        </div>

        <Link
          to="/employees?sort=birth_date"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <ListOrdered className="h-4 w-4" />
          Все по дате рождения
        </Link>
      </div>

      <div className="flex items-start gap-4">
        <aside className="w-[130px] shrink-0 rounded-xl border border-border bg-card p-1.5">
          <div className="space-y-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={cn(
                  "w-full rounded-md px-2.5 py-2 text-left text-xs font-medium transition",
                  mode === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {loading ? (
            <div className="flex h-44 items-center justify-center rounded-xl border border-border bg-card">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : mode === "month" ? (
            <div ref={calendarRef} className="relative rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="rounded-md border border-border p-1.5 hover:bg-accent"
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <h2 className="text-sm font-semibold md:text-base">
                  {displayedMonth.toLocaleDateString("ru-RU", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>

                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="rounded-md border border-border p-1.5 hover:bg-accent"
                  aria-label="Следующий месяц"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="text-center text-[11px] text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((cell, idx) => {
                  if (cell.day === null) {
                    return <div key={`empty-${idx}`} className="h-10 rounded-md" />
                  }

                  const day = cell.day
                  const dayBirthdays = birthdaysByDay.get(day) ?? []
                  const hasBirthdays = dayBirthdays.length > 0
                  const isSelected = selectedDay === day
                  const isToday = isTodayDate(day, month, year)

                  return (
                    <button
                      key={`day-${day}-${idx}`}
                      type="button"
                      onClick={(event) => handleDayClick(day, hasBirthdays, event)}
                      className={cn(
                        "relative h-10 rounded-md text-sm transition",
                        hasBirthdays
                          ? "bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-500/10 dark:text-pink-300"
                          : "hover:bg-accent",
                        isSelected && "ring-2 ring-primary",
                        isToday && "font-bold"
                      )}
                    >
                      {day}
                      {hasBirthdays && (
                        <>
                          <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-pink-500" />
                          {dayBirthdays.length > 1 && (
                            <span className="absolute right-1 top-1 rounded-full bg-pink-500 px-1 text-[10px] leading-4 text-white">
                              {dayBirthdays.length}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>

              {popover && popoverItems.length > 0 && (
                <div
                  className="absolute z-20 w-[260px] rounded-xl border border-border bg-background p-3 shadow-lg"
                  style={{ left: popover.x, top: popover.y }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {popover.day}{" "}
                      {displayedMonth.toLocaleDateString("ru-RU", { month: "long" })}
                    </p>

                    <button
                      type="button"
                      onClick={() => setPopover(null)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Закрыть"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {popoverItems.map((entry) => (
                      <Link
                        key={entry.id}
                        to={`/employees/${entry.id}`}
                        className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 transition hover:bg-accent"
                      >
                        {entry.photo_url ? (
                          <img
                            src={entry.photo_url}
                            alt={entry.full_name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{entry.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{entry.position}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : birthdays.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">Нет дней рождения за выбранный период</p>
            </div>
          ) : (
            renderList(birthdays)
          )}
        </section>
      </div>
    </div>
  )
}