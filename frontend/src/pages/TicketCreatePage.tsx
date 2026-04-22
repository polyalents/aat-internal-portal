import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { isAxiosError } from "axios"
import { ArrowLeft, FileText, X } from "lucide-react"

import { getProfile } from "@/shared/api/profile"
import { createTicket, getTicketCategories, uploadAttachment } from "@/shared/api/tickets"
import type { TicketCategory, TicketPriority } from "@/shared/types"

export default function TicketCreatePage() {
  const navigate = useNavigate()
  const [subject, setSubject] = useState(""); const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TicketPriority>("normal"); const [categoryId, setCategoryId] = useState("")
  const [contactPhone, setContactPhone] = useState(""); const [internalPhone, setInternalPhone] = useState("")
  const [roomNumber, setRoomNumber] = useState(""); const [email, setEmail] = useState("")
  const [attachments, setAttachments] = useState<File[]>([]); const [categories, setCategories] = useState<TicketCategory[]>([])
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTicketCategories().then(setCategories).catch(() => { })
    getProfile().then((p) => { setContactPhone(p.mobile_phone ?? ""); setInternalPhone(p.internal_phone ?? ""); setRoomNumber(p.room_number ?? ""); setEmail(p.email ?? "") }).catch(() => { })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null)
    try {
      const ticket = await createTicket({ subject, description, category_id: categoryId, priority, contact_phone: contactPhone || undefined, internal_phone: internalPhone || undefined, room_number: roomNumber || undefined, contact_email: email.trim() || undefined })
      if (attachments.length) await Promise.all(attachments.map((f) => uploadAttachment(ticket.id, f)))
      navigate(`/tickets/${ticket.id}`)
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.detail ?? "Ошибка") : "Не удалось создать заявку")
    } finally { setLoading(false) }
  }

  function fileSizeLabel(s: number) { if (s < 1024) return `${s} B`; if (s < 1048576) return `${(s / 1024).toFixed(1)} KB`; return `${(s / 1048576).toFixed(1)} MB` }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-4 w-4" />Назад</button>

      <div className="portal-card overflow-hidden !rounded-2xl">
        <div className="border-b border-border bg-muted/25 px-5 py-4 sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Создать заявку</h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Заполните форму обращения</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Тема</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Кратко опишите проблему" className="portal-input h-9 w-full rounded-xl px-3 text-sm" required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Описание</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Подробное описание" className="portal-input min-h-[120px] w-full rounded-xl px-3 py-2 text-sm" required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Категория</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="portal-input h-9 w-full rounded-xl px-3 text-sm" required>
                <option value="">Выберите</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Приоритет</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className="portal-input h-9 w-full rounded-xl px-3 text-sm">
                <option value="now">Сейчас</option><option value="today">Сегодня</option><option value="normal">В рабочем порядке</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Контактные данные</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs text-muted-foreground">Телефон</label><input value={contactPhone} readOnly className="portal-input h-8 w-full rounded-lg bg-muted/40 px-3 text-xs" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Внутренний</label><input value={internalPhone} readOnly className="portal-input h-8 w-full rounded-lg bg-muted/40 px-3 text-xs" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Кабинет</label><input value={roomNumber} readOnly className="portal-input h-8 w-full rounded-lg bg-muted/40 px-3 text-xs" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="portal-input h-8 w-full rounded-lg px-3 text-xs" placeholder="name@example.com" /></div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Вложения</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs transition hover:bg-accent">
              <FileText className="h-3.5 w-3.5" /> Выбрать файлы
              <input type="file" multiple className="hidden" onChange={(e) => setAttachments((p) => [...p, ...Array.from(e.target.files ?? [])])} />
            </label>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-1.5 text-xs">
                    <span className="truncate">{f.name} <span className="text-muted-foreground">({fileSizeLabel(f.size)})</span></span>
                    <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="shrink-0 text-red-600"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => navigate(-1)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Отмена</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{loading ? "Создание..." : "Создать"}</button>
          </div>
        </form>
      </div>

      <style>{`
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
      `}</style>
    </div>
  )
}