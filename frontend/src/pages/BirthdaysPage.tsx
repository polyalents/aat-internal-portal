import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  const [isMobile, setIsMobile] = useState(false)

  const month = displayedMonth.getMonth() + 1
  const year = displayedMonth.getFullYear()

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth < 768)
    }

    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])

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

  useEffect(() => {
    if (isMobile) {
      setPopover(null)
    }
  }, [isMobile])

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
  const selectedDayItems = birthdaysByDay.get(selectedDay) ?? []

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

    if (isMobile) {
      setPopover(null)
      return
    }

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

  function renderBirthdayList(items: BirthdayEntry[]) {
    return (
      <div className="space-y-2">
        {items.map((entry) => (
          <Link
            key={entry.id}
            to={`/employees/${entry.id}`}
            className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 transition hover:border-border hover:bg-muted/35"
          >
            {entry.photo_url ? (
              <img
                src={entry.photo_url}
                alt={entry.full_name}
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{entry.position}</p>
            </div>

            <span className="shrink-0 rounded-full border border-pink-200/70 bg-pink-50/70 px-2.5 py-1 text-[11px] font-medium text-pink-700 dark:border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-300">
              {formatBirthday(entry.birth_date)}
            </span>
          </Link>
        ))}
      </div>
    )
  }

  const hero = (
    <section className="bday-hero relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/95">
      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Календарь команды</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
            Дни рождения
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Ближайшие именинники, календарь по месяцам и быстрый переход к сотрудникам.
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-pink-500/[0.07] blur-3xl dark:bg-pink-500/[0.08]" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-indigo-500/[0.06] blur-3xl dark:bg-sky-500/[0.06]" />
    </section>
  )

  const monthCalendar = (
    <Card>
      <Header
        icon={<CalendarDays className="h-5 w-5" />}
        iconBg="bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400"
        title="Календарь дней рождения"
      >
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground">
          <span>Выбранный день:</span>
          <span className="font-medium text-foreground">
            {selectedDay}{" "}
            {displayedMonth.toLocaleDateString("ru-RU", { month: "long" })}
          </span>
        </div>
      </Header>

      <div className="p-4 sm:p-5">
        <div ref={calendarRef} className="relative">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="rounded-xl border border-border bg-background p-2 transition hover:bg-accent"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <h2 className="min-w-0 text-center text-sm font-semibold capitalize md:text-base">
              {displayedMonth.toLocaleDateString("ru-RU", {
                month: "long",
                year: "numeric",
              })}
            </h2>

            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-xl border border-border bg-background p-2 transition hover:bg-accent"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map((cell, idx) => {
              if (cell.day === null) {
                return <div key={`empty-${idx}`} className="h-11 rounded-xl sm:h-12" />
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
                    "relative h-11 rounded-xl border text-sm transition sm:h-12",
                    hasBirthdays
                      ? "border-pink-200/70 bg-pink-50/70 text-pink-700 hover:bg-pink-100 dark:border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-300"
                      : "border-border/60 bg-background hover:bg-accent",
                    isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                    isToday && "font-bold"
                  )}
                >
                  {day}

                  {hasBirthdays && (
                    <>
                      <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-pink-500" />
                      {dayBirthdays.length > 1 && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-pink-500 px-1 text-[10px] leading-4 text-white">
                          {dayBirthdays.length}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {!isMobile && popover && popoverItems.length > 0 && (
            <div
              className="absolute z-20 w-[260px] rounded-2xl border border-border bg-background p-3 shadow-lg"
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
                  className="rounded-lg p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
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
                    className="flex items-center gap-2 rounded-xl border border-border/60 px-2.5 py-2 transition hover:bg-accent"
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

        {isMobile && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                {selectedDay}{" "}
                {displayedMonth.toLocaleDateString("ru-RU", { month: "long" })}
              </p>
            </div>

            {selectedDayItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет дней рождения</p>
            ) : (
              <div className="space-y-2">
                {selectedDayItems.map((entry) => (
                  <Link
                    key={entry.id}
                    to={`/employees/${entry.id}`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 transition hover:bg-accent"
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
            )}
          </div>
        )}
      </div>
    </Card>
  )

  const listBlock = (
    <Card>
      <Header
        icon={<CalendarDays className="h-5 w-5" />}
        iconBg="bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400"
        title="Список именинников"
      >
        <Link
          to="/employees?sort=birth_date"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Все по дате рождения <ListOrdered className="h-3.5 w-3.5" />
        </Link>
      </Header>

      <div className="p-4 sm:p-5">
        {birthdays.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="Именинников нет"
            description="Нет дней рождения за выбранный период"
          />
        ) : (
          renderBirthdayList(birthdays)
        )}
      </div>
    </Card>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {hero}

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card>
          <Header
            icon={<CalendarDays className="h-5 w-5" />}
            iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
            title="Период"
          />

          <div className="p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                    mode === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <Link
                to="/employees?sort=birth_date"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm transition hover:bg-accent"
              >
                <ListOrdered className="h-4 w-4" />
                Все по дате рождения
              </Link>
            </div>
          </div>
        </Card>

        <section className="min-w-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-[2rem] border border-border bg-card">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : mode === "month" ? (
            monthCalendar
          ) : (
            listBlock
          )}
        </section>
      </div>

      <style>{`
        .bday-hero {
          border-radius: 2rem;
          border: 1px solid hsl(var(--border));
          background:
            radial-gradient(circle at top right, rgb(236 72 153 / 0.08), transparent 30%),
            radial-gradient(circle at bottom left, rgb(99 102 241 / 0.08), transparent 28%),
            hsl(var(--card));
          box-shadow:
            -20px 0 40px -18px rgb(236 72 153 / 0.18),
            20px 0 40px -18px rgb(99 102 241 / 0.14),
            0 6px 22px -10px rgb(99 102 241 / 0.12);
        }
        .dark .bday-hero {
          box-shadow:
            -22px 0 44px -16px rgb(236 72 153 / 0.16),
            22px 0 44px -16px rgb(56 189 248 / 0.12),
            0 6px 22px -10px rgb(56 189 248 / 0.08);
        }
        .bday-card {
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          box-shadow:
            -10px 0 20px -14px rgb(99 102 241 / 0.14),
            10px 0 20px -14px rgb(14 165 233 / 0.1),
            0 1px 3px rgb(0 0 0 / 0.04);
        }
        .dark .bday-card {
          box-shadow:
            -12px 0 24px -12px rgb(56 189 248 / 0.12),
            12px 0 24px -12px rgb(139 92 246 / 0.1),
            0 1px 3px rgb(0 0 0 / 0.25);
        }
      `}</style>
    </div>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="bday-card overflow-hidden">{children}</div>
}

function Header({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: ReactNode
  iconBg: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-muted/25 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconBg)}>
          {icon}
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground/40">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium text-foreground/70">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
    </div>
  )
}