import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  Cake,
  Megaphone,
  Plus,
  Ticket,
} from "lucide-react"

import { useAuthStore } from "@/features/auth/store"
import { getBirthdays } from "@/features/employees/api"
import { getProfile } from "@/shared/api/profile"
import type { BirthdayEntry, Dashboard, Employee } from "@/shared/types"
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  cn,
  formatDateTime,
  formatRelative,
} from "@/lib/utils"

async function getDashboard(): Promise<Dashboard> {
  const token = localStorage.getItem("access_token")
  const response = await fetch("/api/dashboard", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function pendingAssignmentText(count: number): string {
  return `${count} ${pluralize(count, "заявка", "заявки", "заявок")} ${count === 1 ? "ожидает" : "ожидают"} назначения исполнителя`
}

function activeTicketsText(count: number): string {
  return `${count} ${pluralize(count, "заявка", "заявки", "заявок")} ${count === 1 ? "находится" : "находятся"} в работе`
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [profile, setProfile] = useState<Employee | null>(null)
  const [birthdaysTomorrow, setBirthdaysTomorrow] = useState<BirthdayEntry[]>([])
  const [loading, setLoading] = useState(true)

  const { isIT } = useAuthStore()
  const isItUser = isIT()

  const loadDashboard = useCallback(async () => {
    const dashboard = await getDashboard()
    setData(dashboard)
  }, [])

  useEffect(() => {
    let mounted = true

    Promise.all([
      loadDashboard().catch((err) => {
        console.error("DASHBOARD FETCH ERROR:", err)
        if (mounted) setData(null)
      }),
      getProfile()
        .then((result) => {
          if (mounted) setProfile(result)
        })
        .catch((err) => {
          console.error("DASHBOARD PROFILE ERROR:", err)
          if (mounted) setProfile(null)
        }),
      getBirthdays("tomorrow")
        .then((result) => {
          if (mounted) setBirthdaysTomorrow(result)
        })
        .catch((err) => {
          console.error("DASHBOARD BIRTHDAYS TOMORROW ERROR:", err)
          if (mounted) setBirthdaysTomorrow([])
        }),
    ]).finally(() => {
      if (mounted) setLoading(false)
    })

    function refreshDashboard() {
      void loadDashboard().catch(() => { })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshDashboard()
      }
    }

    window.addEventListener("focus", refreshDashboard)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    const intervalId = window.setInterval(refreshDashboard, 30000)

    return () => {
      mounted = false
      window.removeEventListener("focus", refreshDashboard)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.clearInterval(intervalId)
    }
  }, [loadDashboard])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 6) return "Доброй ночи"
    if (h < 12) return "Доброе утро"
    if (h < 18) return "Добрый день"
    return "Добрый вечер"
  }, [])

  const fullName = profile?.full_name || "Пользователь"

  const heroSubtitle = useMemo(() => {
    if (!data) return ""

    const stats = data.ticket_stats

    if (isItUser) {
      if (data.unassigned_tickets.length > 0) {
        return pendingAssignmentText(data.unassigned_tickets.length)
      }

      if (data.assigned_tickets.length > 0) {
        return `Сейчас ${activeTicketsText(data.assigned_tickets.length)} за вами`
      }

      if (stats.new > 0) {
        return `В системе есть ${stats.new} ${pluralize(stats.new, "новая заявка", "новые заявки", "новых заявок")}`
      }

      return "Сейчас все заявки распределены по исполнителям"
    }

    if (stats.in_progress > 0) {
      return `У вас ${activeTicketsText(stats.in_progress)}`
    }

    if (stats.new > 0) {
      return `У вас ${stats.new} ${pluralize(stats.new, "новая заявка", "новые заявки", "новых заявок")}`
    }

    if (stats.completed > 0) {
      return `Завершено ${stats.completed} ${pluralize(stats.completed, "обращение", "обращения", "обращений")}`
    }

    return "Здесь отображаются ваши заявки, объявления и ближайшие события компании"
  }, [data, isItUser])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return <div className="py-12 text-center text-muted-foreground">Не удалось загрузить данные</div>
  }

  const s = data.ticket_stats

  const hero = (
    <section className="dash-hero relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/95">
      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">{greeting}</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
            {fullName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            {heroSubtitle}
          </p>
        </div>

        {isItUser && (
          <div className="mt-6 grid gap-3 xl:grid-cols-4 sm:grid-cols-2">
            <MiniStat label="Всего заявок" value={s.total} to="/tickets" />
            <MiniStat
              label="Без исполнителя"
              value={data.unassigned_tickets.length}
              to="/tickets?scope=unassigned"
              dot="bg-sky-500"
            />
            <MiniStat
              label="Назначены мне"
              value={data.assigned_tickets.length}
              to="/tickets?scope=assigned"
              dot="bg-amber-500"
            />
            <MiniStat
              label="Завершено"
              value={s.completed}
              to="/tickets?scope=completed"
              dot="bg-emerald-500"
            />
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/[0.07] blur-3xl dark:bg-sky-500/[0.08]" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-sky-500/[0.06] blur-3xl dark:bg-indigo-500/[0.06]" />
    </section>
  )

  const ticketHeaderActions = isItUser ? (
    <Link to="/tickets" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      Все <ArrowRight className="h-3 w-3" />
    </Link>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to="/tickets/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" />
        Создать заявку
      </Link>
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/50"
      >
        Перейти в раздел
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )

  const ticketBlock = (
    <Card>
      <Header
        icon={<Ticket className="h-5 w-5" />}
        iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
        title={isItUser ? "Заявки" : "Мои заявки"}
      >
        {ticketHeaderActions}
      </Header>

      {!isItUser && (
        <div className="grid gap-3 border-b border-border/60 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniActionStat title="Всего" value={s.total} to="/tickets" tone="default" />
          <MiniActionStat title="Новые" value={s.new} to="/tickets?scope=new" tone="sky" />
          <MiniActionStat title="В работе" value={s.in_progress} to="/tickets?scope=in_progress" tone="amber" />
          <MiniActionStat title="Завершено" value={s.completed} to="/tickets?scope=completed" tone="emerald" />
        </div>
      )}

      {isItUser && data.unassigned_tickets.length > 0 && (
        <AlertBlock
          color="amber"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          title="Требуют назначения"
          subtitle={pendingAssignmentText(data.unassigned_tickets.length)}
        >
          {data.unassigned_tickets.slice(0, 3).map((t) => (
            <TicketMini
              key={t.id}
              id={t.id}
              number={t.number}
              subject={t.subject}
              createdAt={t.created_at}
              badge={
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS]
                  )}
                >
                  {PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS]}
                </span>
              }
            />
          ))}
        </AlertBlock>
      )}

      {isItUser && data.assigned_tickets.length > 0 && (
        <AlertBlock
          color="sky"
          icon={<Briefcase className="h-3.5 w-3.5" />}
          title="Назначены вам"
          subtitle={activeTicketsText(data.assigned_tickets.length)}
        >
          {data.assigned_tickets.slice(0, 3).map((t) => (
            <TicketMini
              key={t.id}
              id={t.id}
              number={t.number}
              subject={t.subject}
              createdAt={t.created_at}
              badge={
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    STATUS_COLORS[t.status as keyof typeof STATUS_COLORS]
                  )}
                >
                  {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS]}
                </span>
              }
            />
          ))}
        </AlertBlock>
      )}

      {data.recent_tickets.length > 0 ? (
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">
              {isItUser ? "Последние заявки" : "Мои последние заявки"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isItUser ? "Показываем 3 последних обращения" : "Быстрый доступ к вашим обращениям"}
            </p>
          </div>

          <div className="space-y-2">
            {data.recent_tickets.slice(0, isItUser ? 3 : 5).map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 transition hover:border-border hover:bg-muted/35 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <span className="text-muted-foreground">#{t.number}</span> {t.subject}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(t.created_at)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex w-fit shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      STATUS_COLORS[t.status as keyof typeof STATUS_COLORS]
                    )}
                  >
                    {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS]}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          Заявок пока нет
        </div>
      )}
    </Card>
  )

  const birthdaysBlock = (
    <Card>
      <Header
        icon={<Cake className="h-5 w-5" />}
        iconBg="bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400"
        title="Дни рождения"
      />
      {data.birthdays_today.length === 0 && birthdaysTomorrow.length === 0 && data.birthdays_week.length === 0 ? (
        <EmptyState
          icon={<Cake className="h-8 w-8" />}
          title="Именинников нет"
          description="На этой неделе никто не празднует день рождения"
        />
      ) : (
        <div className="space-y-0.5 px-5 pb-2">
          <BdayGroup label="Сегодня" items={data.birthdays_today} highlight />
          <BdayGroup label="Завтра" items={birthdaysTomorrow} />
          <BdayGroup label="На этой неделе" items={data.birthdays_week} />
        </div>
      )}
      <Footer to="/birthdays" label="Все дни рождения" />
    </Card>
  )

  const announcementsBlock = (
    <Card>
      <Header
        icon={<Megaphone className="h-5 w-5" />}
        iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
        title="Объявления"
      />
      {data.recent_announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title="Нет объявлений"
          description="Новые объявления от руководства появятся здесь"
        />
      ) : (
        <div className="divide-y divide-border/60">
          {data.recent_announcements.slice(0, 3).map((a) => (
            <div key={a.id} className="px-5 py-3">
              <p className="text-sm font-medium leading-tight">{a.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground/60">{formatDateTime(a.published_at)}</p>
            </div>
          ))}
        </div>
      )}
      <Footer to="/announcements" label="Все объявления" />
    </Card>
  )

  const knowledgeBlock = (
    <Link to="/knowledge" className="group block">
      <Card>
        <div className="flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">База знаний</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Инструкции, FAQ и полезные материалы</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </Card>
    </Link>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {hero}

      {isItUser ? (
        <>
          {ticketBlock}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {announcementsBlock}
              {knowledgeBlock}
            </div>
            <div>{birthdaysBlock}</div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {announcementsBlock}
              {knowledgeBlock}
            </div>
            <div>{birthdaysBlock}</div>
          </div>
          {ticketBlock}
        </>
      )}

      <style>{`
        .dash-hero {
          border-radius: 2rem;
          border: 1px solid hsl(var(--border));
          background:
            radial-gradient(circle at top right, rgb(56 189 248 / 0.08), transparent 30%),
            radial-gradient(circle at bottom left, rgb(99 102 241 / 0.08), transparent 28%),
            hsl(var(--card));
          box-shadow:
            -20px 0 40px -18px rgb(99 102 241 / 0.22),
            20px 0 40px -18px rgb(14 165 233 / 0.18),
            0 6px 22px -10px rgb(99 102 241 / 0.12);
        }
        .dark .dash-hero {
          box-shadow:
            -22px 0 44px -16px rgb(56 189 248 / 0.18),
            22px 0 44px -16px rgb(139 92 246 / 0.16),
            0 6px 22px -10px rgb(56 189 248 / 0.08);
        }
        .dash-card {
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          box-shadow:
            -10px 0 20px -14px rgb(99 102 241 / 0.14),
            10px 0 20px -14px rgb(14 165 233 / 0.1),
            0 1px 3px rgb(0 0 0 / 0.04);
        }
        .dark .dash-card {
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
  return <div className="dash-card overflow-hidden">{children}</div>
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
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconBg)}>{icon}</div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Footer({ to, label }: { to: string; label: string }) {
  return (
    <div className="border-t border-border px-5 py-2.5">
      <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        {label} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function MiniStat({
  label,
  value,
  to,
  dot,
}: {
  label: string
  value: number
  to: string
  dot?: string
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-background/40 px-4 py-3.5 transition hover:border-border hover:bg-muted/35"
    >
      {dot ? (
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
      ) : (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary/25" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="mt-1 truncate text-sm text-muted-foreground">{label}</div>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  )
}

function MiniActionStat({
  title,
  value,
  to,
  tone,
}: {
  title: string
  value: number
  to: string
  tone: "default" | "sky" | "amber" | "emerald"
}) {
  const toneClasses = {
    default: "border-border/60 bg-muted/20",
    sky: "border-sky-200/70 bg-sky-50/60 dark:border-sky-500/20 dark:bg-sky-500/10",
    amber: "border-amber-200/70 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10",
    emerald: "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10",
  }

  return (
    <Link
      to={to}
      className={cn(
        "group rounded-xl border px-3.5 py-3 transition hover:translate-y-[-1px] hover:shadow-sm",
        toneClasses[tone]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-bold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{title}</div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  )
}

function AlertBlock({
  color,
  icon,
  title,
  subtitle,
  children,
}: {
  color: "amber" | "sky"
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
}) {
  const styles = {
    amber: "border-amber-200/80 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/8",
    sky: "border-sky-200/80 bg-sky-50/70 dark:border-sky-500/25 dark:bg-sky-500/8",
  }
  const textStyles = {
    amber: "text-amber-800 dark:text-amber-300",
    sky: "text-sky-800 dark:text-sky-300",
  }

  return (
    <div className={cn("mx-5 mt-4 rounded-2xl border p-3.5 shadow-sm", styles[color])}>
      <div className="mb-2.5 flex items-start gap-2">
        <span className={cn("mt-0.5 shrink-0", textStyles[color])}>{icon}</span>
        <div className="min-w-0">
          <div className={cn("text-xs font-semibold", textStyles[color])}>{title}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function TicketMini({
  id,
  number,
  subject,
  badge,
  createdAt,
}: {
  id: string
  number: number
  subject: string
  badge: ReactNode
  createdAt: string
}) {
  return (
    <Link
      to={`/tickets/${id}`}
      className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm transition hover:border-border hover:bg-muted/35 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          <span className="text-muted-foreground">#{number}</span> {subject}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(createdAt)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {badge}
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
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

function BdayGroup({
  label,
  items,
  highlight,
}: {
  label: string
  items: BirthdayEntry[]
  highlight?: boolean
}) {
  if (items.length === 0) return null

  return (
    <div className="py-2.5">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="space-y-1">
        {items.slice(0, 3).map((b) => (
          <Link
            key={b.id}
            to={`/employees/${b.id}`}
            className={cn(
              "block truncate text-sm hover:underline",
              highlight ? "font-medium text-pink-700 dark:text-pink-300" : "text-foreground/90"
            )}
          >
            {highlight && "🎂 "}
            {b.full_name}
          </Link>
        ))}
      </div>
    </div>
  )
}