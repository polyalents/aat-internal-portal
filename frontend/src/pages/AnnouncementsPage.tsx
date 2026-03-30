import { useEffect, useMemo, useState } from "react"
import { Calendar, EyeOff, Megaphone, Pencil, Plus, Save, Trash2, X } from "lucide-react"

import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from "@/features/portal/api"
import { useAuthStore } from "@/features/auth/store"
import type { Announcement } from "@/shared/types"
import { formatDateTime, cn } from "@/lib/utils"

type FormState = {
  title: string
  content: string
  expires_at: string
}

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  expires_at: "",
}

function toInputDateTime(value?: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mi = String(date.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

export default function AnnouncementsPage() {
  const { hasRole } = useAuthStore()
  const canManage = useMemo(() => hasRole("admin") || hasRole("it_specialist"), [hasRole])

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function loadAnnouncements() {
    setLoading(true)
    setError(null)

    try {
      const res = await getAnnouncements({
        page,
        size: pageSize,
        active_only: false,
      })

      setAnnouncements(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      console.error(err)
      setAnnouncements([])
      setTotal(0)
      setError("Не удалось загрузить объявления")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAnnouncements()
  }, [page])

  function resetForm() {
    setForm(EMPTY_FORM)
    setIsCreating(false)
    setEditingId(null)
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setIsCreating(true)
  }

  function openEdit(item: Announcement) {
    setIsCreating(false)
    setEditingId(item.id)
    setForm({
      title: item.title,
      content: item.content,
      expires_at: toInputDateTime(item.expires_at),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
      }

      if (editingId) {
        await updateAnnouncement(editingId, payload)
      } else {
        await createAnnouncement(payload)
      }

      resetForm()
      await loadAnnouncements()
    } catch (err) {
      console.error(err)
      setError("Не удалось сохранить объявление")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Удалить объявление?")
    if (!ok) return

    try {
      await deleteAnnouncement(id)
      if (announcements.length === 1 && page > 1) {
        setPage((prev) => prev - 1)
      } else {
        await loadAnnouncements()
      }
    } catch (err) {
      console.error(err)
      setError("Не удалось удалить объявление")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Megaphone className="h-6 w-6" />
            Объявления
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Важные сообщения и обновления для сотрудников
          </p>
        </div>

        {canManage && !isCreating && !editingId && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Новое объявление
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {canManage && (isCreating || editingId) && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Заголовок</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              placeholder="Например: Профилактические работы в пятницу"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Текст объявления</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              className="min-h-[140px] w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              placeholder="Подробности объявления..."
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Срок действия</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Сохранение..." : editingId ? "Сохранить" : "Создать"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Отмена
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          Объявлений пока нет
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => {
            const expired = item.expires_at ? new Date(item.expires_at) < new Date() : false

            return (
              <article
                key={item.id}
                className={cn(
                  "rounded-xl border bg-white p-5 shadow-sm transition",
                  expired ? "border-amber-200 bg-amber-50/40" : "border-gray-200"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {!item.is_active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          <EyeOff className="h-3.5 w-3.5" />
                          Неактивно
                        </span>
                      )}

                      {expired && (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                          Истекло
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                      {item.content}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Опубликовано: {formatDateTime(item.published_at)}
                      </span>

                      {item.expires_at && (
                        <span>Действует до: {formatDateTime(item.expires_at)}</span>
                      )}

                      {item.author_name && <span>Автор: {item.author_name}</span>}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                        title="Редактировать"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:opacity-40"
          >
            Назад
          </button>

          <span className="text-sm text-gray-500">
            {page} из {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  )
}