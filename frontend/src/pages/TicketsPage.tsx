import { useEffect, useState, useCallback } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  Plus,
  Search,
  Ticket,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  Archive,
  Briefcase,
} from "lucide-react"

import type { Ticket as TicketType } from "@/shared/types"
import { cleanupOldTickets, getTickets } from "@/shared/api/tickets"
import { cn, formatRelative, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/utils"
import { useAuthStore } from "@/features/auth/store"

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Все статусы" }, { value: "new", label: "Новые" }, { value: "in_progress", label: "В работе" },
  { value: "waiting", label: "Ожидание" }, { value: "escalated", label: "Эскалация" }, { value: "completed", label: "Решено" }, { value: "rejected", label: "Отклонено" },
]

const STATUS_ICONS: Record<string, React.ReactNode> = {
  new: <Clock className="h-3.5 w-3.5" />, in_progress: <ArrowUpCircle className="h-3.5 w-3.5" />,
  waiting: <Clock className="h-3.5 w-3.5" />, escalated: <AlertTriangle className="h-3.5 w-3.5" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5" />, rejected: <XCircle className="h-3.5 w-3.5" />,
}

type TicketScope = "all" | "unassigned" | "assigned" | "completed" | "new" | "in_progress"

export default function TicketsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const isIT = user?.role === "it_specialist" || user?.role === "admin"
  const isAdmin = user?.role === "admin"

  const [tickets, setTickets] = useState<TicketType[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "")
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1)
  const [archived, setArchived] = useState(searchParams.get("archived") === "true")
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [scope, setScope] = useState<TicketScope>((searchParams.get("scope") as TicketScope) || "all")

  const fetchTickets = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const p: Record<string, unknown> = { page, size: 20, archived }
      if (search.trim()) p.search = search.trim()
      if (isIT) {
        if (scope === "unassigned") { p.status = "new"; p.unassigned_only = true }
        else if (scope === "assigned") { p.assigned_to_me = true; p.my_work_only = true }
        else if (scope === "completed") p.status = "completed"
        else if (status) p.status = status
      } else {
        if (scope === "new") p.status = "new"
        else if (scope === "in_progress") p.status = "in_progress"
        else if (scope === "completed") p.status = "completed"
        else if (status) p.status = status
      }
      const res = await getTickets(p as Parameters<typeof getTickets>[0])
      setTickets(res.items); setTotal(res.total)
    } catch { setError("Не удалось загрузить заявки") }
    finally { setLoading(false) }
  }, [page, status, search, archived, isIT, scope])

  useEffect(() => { void fetchTickets() }, [fetchTickets])
  useEffect(() => {
    const p: Record<string, string> = {}
    if (search) p.search = search; if (page > 1) p.page = String(page)
    if (archived) p.archived = "true"; if (scope !== "all") p.scope = scope; else if (status) p.status = status
    setSearchParams(p, { replace: true })
  }, [status, search, page, archived, scope, setSearchParams])

  async function handleCleanup() {
    if (!confirm("Удалить старые архивные заявки?")) return
    try { setCleanupLoading(true); const r = await cleanupOldTickets(); alert(`Удалено: ${r.deleted}`); await fetchTickets() }
    catch { alert("Ошибка очистки") } finally { setCleanupLoading(false) }
  }

  const totalPages = Math.ceil(total / 20)
  const pageTitle = archived ? "Архив заявок" : isIT
    ? scope === "assigned" ? "Принятые в работу" : scope === "unassigned" ? "Без исполнителя" : scope === "completed" ? "Завершённые" : "Все заявки"
    : scope === "new" ? "Новые заявки" : scope === "in_progress" ? "В работе" : scope === "completed" ? "Завершённые" : "Мои заявки"

  const scopeButtons = isIT
    ? [{ v: "all" as const, l: "Все" }, { v: "unassigned" as const, l: "Без исполнителя" }, { v: "assigned" as const, l: "Мои", icon: <Briefcase className="h-3.5 w-3.5" /> }, { v: "completed" as const, l: "Завершённые", icon: <CheckCircle2 className="h-3.5 w-3.5" /> }]
    : [{ v: "all" as const, l: "Все" }, { v: "new" as const, l: "Новые" }, { v: "in_progress" as const, l: "В работе", icon: <Briefcase className="h-3.5 w-3.5" /> }, { v: "completed" as const, l: "Завершённые", icon: <CheckCircle2 className="h-3.5 w-3.5" /> }]

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      {/* Header */}
      <div className="portal-card overflow-hidden !rounded-2xl px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Заявки</h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{pageTitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isIT && <button type="button" onClick={() => { setArchived((v) => !v); setPage(1) }} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-accent sm:text-sm"><Archive className="h-3.5 w-3.5" />{archived ? "Скрыть архив" : "Архив"}</button>}
            {isAdmin && archived && <button type="button" onClick={handleCleanup} disabled={cleanupLoading} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60">{cleanupLoading ? "..." : "Очистить"}</button>}
            <button type="button" onClick={() => navigate("/tickets/new")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:text-sm"><Plus className="h-3.5 w-3.5" />Создать</button>
          </div>
        </div>

        {/* Scope tabs */}
        {!archived && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {scopeButtons.map((b) => (
              <button key={b.v} type="button" onClick={() => { setScope(b.v); setStatus(""); setPage(1) }}
                className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm",
                  scope === b.v ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground")}>
                {"icon" in b && b.icon}{b.l}
              </button>
            ))}
          </div>
        )}

        {/* Search + filter */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Поиск..." className="portal-input h-8 w-full rounded-xl pl-9 pr-4 text-xs sm:h-9 sm:text-sm" />
          </div>
          <select value={status} disabled={scope !== "all"} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="portal-input h-8 rounded-xl px-3 text-xs disabled:opacity-50 sm:h-9 sm:w-auto sm:text-sm">
            {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : error ? (
        <div className="portal-card p-6 text-center text-sm text-destructive">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="portal-card flex flex-col items-center p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground/40"><Ticket className="h-8 w-8" /></div>
          <p className="mt-3 text-sm font-medium text-foreground/70">{search || status ? "Ничего не найдено" : archived ? "Архив пуст" : "Заявок пока нет"}</p>
          {!search && !archived && <p className="mt-1 text-xs text-muted-foreground">Создайте первую заявку</p>}
        </div>
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="portal-card group block p-4 transition-all">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">#{t.number || t.id.slice(0, 6)}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_COLORS[t.status as keyof typeof STATUS_COLORS])}>{STATUS_ICONS[t.status]}{STATUS_LABELS[t.status as keyof typeof STATUS_LABELS]}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS])}>{PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS]}</span>
                    {t.is_archived && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Архив</span>}
                  </div>
                  <p className="break-words text-sm font-medium transition-colors group-hover:text-primary">{t.subject}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(t.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="portal-card flex items-center justify-center gap-3 p-3">
          <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs transition hover:bg-accent disabled:opacity-50 sm:text-sm">Назад</button>
          <span className="text-xs text-muted-foreground sm:text-sm">{page} / {totalPages}</span>
          <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs transition hover:bg-accent disabled:opacity-50 sm:text-sm">Вперёд</button>
        </div>
      )}

      <style>{`
        .portal-card { border-radius: 1rem; border: 1px solid hsl(var(--border)); background: hsl(var(--card)); box-shadow: -10px 0 20px -14px rgb(99 102 241/.14), 10px 0 20px -14px rgb(14 165 233/.1), 0 1px 3px rgb(0 0 0/.04); transition: border-color .15s, box-shadow .15s; }
        .dark .portal-card { box-shadow: -12px 0 24px -12px rgb(56 189 248/.12), 12px 0 24px -12px rgb(139 92 246/.1), 0 1px 3px rgb(0 0 0/.25); }
        .portal-card:hover { box-shadow: -12px 0 24px -12px rgb(99 102 241/.2), 12px 0 24px -12px rgb(14 165 233/.16), 0 4px 12px rgb(0 0 0/.06); }
        .dark .portal-card:hover { box-shadow: -14px 0 28px -10px rgb(56 189 248/.18), 14px 0 28px -10px rgb(139 92 246/.14), 0 4px 12px rgb(0 0 0/.3); }
        .portal-input { border: 1px solid rgb(209 213 219); background: rgb(249 250 251); color: rgb(17 24 39); transition: border-color .15s, box-shadow .15s, background .15s; }
        .portal-input::placeholder { color: rgb(156 163 175); }
        .portal-input:hover { border-color: rgb(156 163 175); background: #fff; }
        .portal-input:focus { border-color: rgb(99 102 241); background: #fff; box-shadow: 0 0 0 3px rgb(99 102 241/.15); outline: none; }
        .dark .portal-input { border-color: rgb(51 65 85); background: rgb(30 41 59); color: rgb(241 245 249); }
        .dark .portal-input::placeholder { color: rgb(100 116 139); }
        .dark .portal-input:hover { border-color: rgb(71 85 105); background: rgb(35 46 66); }
        .dark .portal-input:focus { border-color: rgb(56 189 248); background: rgb(35 46 66); box-shadow: 0 0 0 3px rgb(56 189 248/.2); }
      `}</style>
    </div>
  )
}