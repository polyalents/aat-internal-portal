import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

import type { KnowledgeArticle } from "@/shared/types"
import { formatDateTime } from "@/lib/utils"

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [article, setArticle] = useState<KnowledgeArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      navigate("/knowledge", { replace: true })
      return
    }

    const token = localStorage.getItem("access_token")
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined

    setLoading(true)
    setError(null)

    fetch(`/api/knowledge/articles/${id}`, { headers })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        }
        return res.json() as Promise<KnowledgeArticle>
      })
      .then((data) => {
        setArticle(data)
      })
      .catch((err) => {
        console.error("ARTICLE LOAD ERROR:", err)
        setArticle(null)
        setError("Не удалось загрузить статью")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Загрузка...
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="space-y-4">
        <Link
          to="/knowledge"
          className="inline-flex text-sm text-primary hover:underline"
        >
          ← Назад к базе знаний
        </Link>

        <div className="py-12 text-center text-muted-foreground">
          {error ?? "Статья не найдена"}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/knowledge"
        className="inline-flex text-sm text-primary hover:underline"
      >
        ← Назад к базе знаний
      </Link>

      <article className="space-y-4 rounded-xl border border-border bg-card p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {article.category_name && <span>Категория: {article.category_name}</span>}
            {article.created_at && (
              <span>Создано: {formatDateTime(article.created_at)}</span>
            )}
            {article.updated_at && (
              <span>Обновлено: {formatDateTime(article.updated_at)}</span>
            )}
          </div>
        </header>

        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
          {article.content}
        </div>
      </article>
    </div>
  )
}