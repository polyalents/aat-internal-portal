import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import type { Ticket, TicketAssigneeOption, TicketComment, TicketHistory, TicketStatus } from "@/shared/types"
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, cn, formatDateTime } from "@/lib/utils"
import { addTicketComment, archiveTicket, deleteTicketPermanently, getTicket, getTicketAssignees, getTicketComments, getTicketHistory, restoreTicket, updateTicket } from "@/shared/api/tickets"
import { useAuthStore } from "@/features/auth/store"

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ["in_progress", "waiting", "escalated", "completed", "rejected"], in_progress: ["waiting", "escalated", "completed", "rejected"],
  waiting: ["in_progress", "escalated", "completed", "rejected"], escalated: ["in_progress", "waiting", "completed", "rejected"], completed: [], rejected: [],
}
const STATUS_OPTS: { value: TicketStatus; label: string }[] = [
  { value: "new", label: "Новая" }, { value: "in_progress", label: "В работе" }, { value: "waiting", label: "Ожидание" },
  { value: "escalated", label: "Эскалация" }, { value: "completed", label: "Завершено" }, { value: "rejected", label: "Отклонено" },
]

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>(); const navigate = useNavigate(); const { user } = useAuthStore()
  const isIT = user?.role === "it_specialist" || user?.role === "admin"; const isAdmin = user?.role === "admin"

  const [ticket, setTicket] = useState<Ticket | null>(null); const [comments, setComments] = useState<TicketComment[]>([]); const [history, setHistory] = useState<TicketHistory[]>([]); const [assignees, setAssignees] = useState<TicketAssigneeOption[]>([])
  const [newComment, setNewComment] = useState(""); const [selAssignee, setSelAssignee] = useState("")
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false); const [assigning, setAssigning] = useState(false); const [commentSending, setCommentSending] = useState(false); const [archiveLoading, setArchiveLoading] = useState(false); const [deleteLoading, setDeleteLoading] = useState(false)

  const nextStatuses = useMemo(() => ticket ? TRANSITIONS[ticket.status] ?? [] : [], [ticket])
  const loadComments = useCallback(async (tid: string) => { try { setComments(await getTicketComments(tid)) } catch { setComments([]) } }, [])
  const loadHistory = useCallback(async (tid: string) => { try { setHistory(await getTicketHistory(tid)) } catch { setHistory([]) } }, [])
  const loadAssignees = useCallback(async () => { if (!isIT) return; try { setAssignees(await getTicketAssignees()) } catch { setAssignees([]) } }, [isIT])
  const refreshHistory = useCallback(async (tid: string) => { try { setHistory(await getTicketHistory(tid)) } catch { } }, [])

  const loadData = useCallback(async () => {
    if (!id) return; setLoading(true); setError(null)
    try { const t = await getTicket(id); setTicket(t); setSelAssignee(t.assignee_id ?? ""); await Promise.allSettled([loadComments(id), loadHistory(id), loadAssignees()]) }
    catch { setError("Не удалось загрузить заявку") } finally { setLoading(false) }
  }, [id, loadAssignees, loadComments, loadHistory])

  useEffect(() => { if (!id) { navigate("/tickets", { replace: true }); return }; void loadData() }, [id, navigate, loadData])

  async function handleAssign() {
    if (!ticket || !isIT) return
    try { setAssigning(true); const u = await updateTicket(ticket.id, { assignee_id: selAssignee || null }); setTicket(u); await refreshHistory(ticket.id) }
    catch (e: any) { alert(e?.response?.data?.detail || "Ошибка") } finally { setAssigning(false) }
  }
  async function handleStatus(s: TicketStatus) {
    if (!ticket || !isIT || s === ticket.status) return
    try { setStatusUpdating(true); const u = await updateTicket(ticket.id, { status: s }); setTicket(u); await refreshHistory(ticket.id) }
    catch (e: any) { alert(e?.response?.data?.detail || "Ошибка") } finally { setStatusUpdating(false) }
  }
  async function handleComment() {
    if (!id || !newComment.trim()) return
    try { setCommentSending(true); const c = await addTicketComment(id, newComment.trim()); setComments((p) => [...p, c]); setNewComment(""); await refreshHistory(id) }
    catch (e: any) { alert(e?.response?.data?.detail || "Ошибка") } finally { setCommentSending(false) }
  }
  async function handleArchive() { if (!ticket || !isIT || !confirm("Архивировать?")) return; try { setArchiveLoading(true); setTicket(await archiveTicket(ticket.id)); await refreshHistory(ticket.id) } catch (e: any) { alert(e?.response?.data?.detail || "Ошибка") } finally { setArchiveLoading(false) } }
  async function handleRestore() { if (!ticket || !isIT) return; try { setArchiveLoading(true); setTicket(await restoreTicket(ticket.id)); await refreshHistory(ticket.id) } catch (e: any) { alert(e?.response?.data?.detail || "Ошибка") } finally { setArchiveLoading(false) } }
  async function handleDelete() { if (!ticket || !isAdmin || !confirm("Удалить навсегда?")) return; try { setDeleteLoading(true); await deleteTicketPermanently(ticket.id); navigate("/tickets") } catch (e: any) { alert(e?.response?.data?.detail || "Ошибка") } finally { setDeleteLoading(false) } }

  if (loading) return <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  if (error) return <div className="mx-auto max-w-4xl space-y-4"><button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Назад</button><div className="portal-card p-6 text-destructive">{error}</div><style>{STYLES}</style></div>
  if (!ticket) return null

  const atts = Array.isArray(ticket.attachments) ? ticket.attachments : []
  const canArchive = isIT && !ticket.is_archived && ["completed", "rejected"].includes(ticket.status)

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-4 w-4" />Назад</button>

      {/* Title */}
      <div className="portal-card overflow-hidden !rounded-2xl px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">#{ticket.number}</span>
          <span className={cn("rounded-full px-2 py-0.5 font-medium", STATUS_COLORS[ticket.status])}>{STATUS_LABELS[ticket.status]}</span>
          <span className={cn("rounded-full px-2 py-0.5 font-medium", PRIORITY_COLORS[ticket.priority])}>{PRIORITY_LABELS[ticket.priority]}</span>
          {ticket.is_archived && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Архив</span>}
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{ticket.subject}</h1>
        {ticket.category_name && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{ticket.category_name}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {canArchive && <button type="button" disabled={archiveLoading} onClick={handleArchive} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60">{archiveLoading ? "..." : "Архивировать"}</button>}
          {isIT && ticket.is_archived && <button type="button" disabled={archiveLoading} onClick={handleRestore} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60">{archiveLoading ? "..." : "Восстановить"}</button>}
          {isAdmin && ticket.is_archived && <button type="button" disabled={deleteLoading} onClick={handleDelete} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60">{deleteLoading ? "..." : "Удалить"}</button>}
        </div>
      </div>

      {/* IT controls */}
      {isIT && !ticket.is_archived && (
        <div className="portal-card space-y-4 p-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Статус</p>
            {!nextStatuses.length ? <p className="text-xs text-muted-foreground">Переходов нет</p> : (
              <div className="flex flex-wrap gap-1.5">{nextStatuses.map((s) => { const o = STATUS_OPTS.find((x) => x.value === s); return o ? <button key={s} type="button" disabled={statusUpdating} onClick={() => handleStatus(s)} className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-60">{statusUpdating ? "..." : o.label}</button> : null })}</div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Исполнитель</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select value={selAssignee} onChange={(e) => setSelAssignee(e.target.value)} className="portal-input h-8 flex-1 rounded-lg px-3 text-xs sm:h-9 sm:text-sm">
                <option value="">Не назначен</option>
                {assignees.map((a) => <option key={a.user_id} value={a.user_id} disabled={!a.is_available}>{a.full_name || a.username}{a.is_it_manager ? " (IT)" : ""}{a.is_on_vacation ? " — отпуск" : ""}</option>)}
              </select>
              <button type="button" disabled={assigning} onClick={handleAssign} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:text-sm">{assigning ? "..." : "Назначить"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Description & meta */}
      <div className="portal-card p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Описание</p>
        <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 sm:text-sm">
          {[
            ["Автор", ticket.author_name], ["Исполнитель", ticket.assignee_name], ["Создано", formatDateTime(ticket.created_at)], ["Обновлено", formatDateTime(ticket.updated_at)],
            ["Email", ticket.contact_email], ["Телефон", ticket.contact_phone], ["Внутренний", ticket.internal_phone], ["Кабинет", ticket.room_number],
          ].map(([l, v]) => v ? <div key={l as string}><p className="text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div> : null)}
        </div>
      </div>

      {/* Attachments */}
      <div className="portal-card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Вложения</p>
        {!atts.length ? <p className="text-xs text-muted-foreground">Нет вложений</p> : (
          <div className="space-y-2">{atts.map((a) => <a key={a.id} href={a.file_path} target="_blank" rel="noopener noreferrer" className="block rounded-xl border p-3 text-sm transition hover:bg-muted/30"><p className="font-medium">{a.filename}</p><p className="text-xs text-muted-foreground">{(a.file_size / 1024).toFixed(1)} KB · {formatDateTime(a.uploaded_at)}</p></a>)}</div>
        )}
      </div>

      {/* History */}
      <div className="portal-card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">История</p>
        {!history.length ? <p className="text-xs text-muted-foreground">Пока пуста</p> : (
          <div className="space-y-2">{history.map((h) => (
            <div key={h.id} className="rounded-xl border p-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{h.changed_by_name ?? "?"}</span><span className="text-[11px] text-muted-foreground">{formatDateTime(h.created_at)}</span></div>
              <p className="mt-1 text-muted-foreground">{h.field}: <span className="text-foreground">{h.old_value ?? "—"}</span> → <span className="text-foreground">{h.new_value ?? "—"}</span></p>
            </div>
          ))}</div>
        )}
      </div>

      {/* Comments */}
      <div className="portal-card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Комментарии</p>
        {!comments.length ? <p className="mb-3 text-xs text-muted-foreground">Пока нет</p> : (
          <div className="mb-4 space-y-2">{comments.map((c) => (
            <div key={c.id} className="rounded-xl border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2"><span className="font-medium">{c.author_name ?? "?"}</span><span className="text-[11px] text-muted-foreground">{formatDateTime(c.created_at)}</span></div>
              <p className="whitespace-pre-wrap text-sm">{c.text}</p>
            </div>
          ))}</div>
        )}
        <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Написать комментарий..." className="portal-input min-h-[90px] w-full rounded-xl px-3 py-2 text-sm" />
        <button type="button" disabled={commentSending || !newComment.trim()} onClick={handleComment} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{commentSending ? "..." : "Отправить"}</button>
      </div>

      <style>{STYLES}</style>
    </div>
  )
}

const STYLES = `
.portal-card { border-radius: 1rem; border: 1px solid hsl(var(--border)); background: hsl(var(--card)); box-shadow: -10px 0 20px -14px rgb(99 102 241/.14), 10px 0 20px -14px rgb(14 165 233/.1), 0 1px 3px rgb(0 0 0/.04); }
.dark .portal-card { box-shadow: -12px 0 24px -12px rgb(56 189 248/.12), 12px 0 24px -12px rgb(139 92 246/.1), 0 1px 3px rgb(0 0 0/.25); }
.portal-input { border: 1px solid rgb(209 213 219); background: rgb(249 250 251); color: rgb(17 24 39); transition: border-color .15s, box-shadow .15s, background .15s; }
.portal-input::placeholder { color: rgb(156 163 175); }
.portal-input:hover { border-color: rgb(156 163 175); background: #fff; }
.portal-input:focus { border-color: rgb(99 102 241); background: #fff; box-shadow: 0 0 0 3px rgb(99 102 241/.15); outline: none; }
.dark .portal-input { border-color: rgb(51 65 85); background: rgb(30 41 59); color: rgb(241 245 249); }
.dark .portal-input::placeholder { color: rgb(100 116 139); }
.dark .portal-input:hover { border-color: rgb(71 85 105); background: rgb(35 46 66); }
.dark .portal-input:focus { border-color: rgb(56 189 248); background: rgb(35 46 66); box-shadow: 0 0 0 3px rgb(56 189 248/.2); }
`