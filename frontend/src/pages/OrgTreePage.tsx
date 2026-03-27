import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Palmtree,
  User,
} from "lucide-react"

import type { OrgTreeNode } from "@/shared/types"
import { getOrgTree } from "@/features/employees/api"
import { cn } from "@/lib/utils"

function TreeNode({
  node,
  level = 0,
}: {
  node: OrgTreeNode
  level?: number
}) {
  const [expanded, setExpanded] = useState(level < 2)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent",
          level === 0 && "bg-accent/40"
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-0.5 transition-colors hover:bg-muted"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {node.photo_url ? (
          <img
            src={node.photo_url}
            alt={node.full_name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Link
            to={`/employees/${node.id}`}
            className="text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            {node.full_name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {node.position}
            {node.department_name ? ` · ${node.department_name}` : ""}
          </p>
        </div>

        {node.is_on_vacation && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            <Palmtree className="h-3 w-3" />
            Отпуск
          </span>
        )}

        {hasChildren && (
          <span className="text-xs text-muted-foreground">
            {node.children.length}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgTreePage() {
  const [tree, setTree] = useState<OrgTreeNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOrgTree()
      .then(setTree)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Оргструктура</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Иерархия сотрудников компании
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>
            {tree.length}{" "}
            {tree.length === 1 ? "корневой узел" : "корневых узлов"}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {tree.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p>Оргструктура пока не заполнена</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map((node) => (
              <TreeNode key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}