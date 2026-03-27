import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import type { Ticket } from "@/shared/types"
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  cn,
  formatDateTime,
} from "@/lib/utils"

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token")

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      navigate("/tickets", { replace: true })
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/api/tickets/${id}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          throw new Error(`HTTP ${res.status}: ${text}`)
        }
        return res.json()
      })
      .then((data: Ticket) => {
        setTicket(data)
      })
      .catch((err) => {
        console.error("TICKET DETAIL ERROR:", err)
        setError("Не удалось загрузить заявку")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, navigate])

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Заявка</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Заявка</h1>
        <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
          Заявка не найдена
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">#{ticket.number}</span>

          <span
            className={cn(
              "rounded-full px-2 py-1 text-xs font-medium",
              STATUS_COLORS[ticket.status]
            )}
          >
            {STATUS_LABELS[ticket.status]}
          </span>

          <span
            className={cn(
              "rounded-full px-2 py-1 text-xs font-medium",
              PRIORITY_COLORS[ticket.priority]
            )}
          >
            {PRIORITY_LABELS[ticket.priority]}
          </span>
        </div>

        <h1 className="text-2xl font-bold">{ticket.subject}</h1>

        {ticket.category_name && (
          <p className="mt-1 text-sm text-muted-foreground">
            {ticket.category_name}
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <p className="mb-1 text-sm font-medium">Описание</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {ticket.description}
          </p>
        </div>

        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Автор</p>
            <p>{ticket.author_name ?? "—"}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Исполнитель</p>
            <p>{ticket.assignee_name ?? "—"}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Создано</p>
            <p>{formatDateTime(ticket.created_at)}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Обновлено</p>
            <p>{formatDateTime(ticket.updated_at)}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Контактный email</p>
            <p>{ticket.contact_email ?? "—"}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Контактный телефон</p>
            <p>{ticket.contact_phone ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  )
}