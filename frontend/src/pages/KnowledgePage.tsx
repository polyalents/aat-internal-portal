import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  BookOpen,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"

import {
  createKnowledgeArticle,
  createKnowledgeCategory,
  deleteKnowledgeArticle,
  deleteKnowledgeCategory,
  getKnowledgeArticles,
  getKnowledgeCategories,
  updateKnowledgeArticle,
  updateKnowledgeCategory,
} from "@/shared/api/knowledge"
import RichTextEditor from "@/components/knowledge/RichTextEditor"
import type {
  KnowledgeArticle,
  KnowledgeCategory,
  KnowledgeArticleCreate,
} from "@/shared/types"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/features/auth/store"
import { cn, formatDateTime } from "@/lib/utils"

export default function KnowledgePage() {
  const { hasRole } = useAuthStore()
  const canManage = useMemo(
    () => hasRole("admin") || hasRole("it_specialist"),
    [hasRole]
  )

  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [search, setSearch] = useState("")
  const [categorySearch, setCategorySearch] = useState("")
  const [loading, setLoading] = useState(true)

  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false)
  const [showCreateArticleForm, setShowCreateArticleForm] = useState(false)

  const [creatingCategory, setCreatingCategory] = useState(false)
  const [creatingArticle, setCreatingArticle] = useState(false)
  const [updatingArticle, setUpdatingArticle] = useState(false)
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null)

  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [articleError, setArticleError] = useState<string | null>(null)

  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")

  const [articleTitle, setArticleTitle] = useState("")
  const [articleCategoryId, setArticleCategoryId] = useState("")
  const [articleContentHtml, setArticleContentHtml] = useState("")
  const [articleContentText, setArticleContentText] = useState("")

  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)

  async function loadCategories() {
    const data = await getKnowledgeCategories()
    setCategories(data)

    if (!articleCategoryId && data.length > 0) {
      setArticleCategoryId(data[0].id)
    }
  }

  async function loadArticles() {
    const res = await getKnowledgeArticles({
      page: 1,
      size: 20,
      category_id: selectedCategory,
      search: search.trim() || undefined,
    })
    setArticles(res.items ?? [])
  }

  async function loadAll() {
    setLoading(true)
    try {
      await Promise.all([loadCategories(), loadArticles()])
    } catch (e) {
      console.error("KNOWLEDGE LOAD ERROR:", e)
      setCategories([])
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    void loadArticles().catch((e) => {
      console.error("KNOWLEDGE ARTICLES ERROR:", e)
      setArticles([])
    })
  }, [selectedCategory, search])

  function resetArticleForm() {
    setShowCreateArticleForm(false)
    setEditingArticleId(null)
    setArticleTitle("")
    setArticleContentHtml("")
    setArticleContentText("")
    setArticleError(null)

    if (categories.length > 0) {
      setArticleCategoryId(categories[0].id)
    } else {
      setArticleCategoryId("")
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()

    if (!newCategoryName.trim()) {
      setCategoryError("Введите название категории")
      return
    }

    setCreatingCategory(true)
    setCategoryError(null)

    try {
      const created = await createKnowledgeCategory({
        name: newCategoryName.trim(),
        sort_order: 0,
      })

      setCategories((prev) => [...prev, created])
      setNewCategoryName("")
      setShowCreateCategoryForm(false)

      if (!articleCategoryId) {
        setArticleCategoryId(created.id)
      }
    } catch (e) {
      console.error("CREATE CATEGORY ERROR:", e)
      setCategoryError("Не удалось создать категорию")
    } finally {
      setCreatingCategory(false)
    }
  }

  function startEditCategory(category: KnowledgeCategory) {
    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
  }

  async function handleUpdateCategory(e: React.FormEvent) {
    e.preventDefault()

    if (!editingCategoryId || !editingCategoryName.trim()) return

    setUpdatingCategoryId(editingCategoryId)
    setCategoryError(null)

    try {
      const updated = await updateKnowledgeCategory(editingCategoryId, {
        name: editingCategoryName.trim(),
      })

      setCategories((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      )

      setEditingCategoryId(null)
      setEditingCategoryName("")
    } catch (e) {
      console.error("UPDATE CATEGORY ERROR:", e)
      setCategoryError("Не удалось обновить категорию")
    } finally {
      setUpdatingCategoryId(null)
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Удалить категорию?")) return

    try {
      await deleteKnowledgeCategory(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))

      if (selectedCategory === id) {
        setSelectedCategory(undefined)
      }

      if (articleCategoryId === id) {
        setArticleCategoryId("")
      }
    } catch (e) {
      console.error("DELETE CATEGORY ERROR:", e)
      alert("Не удалось удалить категорию. Возможно, в ней есть статьи.")
    }
  }

  async function handleCreateOrUpdateArticle(e: React.FormEvent) {
    e.preventDefault()

    if (!articleTitle.trim() || !articleContentText.trim() || !articleCategoryId) {
      setArticleError("Заполни всё")
      return
    }

    setArticleError(null)

    const payload: KnowledgeArticleCreate = {
      title: articleTitle.trim(),
      category_id: articleCategoryId,
      content_html: articleContentHtml,
      content_text: articleContentText.trim(),
    }

    try {
      if (editingArticleId) {
        setUpdatingArticle(true)
        await updateKnowledgeArticle(editingArticleId, payload)
      } else {
        setCreatingArticle(true)
        await createKnowledgeArticle(payload)
      }

      resetArticleForm()
      await loadArticles()
    } catch (e) {
      console.error("SAVE ARTICLE ERROR:", e)
      setArticleError(
        editingArticleId
          ? "Не удалось обновить статью"
          : "Не удалось создать статью"
      )
    } finally {
      setCreatingArticle(false)
      setUpdatingArticle(false)
    }
  }

  function startEditArticle(article: KnowledgeArticle) {
    setEditingArticleId(article.id)
    setShowCreateArticleForm(true)
    setArticleTitle(article.title)
    setArticleCategoryId(article.category_id)
    setArticleContentHtml(article.content_html ?? "")
    setArticleContentText(article.content_text ?? "")
    setArticleError(null)
  }

  async function handleDeleteArticle(id: string) {
    if (!confirm("Удалить статью?")) return

    try {
      await deleteKnowledgeArticle(id)
      setArticles((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      console.error("DELETE ARTICLE ERROR:", e)
      alert("Ошибка удаления")
    }
  }

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, categorySearch])

  const hero = (
    <section className="know-hero relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/95">
      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">
            Документация и инструкции
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              <BookOpen className="h-5 w-5" />
            </span>
            База знаний
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Инструкции, статьи и внутренние материалы.
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl dark:bg-violet-500/[0.08]" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-sky-500/[0.06] blur-3xl dark:bg-indigo-500/[0.06]" />
    </section>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {hero}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <Header
            icon={<FolderPlus className="h-5 w-5" />}
            iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
            title="Категории"
          >
            {canManage && (
              <button
                onClick={() => {
                  setShowCreateCategoryForm((p) => !p)
                  setEditingCategoryId(null)
                  setEditingCategoryName("")
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                {showCreateCategoryForm ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {showCreateCategoryForm ? "Закрыть" : "Создать"}
              </button>
            )}
          </Header>

          <div className="border-b border-border px-4 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск категории..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="p-4">
            {canManage && showCreateCategoryForm && (
              <form
                onSubmit={handleCreateCategory}
                className="mb-4 space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3"
              >
                <input
                  placeholder="Название категории"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="portal-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                />

                {categoryError && (
                  <p className="text-sm text-red-500">{categoryError}</p>
                )}

                <button
                  type="submit"
                  disabled={creatingCategory}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {creatingCategory ? "Создание..." : "Создать категорию"}
                </button>
              </form>
            )}

            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory(undefined)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition",
                  !selectedCategory
                    ? "border-primary/20 bg-primary/10 text-foreground"
                    : "border-border/60 bg-background hover:bg-accent"
                )}
              >
                <span className="truncate">Все категории</span>
              </button>

              {filteredCategories.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 transition",
                    selectedCategory === c.id
                      ? "border-primary/20 bg-primary/10"
                      : "border-border/60 bg-background hover:bg-accent"
                  )}
                >
                  {editingCategoryId === c.id ? (
                    <form onSubmit={handleUpdateCategory} className="space-y-2">
                      <input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="portal-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={updatingCategoryId === c.id}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(null)
                            setEditingCategoryName("")
                          }}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                        >
                          Отмена
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedCategory(c.id)}
                        className="min-w-0 flex-1 truncate text-left text-sm"
                      >
                        {c.name}
                      </button>

                      {canManage && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditCategory(c)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
                            title="Редактировать категорию"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(c.id)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-500 transition hover:bg-red-50"
                            title="Удалить категорию"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <Header
            icon={<BookOpen className="h-5 w-5" />}
            iconBg="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
            title="Статьи"
          >
            {canManage && (
              <button
                onClick={() => {
                  if (showCreateArticleForm || editingArticleId) {
                    resetArticleForm()
                  } else {
                    setShowCreateArticleForm(true)
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                {showCreateArticleForm ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {showCreateArticleForm ? "Закрыть" : "Создать статью"}
              </button>
            )}
          </Header>

          <div className="border-b border-border px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по статьям..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {canManage && showCreateArticleForm && (
            <div className="border-b border-border px-5 py-5">
              <form onSubmit={handleCreateOrUpdateArticle} className="space-y-4">
                <input
                  placeholder="Заголовок"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  className="portal-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                />

                <select
                  value={articleCategoryId}
                  onChange={(e) => setArticleCategoryId(e.target.value)}
                  className="portal-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">Выбери категорию</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <RichTextEditor
                  value={articleContentHtml}
                  onChange={({ html, text }) => {
                    setArticleContentHtml(html)
                    setArticleContentText(text)
                  }}
                  placeholder="Текст статьи"
                />

                {articleError && (
                  <p className="text-sm text-red-500">{articleError}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={creatingArticle || updatingArticle}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {editingArticleId
                      ? updatingArticle
                        ? "Сохранение..."
                        : "Сохранить изменения"
                      : creatingArticle
                        ? "Создание..."
                        : "Создать статью"}
                  </button>

                  <button
                    type="button"
                    onClick={resetArticleForm}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent"
                  >
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
            ) : articles.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-8 w-8" />}
                title="Нет статей"
                description="Здесь пока пусто"
              />
            ) : (
              <div className="space-y-3">
                {articles.map((a) => (
                  <article
                    key={a.id}
                    className="group rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 transition hover:border-border hover:bg-muted/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/knowledge/${a.id}`} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-foreground transition group-hover:text-primary">
                            {a.title}
                          </h3>
                          {a.category_name && (
                            <span className="rounded-full border border-violet-200/70 bg-violet-50/70 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                              {a.category_name}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {a.content_text ?? ""}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          {a.author_name && <span>Автор: {a.author_name}</span>}
                          <span>Обновлено: {formatDateTime(a.updated_at)}</span>
                        </div>
                      </Link>

                      {canManage && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditArticle(a)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
                            title="Редактировать"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteArticle(a.id)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <style>{`
        .know-hero {
          border-radius: 2rem;
          border: 1px solid hsl(var(--border));
          background:
            radial-gradient(circle at top right, rgb(139 92 246 / 0.08), transparent 30%),
            radial-gradient(circle at bottom left, rgb(14 165 233 / 0.07), transparent 28%),
            hsl(var(--card));
          box-shadow:
            -20px 0 40px -18px rgb(139 92 246 / 0.18),
            20px 0 40px -18px rgb(14 165 233 / 0.12),
            0 6px 22px -10px rgb(99 102 241 / 0.12);
        }
        .dark .know-hero {
          box-shadow:
            -22px 0 44px -16px rgb(139 92 246 / 0.16),
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
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            iconBg
          )}
        >
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