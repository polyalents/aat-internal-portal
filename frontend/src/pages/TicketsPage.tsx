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
} from "lucide-react"

import type { Ticket as TicketType } from "@/shared/types"
import { getTickets } from "@/shared/api/tickets"
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
  { value: '', label: 'Все статусы' },
  { value: 'new', label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'waiting', label: 'Ожидание' },
  { value: 'escalated', label: 'Эскалация' },
  { value: 'completed', label: 'Решено' },
  { value: 'rejected', label: 'Закрыто' },
]

const STATUS_ICONS: Record<string, React.ReactNode> = {
  new: <Clock className="h-4 w-4" />,
  in_progress: <ArrowUpCircle className="h-4 w-4" />,
  waiting: <Clock className="h-4 w-4" />,
  escalated: <AlertTriangle className="h-4 w-4" />,
  resolved: <CheckCircle2 className="h-4 w-4" />,
  closed: <XCircle className="h-4 w-4" />,
}

export default function TicketsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()

  const isIT = user?.role === "it_specialist" || user?.role === "admin"

  const [tickets, setTickets] = useState<TicketType[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "")
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params: {
        page: number
        size: number
        status?: string
        search?: string
      } = {
        page,
        size: 20,
      }

      if (status) params.status = status
      if (search.trim()) params.search = search.trim()

      const res = await getTickets(params)

      setTickets(res.items)
      setTotal(res.total)
    } catch (err) {
      console.error(err)
      setError("Не удалось загрузить заявки")
    } finally {
      setLoading(false)
    }
  }, [page, status, search])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    const params: Record<string, string> = {}

    if (status) params.status = status
    if (search) params.search = search
    if (page > 1) params.page = String(page)

    setSearchParams(params, { replace: true })
  }, [status, search, page, setSearchParams])

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Заявки</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isIT ? "Все заявки системы" : "Мои заявки"}
          </p>
        </div>

        <button
          onClick={() => navigate("/tickets/new")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Создать заявку
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Поиск..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 border rounded-lg"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-10">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <Ticket className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {search || status ? "Ничего не найдено" : "Заявок пока нет"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              to={`/tickets/${t.id}`}
              className="block border rounded-xl p-4 hover:shadow"
            >
              <div className="flex justify-between">
                <div>
                  <div className="flex gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      #{t.number || t.id.slice(0, 6)}
                    </span>

                    <span className={cn("text-xs px-2 rounded", STATUS_COLORS[t.status])}>
                      {STATUS_ICONS[t.status]}
                      {STATUS_LABELS[t.status]}
                    </span>

                    <span className={cn("text-xs px-2 rounded", PRIORITY_COLORS[t.priority])}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  </div>

                  <div className="font-medium">{t.subject}</div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {formatRelative(t.created_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-3">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </button>

          <span>{page} / {totalPages}</span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  )
}