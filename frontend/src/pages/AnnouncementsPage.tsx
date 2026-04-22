import { useEffect, useMemo, useState } from "react"
import {
  Calendar,
  EyeOff,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"

import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from "@/features/portal/api"
import { useAuthStore } from "@/features/auth/store"
import type { Announcement } from "@/shared/types"
import { cn, formatDateTime } from "@/lib/utils"

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

  const hero = (
    <section className="ann-hero relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/95">
      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Внутренние коммуникации</p>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Megaphone className="h-5 w-5" />
            </span>
            Объявления
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Важные сообщения и обновления для сотрудников.
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/[0.07] blur-3xl dark:bg-emerald-500/[0.08]" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-sky-500/[0.06] blur-3xl dark:bg-indigo-500/[0.06]" />
    </section>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {hero}

      <Card>
        <Header
          icon={<Megaphone className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          title="Лента объявлений"
        >
          {canManage && !isCreating && !editingId && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Новое объявление
            </button>
          )}
        </Header>

        {error && (
          <div className="border-b border-border px-5 py-3">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {canManage && (isCreating || editingId) && (
          <div className="border-b border-border px-5 py-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Заголовок</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="portal-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="Например: Профилактические работы в пятницу"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Текст объявления</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  className="portal-input min-h-[160px] w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="Подробности объявления..."
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Срок действия</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                  className="portal-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Сохранение..." : editingId ? "Сохранить" : "Создать"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="px-5 py-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-8 w-8" />}
              title="Объявлений пока нет"
              description="Когда появятся новости для сотрудников, они будут показаны здесь"
            />
          ) : (
            <div className="space-y-4">
              {announcements.map((item) => {
                const expired = item.expires_at ? new Date(item.expires_at) < new Date() : false

                return (
                  <article
                    key={item.id}
                    className={cn(
                      "rounded-2xl border px-5 py-4 transition",
                      expired
                        ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/10"
                        : "border-border/60 bg-muted/20 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {!item.is_active && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              <EyeOff className="h-3.5 w-3.5" />
                              Неактивно
                            </span>
                          )}

                          {expired && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              Истекло
                            </span>
                          )}
                        </div>

                        <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                          {item.content}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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
                            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
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
        </div>

        {!loading && totalPages > 1 && (
          <div className="border-t border-border px-5 py-3">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent disabled:opacity-40"
              >
                Назад
              </button>

              <span className="text-sm text-muted-foreground">
                {page} из {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent disabled:opacity-40"
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </Card>

      <style>{`
        .ann-hero {
          border-radius: 2rem;
          border: 1px solid hsl(var(--border));
          background:
            radial-gradient(circle at top right, rgb(16 185 129 / 0.08), transparent 30%),
            radial-gradient(circle at bottom left, rgb(99 102 241 / 0.08), transparent 28%),
            hsl(var(--card));
          box-shadow:
            -20px 0 40px -18px rgb(16 185 129 / 0.18),
            20px 0 40px -18px rgb(14 165 233 / 0.12),
            0 6px 22px -10px rgb(99 102 241 / 0.12);
        }
        .dark .ann-hero {
          box-shadow:
            -22px 0 44px -16px rgb(16 185 129 / 0.16),
            22px 0 44px -16px rgb(56 189 248 / 0.12),
            0 6px 22px -10px rgb(56 189 248 / 0.08);
        }
        .portal-card {
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          box-shadow:
            -10px 0 20px -14px rgb(99 102 241 / 0.14),
            10px 0 20px -14px rgb(14 165 233 / 0.10),
            0 1px 3px rgb(0 0 0 / 0.04);
        }
        .dark .portal-card {
          box-shadow:
            -12px 0 24px -12px rgb(56 189 248 / 0.12),
            12px 0 24px -12px rgb(139 92 246 / 0.10),
            0 1px 3px rgb(0 0 0 / 0.25);
        }
        .portal-input {
          border: 1px solid rgb(209 213 219);
          background: rgb(249 250 251);
          color: rgb(17 24 39);
          transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .portal-input::placeholder {
          color: rgb(156 163 175);
        }
        .portal-input:hover {
          border-color: rgb(156 163 175);
          background: #fff;
        }
        .portal-input:focus {
          border-color: rgb(99 102 241);
          background: #fff;
          box-shadow: 0 0 0 3px rgb(99 102 241 / .15);
        }
        .dark .portal-input {
          border-color: rgb(51 65 85);
          background: rgb(30 41 59);
          color: rgb(241 245 249);
        }
        .dark .portal-input::placeholder {
          color: rgb(100 116 139);
        }
        .dark .portal-input:hover {
          border-color: rgb(71 85 105);
          background: rgb(35 46 66);
        }
        .dark .portal-input:focus {
          border-color: rgb(56 189 248);
          background: rgb(35 46 66);
          box-shadow: 0 0 0 3px rgb(56 189 248 / .2);
        }
      `}</style>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="portal-card overflow-hidden">{children}</div>
}

function Header({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  children?: React.ReactNode
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
  icon: React.ReactNode
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