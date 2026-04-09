import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Trash2, X } from "lucide-react"

import type { KnowledgeCategory, KnowledgeArticle } from "@/shared/types"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/features/auth/store"
import { cn } from "@/lib/utils"

type ArticlesResponse = {
  items: KnowledgeArticle[]
  total: number
  page: number
  size: number
}

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
  const [loading, setLoading] = useState(true)

  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false)
  const [showCreateArticleForm, setShowCreateArticleForm] = useState(false)

  const [creatingCategory, setCreatingCategory] = useState(false)
  const [creatingArticle, setCreatingArticle] = useState(false)

  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [articleError, setArticleError] = useState<string | null>(null)

  const [newCategoryName, setNewCategoryName] = useState("")

  const [articleTitle, setArticleTitle] = useState("")
  const [articleContent, setArticleContent] = useState("")
  const [articleCategoryId, setArticleCategoryId] = useState("")

  function authHeaders(extra?: HeadersInit): HeadersInit {
    const token = localStorage.getItem("access_token")
    return {
      ...(extra ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async function loadData() {
    setLoading(true)

    try {
      const [catsRes, articlesRes] = await Promise.all([
        fetch("/api/knowledge/categories", { headers: authHeaders() }),
        fetch("/api/knowledge/articles?page=1&size=20", { headers: authHeaders() }),
      ])

      if (!catsRes.ok) throw new Error(await catsRes.text())
      if (!articlesRes.ok) throw new Error(await articlesRes.text())

      const cats = (await catsRes.json()) as KnowledgeCategory[]
      const articlesJson = (await articlesRes.json()) as ArticlesResponse

      setCategories(cats)
      setArticles(articlesJson.items ?? [])

      if (!articleCategoryId && cats.length > 0) {
        setArticleCategoryId(cats[0].id)
      }
    } catch (e) {
      console.error("LOAD ERROR:", e)
      setCategories([])
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("size", "20")
    if (selectedCategory) params.set("category_id", selectedCategory)
    if (search.trim()) params.set("search", search.trim())

    setLoading(true)

    fetch(`/api/knowledge/articles?${params.toString()}`, {
      headers: authHeaders(),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json() as Promise<ArticlesResponse>
      })
      .then((articlesRes) => {
        setArticles(articlesRes.items ?? [])
      })
      .catch((e) => {
        console.error("ARTICLES ERROR:", e)
        setArticles([])
      })
      .finally(() => setLoading(false))
  }, [selectedCategory, search])

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()

    if (!newCategoryName.trim()) {
      setCategoryError("Введите название категории")
      return
    }

    setCreatingCategory(true)
    setCategoryError(null)

    try {
      const res = await fetch("/api/knowledge/categories", {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          name: newCategoryName.trim(),
          sort_order: 0,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      const created = (await res.json()) as KnowledgeCategory

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

  async function handleDeleteCategory(id: string) {
    if (!confirm("Удалить категорию?")) return

    try {
      const res = await fetch(`/api/knowledge/categories/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })

      if (!res.ok) throw new Error(await res.text())

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

  async function handleCreateArticle(e: React.FormEvent) {
    e.preventDefault()

    if (!articleTitle.trim() || !articleContent.trim() || !articleCategoryId) {
      setArticleError("Заполни всё")
      return
    }

    setCreatingArticle(true)
    setArticleError(null)

    try {
      const res = await fetch("/api/knowledge/articles", {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          title: articleTitle.trim(),
          content: articleContent.trim(),
          category_id: articleCategoryId,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      const created = (await res.json()) as KnowledgeArticle

      setArticleTitle("")
      setArticleContent("")
      setShowCreateArticleForm(false)

      if (!selectedCategory || selectedCategory === created.category_id) {
        setArticles((prev) => [created, ...prev])
      } else {
        setSelectedCategory(created.category_id)
      }
    } catch (e) {
      console.error("CREATE ERROR:", e)
      setArticleError("Не удалось создать статью")
    } finally {
      setCreatingArticle(false)
    }
  }

  async function handleDeleteArticle(id: string) {
    if (!confirm("Удалить статью?")) return

    try {
      const res = await fetch(`/api/knowledge/articles/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })

      if (!res.ok) throw new Error(await res.text())

      setArticles((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      console.error("DELETE ERROR:", e)
      alert("Ошибка удаления")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">База знаний</h1>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCreateCategoryForm((p) => !p)}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm"
            >
              {showCreateCategoryForm ? <X size={16} /> : <Plus size={16} />}
              {showCreateCategoryForm ? "Закрыть категорию" : "Создать категорию"}
            </button>

            <button
              onClick={() => setShowCreateArticleForm((p) => !p)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white"
            >
              {showCreateArticleForm ? <X size={16} /> : <Plus size={16} />}
              {showCreateArticleForm ? "Закрыть статью" : "Создать статью"}
            </button>
          </div>
        )}
      </div>

      {canManage && showCreateCategoryForm && (
        <form onSubmit={handleCreateCategory} className="space-y-3 border rounded-lg p-4">
          <Input
            placeholder="Название категории"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />

          {categoryError && <p className="text-sm text-red-500">{categoryError}</p>}

          <button
            type="submit"
            disabled={creatingCategory}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
          >
            {creatingCategory ? "Создание..." : "Создать категорию"}
          </button>
        </form>
      )}

      {canManage && showCreateArticleForm && (
        <form onSubmit={handleCreateArticle} className="space-y-3 border rounded-lg p-4">
          <Input
            placeholder="Заголовок"
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
          />

          <select
            value={articleCategoryId}
            onChange={(e) => setArticleCategoryId(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2"
          >
            <option value="">Выбери категорию</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <textarea
            placeholder="Текст статьи"
            value={articleContent}
            onChange={(e) => setArticleContent(e.target.value)}
            className="min-h-[140px] w-full rounded-md border border-border px-3 py-2"
          />

          {articleError && <p className="text-sm text-red-500">{articleError}</p>}

          <button
            type="submit"
            disabled={creatingArticle}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
          >
            {creatingArticle ? "Создание..." : "Создать статью"}
          </button>
        </form>
      )}

      <Input
        placeholder="Поиск по статьям..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={cn("block w-full text-left px-3 py-2 rounded-md", !selectedCategory && "bg-accent")}
          >
            Все
          </button>

          {categories.map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-3 py-2",
                selectedCategory === c.id && "bg-accent"
              )}
            >
              <button
                onClick={() => setSelectedCategory(c.id)}
                className="min-w-0 flex-1 truncate text-left text-sm"
              >
                {c.name}
              </button>

              {canManage && (
                <button
                  onClick={() => handleDeleteCategory(c.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 text-red-500 hover:bg-red-50"
                  title="Удалить категорию"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </aside>

        <div className="min-w-0 space-y-2">
          {loading ? (
            <p>Загрузка...</p>
          ) : articles.length === 0 ? (
            <p>Нет статей</p>
          ) : (
            articles.map((a) => (
              <div key={a.id} className="rounded border p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/knowledge/${a.id}`} className="min-w-0 flex-1">
                    <h3 className="font-medium">{a.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {a.content}
                    </p>
                  </Link>

                  {canManage && (
                    <button
                      onClick={() => handleDeleteArticle(a.id)}
                      className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-red-200 px-2 text-xs text-red-500 hover:bg-red-50"
                    >
                      удалить
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}