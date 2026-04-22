import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, BookOpen, CalendarDays, FolderOpen, User } from "lucide-react"

import { getKnowledgeArticle } from "@/shared/api/knowledge"
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

    setLoading(true)
    setError(null)

    getKnowledgeArticle(id)
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
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <Link
          to="/knowledge"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к базе знаний
        </Link>

        <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center text-muted-foreground">
          {error ?? "Статья не найдена"}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <section className="article-hero relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/95">
        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
          <Link
            to="/knowledge"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к базе знаний
          </Link>

          <div className="mt-4 max-w-4xl">
            <p className="text-sm font-medium text-muted-foreground">Статья базы знаний</p>

            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
              {article.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {article.category_name && (
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-violet-50/70 px-3 py-1 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                  <FolderOpen className="h-4 w-4" />
                  {article.category_name}
                </span>
              )}

              {article.author_name && (
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {article.author_name}
                </span>
              )}

              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Обновлено: {formatDateTime(article.updated_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl dark:bg-violet-500/[0.08]" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-sky-500/[0.06] blur-3xl dark:bg-indigo-500/[0.06]" />
      </section>

      <article className="article-card overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/25 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold">Содержимое статьи</h2>
          </div>
        </div>

        <div className="px-6 py-6">
          <div
            className="knowledge-article prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content_html || "<p></p>" }}
          />
        </div>
      </article>

      <style>{`
        .article-hero {
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

        .dark .article-hero {
          box-shadow:
            -22px 0 44px -16px rgb(139 92 246 / 0.16),
            22px 0 44px -16px rgb(56 189 248 / 0.12),
            0 6px 22px -10px rgb(56 189 248 / 0.08);
        }

        .article-card {
          box-shadow:
            -10px 0 20px -14px rgb(99 102 241 / 0.14),
            10px 0 20px -14px rgb(14 165 233 / 0.10),
            0 1px 3px rgb(0 0 0 / 0.04);
        }

        .dark .article-card {
          box-shadow:
            -12px 0 24px -12px rgb(56 189 248 / 0.12),
            12px 0 24px -12px rgb(139 92 246 / 0.10),
            0 1px 3px rgb(0 0 0 / 0.25);
        }

        .knowledge-article h1 {
          margin: 1rem 0 0.5rem;
          font-size: 1.875rem;
          line-height: 2.25rem;
          font-weight: 700;
        }

        .knowledge-article h2 {
          margin: 0.875rem 0 0.5rem;
          font-size: 1.5rem;
          line-height: 2rem;
          font-weight: 700;
        }

        .knowledge-article p {
          margin: 0.75rem 0;
          line-height: 1.75;
        }

        .knowledge-article ul,
        .knowledge-article ol {
          margin: 0.75rem 0;
          padding-left: 1.25rem;
        }

        .knowledge-article ul {
          list-style: disc;
        }

        .knowledge-article ol {
          list-style: decimal;
        }

        .knowledge-article li {
          margin: 0.25rem 0;
        }

        .knowledge-article blockquote {
          margin: 1rem 0;
          border-left: 3px solid hsl(var(--border));
          padding-left: 0.875rem;
          color: hsl(var(--muted-foreground));
        }

        .knowledge-article pre {
          margin: 1rem 0;
          overflow-x: auto;
          border-radius: 1rem;
          background: rgb(15 23 42);
          padding: 1rem;
          color: rgb(241 245 249);
        }

        .knowledge-article pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }

        .knowledge-article code {
          border-radius: 0.5rem;
          background: rgb(15 23 42 / 0.08);
          padding: 0.15rem 0.4rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.875em;
        }

        .dark .knowledge-article code {
          background: rgb(148 163 184 / 0.12);
        }

        .knowledge-article a {
          color: hsl(var(--primary));
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .knowledge-article img,
        .knowledge-article img.knowledge-editor-image {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
        }

        .knowledge-article img[data-align="left"],
        .knowledge-article img.knowledge-editor-image[data-align="left"] {
          margin: 1rem auto 1rem 0;
        }

        .knowledge-article img[data-align="center"],
        .knowledge-article img.knowledge-editor-image[data-align="center"] {
          margin: 1rem auto;
        }

        .knowledge-article img[data-align="right"],
        .knowledge-article img.knowledge-editor-image[data-align="right"] {
          margin: 1rem 0 1rem auto;
        }
      `}</style>
    </div>
  )
}