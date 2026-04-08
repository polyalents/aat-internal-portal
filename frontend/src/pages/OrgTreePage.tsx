import { useEffect, useMemo, useState } from "react"
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
  showDepartmentBadge = true,
}: {
  node: OrgTreeNode
  level?: number
  showDepartmentBadge?: boolean
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
          <p className="truncate text-xs text-muted-foreground">Должность: {node.position}</p>
          {showDepartmentBadge && (
            <div className="mt-1">
              {node.department_name ? (
                <span className="inline-flex max-w-full items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <span className="truncate">Отдел: {node.department_name}</span>
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md border border-muted-foreground/30 bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Отдел: не указан
                </span>
              )}
            </div>
          )}
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
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              showDepartmentBadge={showDepartmentBadge}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type FlatNode = {
  node: OrgTreeNode
  parentId: string | null
}

type OrgTreeNodeWithDepartmentId = OrgTreeNode & {
  department_id?: string | null
}

function collectFlatNodes(nodes: OrgTreeNode[], parentId: string | null = null): FlatNode[] {
  const result: FlatNode[] = []
  for (const node of nodes) {
    result.push({ node, parentId })
    result.push(...collectFlatNodes(node.children, node.id))
  }
  return result
}

function buildDepartmentTree(items: FlatNode[]): OrgTreeNode[] {
  const itemMap = new Map(items.map((item) => [item.node.id, item]))
  const childrenMap = new Map<string, OrgTreeNode[]>()

  for (const item of items) {
    if (!item.parentId || !itemMap.has(item.parentId)) {
      continue
    }
    const siblings = childrenMap.get(item.parentId) ?? []
    siblings.push(item.node)
    childrenMap.set(item.parentId, siblings)
  }

  const buildNode = (node: OrgTreeNode): OrgTreeNode => ({
    ...node,
    children: (childrenMap.get(node.id) ?? []).map(buildNode),
  })

  const roots = items
    .filter((item) => !item.parentId || !itemMap.has(item.parentId))
    .map((item) => buildNode(item.node))

  return roots
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

  const departmentSections = useMemo(() => {
    const flatNodes = collectFlatNodes(tree)
    const grouped = new Map<string, FlatNode[]>()
    const sectionLabels = new Map<string, string>()

    for (const item of flatNodes) {
      const departmentId = (item.node as OrgTreeNodeWithDepartmentId).department_id ?? null
      const departmentName = item.node.department_name?.trim() || "Без отдела"
      const groupKey = departmentId ? `dept:${departmentId}` : `name:${departmentName}`
      const group = grouped.get(groupKey) ?? []
      group.push(item)
      grouped.set(groupKey, group)
      if (!sectionLabels.has(groupKey)) {
        sectionLabels.set(groupKey, departmentName)
      }
    }

    const sections = Array.from(grouped.entries()).map(([groupKey, items]) => {
      const sectionTree = buildDepartmentTree(items)
      const peopleCount = items.length
      const departmentName = sectionLabels.get(groupKey) ?? "Без отдела"
      return { groupKey, departmentName, sectionTree, peopleCount }
    })

    sections.sort((a, b) => {
      if (a.departmentName === "Без отдела") return 1
      if (b.departmentName === "Без отдела") return -1
      return a.departmentName.localeCompare(b.departmentName, "ru")
    })

    return sections
  }, [tree])

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
          <span>Отделов: {departmentSections.length}</span>
        </div>
      </div>

      {departmentSections.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p>Оргструктура пока не заполнена</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {departmentSections.map((section) => (
            <section key={section.groupKey} className="rounded-xl border border-border bg-card p-4">
              <header className="mb-3 flex items-center justify-between gap-4 border-b border-border pb-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{section.departmentName}</h2>
                </div>
                <span className="text-sm text-muted-foreground">
                  Сотрудников: {section.peopleCount}
                </span>
              </header>

              <div className="space-y-0.5">
                {section.sectionTree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    showDepartmentBadge={section.departmentName === "Без отдела"}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}