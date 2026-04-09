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
import {
  cn,
  formatRelative,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/utils"
import { useAuthStore } from "@/features/auth/store"

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "new", label: "Новые" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting", label: "Ожидание" },
  { value: "escalated", label: "Эскалация" },
  { value: "completed", label: "Решено" },
  { value: "rejected", label: "Отклонено" },
]

const STATUS_ICONS: Record<string, React.ReactNode> = {
  new: <Clock className="h-4 w-4" />,
  in_progress: <ArrowUpCircle className="h-4 w-4" />,
  waiting: <Clock className="h-4 w-4" />,
  escalated: <AlertTriangle className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  rejected: <XCircle className="h-4 w-4" />,
}

type TicketScope = "all" | "unassigned" | "assigned"

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
  const [scope, setScope] = useState<TicketScope>(
    (searchParams.get("scope") as TicketScope) || "all"
  )

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params: {
        page: number
        size: number
        status?: string
        search?: string
        archived?: boolean
        unassigned_only?: boolean
        assigned_to_me?: boolean
      } = {
        page,
        size: 20,
        archived,
      }

      if (status) {
        params.status = status
      }
      if (search.trim()) {
        params.search = search.trim()
      }

      if (isIT) {
        if (scope === "unassigned") {
          params.status = "new"
          params.unassigned_only = true
        } else if (scope === "assigned") {
          params.assigned_to_me = true
        }
      }

      const res = await getTickets(params)

      setTickets(res.items)
      setTotal(res.total)
    } catch (err) {
      console.error(err)
      setError("Не удалось загрузить заявки")
    } finally {
      setLoading(false)
    }
  }, [page, status, search, archived, isIT, scope])

  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    const params: Record<string, string> = {}

    if (status) params.status = status
    if (search) params.search = search
    if (page > 1) params.page = String(page)
    if (archived) params.archived = "true"
    if (isIT && scope !== "all") params.scope = scope

    setSearchParams(params, { replace: true })
  }, [status, search, page, archived, scope, isIT, setSearchParams])

  async function handleCleanup() {
    if (!confirm("Удалить старые архивные заявки из базы?")) return

    try {
      setCleanupLoading(true)
      const result = await cleanupOldTickets()
      alert(`Удалено заявок: ${result.deleted}`)
      await fetchTickets()
    } catch (err) {
      console.error(err)
      alert("Не удалось выполнить очистку")
    } finally {
      setCleanupLoading(false)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Заявки</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {archived
              ? "Архив заявок"
              : isIT
                ? scope === "assigned"
                  ? "Мои заявки, принятые в работу"
                  : scope === "unassigned"
                    ? "Новые заявки без исполнителя"
                    : "Все заявки системы"
                : "Мои заявки"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isIT && (
            <button
              onClick={() => setArchived((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 hover:bg-accent sm:w-auto"
            >
              <Archive className="h-4 w-4" />
              {archived ? "Скрыть архив" : "Показать архив"}
            </button>
          )}

          {isAdmin && archived && (
            <button
              onClick={handleCleanup}
              disabled={cleanupLoading}
              className="w-full rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60 sm:w-auto"
            >
              {cleanupLoading ? "Очистка..." : "Очистить старые"}
            </button>
          )}

          <button
            onClick={() => navigate("/tickets/new")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Создать заявку
          </button>
        </div>
      </div>

      {isIT && !archived && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setScope("all")
              setPage(1)
            }}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm transition",
              scope === "all" ? "bg-primary text-white" : "hover:bg-accent"
            )}
          >
            Все заявки
          </button>

          <button
            type="button"
            onClick={() => {
              setScope("unassigned")
              setPage(1)
            }}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm transition",
              scope === "unassigned" ? "bg-primary text-white" : "hover:bg-accent"
            )}
          >
            Без исполнителя
          </button>

          <button
            type="button"
            onClick={() => {
              setScope("assigned")
              setPage(1)
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition",
              scope === "assigned" ? "bg-primary text-white" : "hover:bg-accent"
            )}
          >
            <Briefcase className="h-4 w-4" />
            Мои принятые
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Поиск..."
            className="w-full rounded-lg border py-2 pl-10 pr-4"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="w-full rounded-lg border px-4 py-2 sm:w-auto"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="py-10 text-center text-red-500">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border py-16 text-center">
          <Ticket className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {search || status
              ? "Ничего не найдено"
              : archived
                ? "Архив пуст"
                : "Заявок пока нет"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              to={`/tickets/${t.id}`}
              className="block rounded-xl border p-4 hover:shadow"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">
                      #{t.number || t.id.slice(0, 6)}
                    </span>

                    <span className={cn("flex items-center gap-1 rounded px-2 text-xs", STATUS_COLORS[t.status])}>
                      {STATUS_ICONS[t.status]}
                      {STATUS_LABELS[t.status]}
                    </span>

                    <span className={cn("rounded px-2 text-xs", PRIORITY_COLORS[t.priority])}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>

                    {t.is_archived && (
                      <span className="rounded bg-muted px-2 text-xs text-muted-foreground">
                        Архив
                      </span>
                    )}
                  </div>

                  <div className="break-words font-medium">{t.subject}</div>
                </div>

                <div className="text-xs text-muted-foreground sm:whitespace-nowrap">
                  {formatRelative(t.created_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Назад
          </button>

          <span>
            {page} / {totalPages}
          </span>

          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Вперёд
          </button>
        </div>
      )}
    </div>
  )
}