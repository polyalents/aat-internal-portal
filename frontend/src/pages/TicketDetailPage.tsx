import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import type { Ticket, TicketAssigneeOption, TicketComment, TicketHistory, TicketStatus } from "@/shared/types"
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  cn,
  formatDateTime,
} from "@/lib/utils"

import {
  archiveTicket,
  deleteTicketPermanently,
  getTicket,
  updateTicket,
  getTicketComments,
  addTicketComment,
  getTicketAssignees,
  getTicketHistory,
  restoreTicket,
} from "@/shared/api/tickets"
import { useAuthStore } from "@/features/auth/store"

const ALLOWED_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ["in_progress", "waiting", "escalated", "completed", "rejected"],
  in_progress: ["waiting", "escalated", "completed", "rejected"],
  waiting: ["in_progress", "escalated", "completed", "rejected"],
  escalated: ["in_progress", "waiting", "completed", "rejected"],
  completed: [],
  rejected: [],
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting", label: "Ожидание" },
  { value: "escalated", label: "Эскалация" },
  { value: "completed", label: "Завершено" },
  { value: "rejected", label: "Отклонено" },
]

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const isIT = user?.role === "it_specialist" || user?.role === "admin"
  const isAdmin = user?.role === "admin"

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [history, setHistory] = useState<TicketHistory[]>([])

  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusUpdating, setStatusUpdating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [commentSending, setCommentSending] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [assignees, setAssignees] = useState<TicketAssigneeOption[]>([])
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("")

  const availableNextStatuses = useMemo(() => {
    if (!ticket) return []
    return ALLOWED_STATUS_TRANSITIONS[ticket.status] ?? []
  }, [ticket])

  useEffect(() => {
    if (!id) {
      navigate("/tickets", { replace: true })
      return
    }

    void loadData()
  }, [id, navigate])

  async function loadData() {
    if (!id) return

    try {
      setLoading(true)
      setError(null)

      const ticketData = await getTicket(id)
      setTicket(ticketData)
      setSelectedAssigneeId(ticketData.assignee_id ?? "")

      try {
        const commentsData = await getTicketComments(id)
        setComments(commentsData)
      } catch (commentsErr) {
        console.warn("COMMENTS LOAD WARNING:", commentsErr)
        setComments([])
      }

      try {
        const historyData = await getTicketHistory(id)
        setHistory(historyData)
      } catch (historyErr) {
        console.warn("HISTORY LOAD WARNING:", historyErr)
        setHistory([])
      }

      if (isIT) {
        try {
          const options = await getTicketAssignees()
          setAssignees(options)
        } catch (assigneesErr) {
          console.warn("ASSIGNEES LOAD WARNING:", assigneesErr)
          setAssignees([])
        }
      }
    } catch (err) {
      console.error("TICKET DETAIL ERROR:", err)
      setError("Не удалось загрузить заявку")
    } finally {
      setLoading(false)
    }
  }

  async function handleAssigneeChange() {
    if (!ticket || !isIT) return
    try {
      setAssigning(true)
      const updated = await updateTicket(ticket.id, { assignee_id: selectedAssigneeId || null })
      setTicket(updated)
      const freshHistory = await getTicketHistory(ticket.id)
      setHistory(freshHistory)
    } catch (err: any) {
      console.error("ASSIGN ERROR:", err)
      const backendMessage = err?.response?.data?.detail || err?.message || "Ошибка назначения исполнителя"
      alert(String(backendMessage))
    } finally {
      setAssigning(false)
    }
  }

  async function handleStatusChange(nextStatus: TicketStatus) {
    if (!ticket || !isIT) return
    if (nextStatus === ticket.status) return

    try {
      setStatusUpdating(true)
      const updated = await updateTicket(ticket.id, { status: nextStatus })
      setTicket(updated)

      const freshHistory = await getTicketHistory(ticket.id)
      setHistory(freshHistory)
    } catch (err: any) {
      console.error("STATUS UPDATE ERROR:", err)
      const backendMessage = err?.response?.data?.detail || err?.message || "Ошибка смены статуса"
      alert(String(backendMessage))
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleAddComment() {
    if (!id) return
    const text = newComment.trim()
    if (!text) return

    try {
      setCommentSending(true)
      const comment = await addTicketComment(id, text)
      setComments((prev) => [...prev, comment])
      setNewComment("")
    } catch (err: any) {
      console.error("ADD COMMENT ERROR:", err)
      const backendMessage = err?.response?.data?.detail || err?.message || "Ошибка добавления комментария"
      alert(String(backendMessage))
    } finally {
      setCommentSending(false)
    }
  }

  async function handleArchive() {
    if (!ticket || !isIT) return
    if (!confirm("Архивировать заявку?")) return

    try {
      setArchiveLoading(true)
      const updated = await archiveTicket(ticket.id)
      setTicket(updated)
      const freshHistory = await getTicketHistory(ticket.id)
      setHistory(freshHistory)
    } catch (err: any) {
      console.error("ARCHIVE ERROR:", err)
      alert(String(err?.response?.data?.detail || "Не удалось архивировать заявку"))
    } finally {
      setArchiveLoading(false)
    }
  }

  async function handleRestore() {
    if (!ticket || !isIT) return

    try {
      setArchiveLoading(true)
      const updated = await restoreTicket(ticket.id)
      setTicket(updated)
      const freshHistory = await getTicketHistory(ticket.id)
      setHistory(freshHistory)
    } catch (err: any) {
      console.error("RESTORE ERROR:", err)
      alert(String(err?.response?.data?.detail || "Не удалось восстановить заявку"))
    } finally {
      setArchiveLoading(false)
    }
  }

  async function handleDeletePermanently() {
    if (!ticket || !isAdmin) return
    if (!confirm("Удалить заявку навсегда? Это действие необратимо.")) return

    try {
      setDeleteLoading(true)
      await deleteTicketPermanently(ticket.id)
      navigate("/tickets")
    } catch (err: any) {
      console.error("DELETE ERROR:", err)
      alert(String(err?.response?.data?.detail || "Не удалось удалить заявку"))
    } finally {
      setDeleteLoading(false)
    }
  }

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

  const canArchive = isIT && !ticket.is_archived && ["completed", "rejected"].includes(ticket.status)
  const canRestore = isIT && ticket.is_archived
  const canDeletePermanently = isAdmin && ticket.is_archived

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">#{ticket.number}</span>

            <span className={cn("rounded-full px-2 py-1 text-xs font-medium", STATUS_COLORS[ticket.status])}>
              {STATUS_LABELS[ticket.status]}
            </span>

            <span className={cn("rounded-full px-2 py-1 text-xs font-medium", PRIORITY_COLORS[ticket.priority])}>
              {PRIORITY_LABELS[ticket.priority]}
            </span>

            {ticket.is_archived && (
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                Архив
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold">{ticket.subject}</h1>

          {ticket.category_name && (
            <p className="mt-1 text-sm text-muted-foreground">{ticket.category_name}</p>
          )}
        </div>

        <div className="flex gap-2">
          {canArchive && (
            <button
              type="button"
              disabled={archiveLoading}
              onClick={handleArchive}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
            >
              {archiveLoading ? "Архивация..." : "Архивировать"}
            </button>
          )}

          {canRestore && (
            <button
              type="button"
              disabled={archiveLoading}
              onClick={handleRestore}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
            >
              {archiveLoading ? "Восстановление..." : "Восстановить"}
            </button>
          )}

          {canDeletePermanently && (
            <button
              type="button"
              disabled={deleteLoading}
              onClick={handleDeletePermanently}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {deleteLoading ? "Удаление..." : "Удалить навсегда"}
            </button>
          )}
        </div>
      </div>

      {isIT && !ticket.is_archived && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <p className="mb-2 text-sm font-medium">Сменить статус</p>

            {availableNextStatuses.length === 0 ? (
              <div className="text-sm text-muted-foreground">Для текущего статуса переходов больше нет</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableNextStatuses.map((status) => {
                  const option = STATUS_OPTIONS.find((s) => s.value == status)
                  if (!option) return null

                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={statusUpdating}
                      onClick={() => handleStatusChange(status)}
                      className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-accent disabled:opacity-60"
                    >
                      {statusUpdating ? "Обновление..." : option.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Назначение исполнителя</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                className="min-w-80 rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Не назначен</option>
                {assignees.map((option) => (
                  <option key={option.user_id} value={option.user_id} disabled={!option.is_available}>
                    {option.full_name || option.username}
                    {option.is_it_manager ? " (IT-менеджер)" : ""}
                    {option.is_on_vacation ? " — недоступен (отпуск)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={assigning}
                onClick={() => void handleAssigneeChange()}
                className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-accent disabled:opacity-60"
              >
                {assigning ? "Сохранение..." : "Назначить"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Для назначения доступны только IT-специалисты и IT-менеджер, сотрудники в отпуске недоступны.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <p className="mb-1 text-sm font-medium">Описание</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.description}</p>
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

          {ticket.archived_at && (
            <div>
              <p className="text-muted-foreground">Архивировано</p>
              <p>{formatDateTime(ticket.archived_at)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">История изменений</h2>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">История пока пуста</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{item.changed_by_name ?? "Неизвестно"}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                </div>

                <p className="mt-2 text-muted-foreground">
                  Поле: <span className="text-foreground">{item.field}</span>
                </p>

                <p className="text-muted-foreground">
                  Было: <span className="text-foreground">{item.old_value ?? "—"}</span>
                </p>

                <p className="text-muted-foreground">
                  Стало: <span className="text-foreground">{item.new_value ?? "—"}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Комментарии</h2>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет комментариев</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{comment.author_name ?? "Неизвестно"}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(comment.created_at)}</span>
                </div>

                <p className="whitespace-pre-wrap">{comment.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Написать комментарий..."
            className="min-h-[110px] w-full rounded-lg border border-border px-3 py-2 outline-none"
          />

          <button
            type="button"
            disabled={commentSending || !newComment.trim()}
            onClick={handleAddComment}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            {commentSending ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  )
}