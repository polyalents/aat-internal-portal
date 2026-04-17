import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react"
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow"
import type { Edge, Node as FlowNode, NodeProps } from "reactflow"
import "reactflow/dist/style.css"

import {
  Building2,
  ChevronDown,
  ChevronRight,
  Crown,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  User as UserIcon,
  UserCircle2,
  UserPlus,
  Users,
  X,
} from "lucide-react"

import client from "@/shared/api/client"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/features/auth/store"

type DepartmentDto = {
  id: string
  name: string
  description?: string | null
  head_id: string | null
  parent_id: string | null
  created_at: string
}

type EmployeeDto = {
  id: string
  user_id?: string | null
  first_name: string
  last_name: string
  middle_name?: string | null
  position?: string | null
  department_id?: string | null
  room_number?: string | null
  internal_phone?: string | null
  mobile_phone?: string | null
  email?: string | null
  birth_date?: string | null
  photo_url?: string | null
  manager_id?: string | null
  vacation_start?: string | null
  vacation_end?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

type EmployeesResponse = {
  items: EmployeeDto[]
  total: number
  page: number
  size: number
}

type TreeEmployee = EmployeeDto & { children: TreeEmployee[] }

type DeptView = {
  id: string
  name: string
  description?: string | null
  head: EmployeeDto | null
  headId: string | null
  parentId: string | null
  employees: EmployeeDto[]
  tree: TreeEmployee[]
  empCount: number
  childCount: number
}

type DeptNodeData = {
  dept: DeptView
  selected: boolean
  isAdmin: boolean
  onSelect: (id: string) => void
  onAddChild: (parentId: string) => void
}

type RootNodeData = {
  name: string
  deptCount: number
  empCount: number
}

const DEPT_META_STORAGE_KEY = "org_tree_dept_meta"

function iq(v: string | null | undefined, q: string): boolean {
  return v ? v.toLowerCase().includes(q) : false
}

function fullName(e: EmployeeDto | null | undefined): string {
  if (!e) return ""
  return [e.last_name, e.first_name, e.middle_name].filter(Boolean).join(" ").trim()
}

function shortName(e: EmployeeDto | null | undefined): string {
  if (!e) return ""
  return [e.first_name, e.last_name].filter(Boolean).join(" ").trim()
}

function normalizeParentId(parentId: string | null | undefined): string | null {
  const normalized = parentId?.trim()
  return normalized ? normalized : null
}

function isOnVacation(e: EmployeeDto): boolean {
  if (!e.vacation_start || !e.vacation_end) return false
  const now = new Date()
  return now >= new Date(e.vacation_start) && now <= new Date(e.vacation_end)
}

function buildEmpTree(emps: EmployeeDto[]): TreeEmployee[] {
  const byId = new Map<string, TreeEmployee>()
  emps.forEach((e) => byId.set(e.id, { ...e, children: [] }))
  const roots: TreeEmployee[] = []

  byId.forEach((e) => {
    if (e.manager_id && byId.has(e.manager_id)) byId.get(e.manager_id)?.children.push(e)
    else roots.push(e)
  })

  return roots
}

function filterEmpTree(node: TreeEmployee, q: string): TreeEmployee | null {
  if (!q) return node
  const matched =
    iq(fullName(node), q) || iq(node.position, q) || iq(node.email, q) || iq(node.internal_phone, q)
  const children = node.children
    .map((child) => filterEmpTree(child, q))
    .filter(Boolean) as TreeEmployee[]
  if (!matched && children.length === 0) return null
  return { ...node, children }
}

function countTree(nodes: TreeEmployee[]): number {
  return nodes.reduce((total, n) => total + 1 + countTree(n.children), 0)
}

function buildViews(depts: DepartmentDto[], emps: EmployeeDto[], query: string): DeptView[] {
  const q = query.trim().toLowerCase()
  const childCountMap = new Map<string, number>()
  const parentMap = new Map<string, string | null>()

  for (const d of depts) {
    const parentId = normalizeParentId(d.parent_id)
    parentMap.set(d.id, parentId)
    if (parentId) childCountMap.set(parentId, (childCountMap.get(parentId) ?? 0) + 1)
  }

  type Internal = DeptView & { matched: boolean }

  const prepared = depts.map((dept): Internal => {
    const deptEmployees = emps.filter((e) => e.department_id === dept.id)
    const head = dept.head_id ? deptEmployees.find((e) => e.id === dept.head_id) ?? null : null
    const tree = buildEmpTree(deptEmployees)
    const filteredTree = q
      ? (tree.map((n) => filterEmpTree(n, q)).filter(Boolean) as TreeEmployee[])
      : tree
    const deptMatched = iq(dept.name, q) || iq(fullName(head), q)
    const hasEmployeeMatch = filteredTree.length > 0
    const matched = q ? deptMatched || hasEmployeeMatch : true

    return {
      id: dept.id,
      name: dept.name,
      description: dept.description ?? null,
      head,
      headId: dept.head_id,
      parentId: normalizeParentId(dept.parent_id),
      employees: deptEmployees,
      tree: q ? (deptMatched && filteredTree.length === 0 ? tree : filteredTree) : tree,
      empCount: q
        ? deptMatched && filteredTree.length === 0
          ? deptEmployees.length
          : countTree(filteredTree)
        : deptEmployees.length,
      childCount: childCountMap.get(dept.id) ?? 0,
      matched,
    }
  })

  if (!q) {
    return prepared.map(({ matched, ...dept }) => {
      void matched
      return dept
    })
  }

  const visibleIds = new Set<string>()

  for (const dept of prepared) {
    if (!dept.matched) continue

    let currentId: string | null = dept.id
    while (currentId) {
      if (visibleIds.has(currentId)) break
      visibleIds.add(currentId)
      currentId = parentMap.get(currentId) ?? null
    }
  }

  return prepared
    .filter((dept) => visibleIds.has(dept.id))
    .map(({ matched, ...dept }) => {
      void matched
      return dept
    })
}

function collectDescendantIds(depts: DepartmentDto[], rootId: string): Set<string> {
  const childMap = new Map<string, string[]>()
  for (const dept of depts) {
    const parentId = normalizeParentId(dept.parent_id)
    if (!parentId) continue
    const list = childMap.get(parentId) ?? []
    list.push(dept.id)
    childMap.set(parentId, list)
  }

  const result = new Set<string>()
  const stack = [rootId]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    const children = childMap.get(current) ?? []
    for (const childId of children) {
      if (!result.has(childId)) {
        result.add(childId)
        stack.push(childId)
      }
    }
  }

  return result
}

type StoredDeptMeta = {
  description?: string | null
  head_id?: string | null
}

function loadDeptMeta(): Record<string, StoredDeptMeta> {
  try {
    const raw = localStorage.getItem(DEPT_META_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, StoredDeptMeta>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveDeptMeta(
  deptId: string,
  nextMeta: { description?: string | null; head_id?: string | null }
): void {
  const current = loadDeptMeta()
  const next = { ...current }
  next[deptId] = {
    description: nextMeta.description ?? null,
    head_id: nextMeta.head_id ?? null,
  }
  localStorage.setItem(DEPT_META_STORAGE_KEY, JSON.stringify(next))
}

async function fetchAllEmployees(): Promise<EmployeeDto[]> {
  const pageSize = 100

  try {
    const first = await client.get<EmployeesResponse | EmployeeDto[]>("/employees/", {
      params: { page: 1, size: pageSize },
    })

    if (Array.isArray(first.data)) return first.data

    const firstItems = first.data?.items ?? []
    const total = first.data?.total ?? firstItems.length

    if (firstItems.length >= total) return firstItems

    const pages = Math.ceil(total / pageSize)
    if (pages <= 1) return firstItems

    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, idx) =>
        client.get<EmployeesResponse>("/employees/", {
          params: { page: idx + 2, size: pageSize },
        })
      )
    )

    return firstItems.concat(...rest.map((r) => r.data?.items ?? []))
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status !== 422) throw error

    const fallback = await client.get<EmployeesResponse | EmployeeDto[]>("/employees/")
    if (Array.isArray(fallback.data)) return fallback.data
    return fallback.data?.items ?? []
  }
}

function deptSearchScore(dept: DeptView, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0

  let score = 0
  if (dept.name.toLowerCase().includes(q)) score += 5
  if (fullName(dept.head).toLowerCase().includes(q)) score += 4

  for (const emp of dept.employees) {
    if (fullName(emp).toLowerCase().includes(q)) score += 2
    if ((emp.position ?? "").toLowerCase().includes(q)) score += 1
  }

  return score
}

const DEPT_W = 340
const DEPT_H = 170
const ROOT_W = 340
const ROOT_H = 92
const GAP_X = 34
const GAP_Y = 86

type LayoutNode = { id: string; children: LayoutNode[]; width: number; x: number; y: number }

function buildLayoutBranch(childrenByParent: Map<string | null, DeptView[]>, parentId: string | null): LayoutNode[] {
  const children = [...(childrenByParent.get(parentId) ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ru"))

  return children.map((dept) => ({
    id: dept.id,
    children: buildLayoutBranch(childrenByParent, dept.id),
    width: 0,
    x: 0,
    y: 0,
  }))
}

function measureSubtree(node: LayoutNode): number {
  if (node.children.length === 0) {
    node.width = DEPT_W
    return node.width
  }

  const childrenWidth = node.children.reduce((sum, child, index) => {
    return sum + measureSubtree(child) + (index > 0 ? GAP_X : 0)
  }, 0)

  node.width = Math.max(DEPT_W, childrenWidth)
  return node.width
}

function placeSubtree(node: LayoutNode, left: number, top: number): void {
  node.x = left + node.width / 2 - DEPT_W / 2
  node.y = top

  let cursor = left
  for (const child of node.children) {
    placeSubtree(child, cursor, top + DEPT_H + GAP_Y)
    cursor += child.width + GAP_X
  }
}

function flattenSubtree(node: LayoutNode, out: Array<{ id: string; x: number; y: number }>): void {
  out.push({ id: node.id, x: node.x, y: node.y })
  node.children.forEach((child) => flattenSubtree(child, out))
}

function layoutTree(
  views: DeptView[],
  isAdmin: boolean,
  onSelect: (id: string) => void,
  onAddChild: (parentId: string) => void
): { nodes: FlowNode[]; edges: Edge[] } {
  const viewMap = new Map(views.map((v) => [v.id, v]))
  const visibleIds = new Set(views.map((d) => d.id))
  const childrenByParent = new Map<string | null, DeptView[]>()

  for (const dept of views) {
    const rawParentId = normalizeParentId(dept.parentId)
    const effectiveParentId = rawParentId && visibleIds.has(rawParentId) ? rawParentId : null
    const list = childrenByParent.get(effectiveParentId) ?? []
    list.push(dept)
    childrenByParent.set(effectiveParentId, list)
  }

  const roots = buildLayoutBranch(childrenByParent, null)
  const treeRoots = roots.filter((r) => r.children.length > 0)
  const soloRoots = roots.filter((r) => r.children.length === 0)
  let treeAreaWidth = 0

  if (treeRoots.length > 0) {
    const ghost: LayoutNode = { id: "__forest__", children: treeRoots, width: 0, x: 0, y: 0 }
    treeAreaWidth = measureSubtree(ghost)
    placeSubtree(ghost, 0, 0)
  }

  const soloStartX = treeRoots.length > 0 ? treeAreaWidth + GAP_X * 4 : 0
  const soloCols = Math.max(1, Math.min(2, soloRoots.length))

  soloRoots.forEach((node, index) => {
    const col = index % soloCols
    const row = Math.floor(index / soloCols)
    node.width = DEPT_W
    node.x = soloStartX + col * (DEPT_W + GAP_X)
    node.y = row * (DEPT_H + GAP_Y)
  })

  const positions: Array<{ id: string; x: number; y: number }> = []
  roots.forEach((root) => flattenSubtree(root, positions))

  const graphWidth = Math.max(ROOT_W, ...positions.map((p) => p.x + DEPT_W))

  const rootId = "company-root"
  const totalEmployees = views.reduce((sum, d) => sum + d.empCount, 0)

  const nodes: FlowNode[] = [
    {
      id: rootId,
      type: "rootNode",
      position: { x: graphWidth / 2 - ROOT_W / 2, y: -ROOT_H - 34 },
      data: {
        name: "Структура компании",
        deptCount: views.length,
        empCount: totalEmployees,
      } satisfies RootNodeData,
      draggable: false,
      selectable: false,
    },
  ]

  const edges: Edge[] = []

  for (const p of positions) {
    const dept = viewMap.get(p.id)
    if (!dept) continue

    const nodeId = `dept-${dept.id}`
    nodes.push({
      id: nodeId,
      type: "deptNode",
      position: { x: p.x, y: p.y },
      data: {
        dept,
        selected: false,
        isAdmin,
        onSelect,
        onAddChild,
      } satisfies DeptNodeData,
      draggable: false,
    })

    const parentId = normalizeParentId(dept.parentId)
    if (parentId && visibleIds.has(parentId)) {
      edges.push({
        id: `e-${dept.id}`,
        source: `dept-${parentId}`,
        target: nodeId,
        type: "step",
        sourceHandle: "out",
        targetHandle: "in",
        style: { stroke: "var(--org-edge)", strokeWidth: 2 },
      })
    } else {
      edges.push({
        id: `e-${dept.id}`,
        source: rootId,
        target: nodeId,
        type: "step",
        sourceHandle: "out",
        targetHandle: "in",
        style: { stroke: "var(--org-edge)", strokeWidth: 2 },
      })
    }
  }

  console.log(
    "LAYOUT views",
    views.map((v) => ({
      id: v.id,
      name: v.name,
      parentId: v.parentId,
    }))
  )

  console.log(
    "LAYOUT nodes",
    nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
    }))
  )

  console.log("LAYOUT edges", edges)

  return { nodes, edges }
}

const CSS = `
.org-tree { --org-edge: #7cc7ff; }
.dark .org-tree { --org-edge: #4d90ff; }
.org-tree .react-flow__edge-path { stroke: var(--org-edge) !important; stroke-width: 2px !important; }
.org-tree .react-flow__edge-interaction { stroke-width: 22px !important; }
.org-tree .react-flow__renderer { background: transparent !important; }
.org-tree .react-flow__node { cursor: default !important; }
.org-tree .react-flow__attribution { display: none !important; }
.org-tree .react-flow__controls {
  background: rgba(255,255,255,.88) !important;
  border: 1px solid rgba(148,163,184,.45) !important;
  border-radius: 14px !important;
  overflow: hidden !important;
  box-shadow: 0 6px 20px rgba(0,0,0,.12) !important;
}
.dark .org-tree .react-flow__controls {
  background: rgba(30,41,59,.85) !important;
  border: 1px solid rgba(148,163,184,.42) !important;
}
.org-tree .react-flow__controls-button {
  width: 38px !important;
  height: 38px !important;
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid rgba(148,163,184,.45) !important;
}
.org-tree .react-flow__controls-button:last-child { border-bottom: none !important; }
.org-tree .react-flow__controls-button:hover { background: rgba(148,163,184,.16) !important; }
.org-tree .react-flow__controls-button svg { fill: #0f172a !important; }
.dark .org-tree .react-flow__controls-button svg { fill: #e2e8f0 !important; }
`

function RootNode({ data }: NodeProps<RootNodeData>) {
  return (
    <div className="w-[340px] rounded-2xl border border-sky-300/70 bg-gradient-to-b from-sky-100/80 to-card px-5 py-4 shadow-md dark:border-sky-400/30 dark:from-sky-500/10">
      <Handle id="out" type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !bg-sky-500 !border-sky-500" />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold leading-tight">{data.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{data.deptCount} отделов · {data.empCount} сотрудников</div>
        </div>
      </div>
    </div>
  )
}

function DeptNode({ data }: NodeProps<DeptNodeData>) {
  console.log("RENDER DeptNode", data.dept.id, data.dept.name)

  const { dept, selected, isAdmin, onSelect, onAddChild } = data
  const headLabel = shortName(dept.head)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(dept.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(dept.id)
        }
      }}
      className={[
        "group relative w-[340px] rounded-2xl border bg-card p-4 text-left shadow-sm transition-all",
        selected
          ? "border-sky-400/80 shadow-lg shadow-sky-200/40 ring-2 ring-sky-300/30 dark:border-sky-500/60 dark:shadow-sky-900/25"
          : "border-border/80 hover:border-sky-300/70 hover:shadow-md dark:hover:border-sky-500/35",
      ].join(" ")}
    >
      <Handle id="in" type="target" position={Position.Top} className="!h-2 !w-2 !border-sky-500 !bg-sky-500" />
      <Handle id="out" type="source" position={Position.Bottom} className="!h-2 !w-2 !border-sky-500 !bg-sky-500" />

      {isAdmin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddChild(dept.id)
          }}
          className="absolute -bottom-4 left-1/2 z-20 hidden h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-sky-400 bg-sky-500 text-white shadow-lg transition hover:bg-sky-600 group-hover:flex"
          title="Добавить отдел в подчинение"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[15px] font-semibold leading-tight">{dept.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{dept.childCount > 0 ? `${dept.childCount} подотделов` : "Без подотделов"}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {dept.head?.photo_url ? (
            <img src={dept.head.photo_url} alt={headLabel} className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">{headLabel || "Руководитель не назначен"}</div>
            <div className="truncate text-[11px] text-muted-foreground">{dept.head?.position || "Укажите руководителя"}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{dept.empCount} сотрудников</span>
      </div>
    </div>
  )
}

const nodeTypes = { rootNode: RootNode, deptNode: DeptNode }

function EmpItem({ node, level = 0, search }: { node: TreeEmployee; level?: number; search: string }) {
  const [open, setOpen] = useState(level < 1 || !!search.trim())
  const hasChildren = node.children.length > 0
  const forcedOpen = Boolean(search.trim())

  return (
    <div>
      <div className="rounded-xl border border-border/60 bg-background/70 p-2.5" style={{ marginLeft: level * 14 }}>
        <div className="flex items-start gap-2">
          <button
            type="button"
            disabled={!hasChildren}
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
            onClick={() => setOpen((prev) => !prev)}
          >
            {hasChildren ? open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" /> : null}
          </button>
          {node.photo_url ? (
            <img src={node.photo_url} alt={fullName(node)} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" /></div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{fullName(node) || "Без имени"}</div>
            <div className="truncate text-[11px] text-muted-foreground">{node.position || "Должность не указана"}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {node.internal_phone && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Внутр.: {node.internal_phone}</span>}
              {isOnVacation(node) && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500">Отпуск</span>}
            </div>
          </div>
        </div>
      </div>
      {(open || forcedOpen) && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => <EmpItem key={child.id} node={child} level={level + 1} search={search} />)}
        </div>
      )}
    </div>
  )
}

function DeptModal({
  open,
  onClose,
  deptToEdit,
  parentId,
  allDepts,
  allEmps,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  deptToEdit: DeptView | null
  parentId: string | null
  allDepts: DepartmentDto[]
  allEmps: EmployeeDto[]
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState("")
  const [headId, setHeadId] = useState("")
  const [selectedParentId, setSelectedParentId] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    if (deptToEdit) {
      setName(deptToEdit.name)
      setHeadId(deptToEdit.headId ?? "")
      setSelectedParentId(deptToEdit.parentId ?? "")
      setDescription(deptToEdit.description ?? "")
    } else {
      setName("")
      setHeadId("")
      setSelectedParentId(parentId ?? "")
      setDescription("")
    }
    setError("")
  }, [open, deptToEdit, parentId])

  const forbiddenParents = useMemo(() => {
    if (!deptToEdit) return new Set<string>()
    return collectDescendantIds(allDepts, deptToEdit.id)
  }, [allDepts, deptToEdit])

  async function submitForm(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Введите название отдела")
      return
    }

    setSaving(true)
    setError("")

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        head_id: headId || null,
        parent_id: selectedParentId || null,
      }

      if (deptToEdit) {
        await client.patch(`/departments/${deptToEdit.id}`, payload)
        saveDeptMeta(deptToEdit.id, {
          description,
          head_id: headId || null,
        })
      } else {
        const created = await client.post<DepartmentDto>("/departments/", payload)
        if (created.data?.id) {
          saveDeptMeta(created.data.id, {
            description,
            head_id: headId || null,
          })
        }
      }

      await onSaved()
      onClose()
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(message || "Не удалось сохранить изменения")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{deptToEdit ? "Редактирование отдела" : "Создание отдела"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Заполните данные отдела</p>
          </div>
          <button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submitForm} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Название</label>
            <Input
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Название отдела"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Руководитель</label>
            <select
              value={headId}
              onChange={(e) => setHeadId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Не назначен —</option>
              {allEmps.map((emp) => (
                <option key={emp.id} value={emp.id}>{fullName(emp)} {emp.position ? `(${emp.position})` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Родительский отдел</label>
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Корневой уровень —</option>
              {allDepts
                .filter((d) => d.id !== deptToEdit?.id && !forbiddenParents.has(d.id))
                .map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Короткое описание отдела"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Сохранение..." : deptToEdit ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmployeeModal({
  open,
  onClose,
  employeesWithoutDept,
  targetDept,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  employeesWithoutDept: EmployeeDto[]
  targetDept: DepartmentDto | null
  onSaved: () => Promise<void>
}) {
  const [employeeId, setEmployeeId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setEmployeeId("")
    setError("")
  }, [open, targetDept])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!targetDept) {
      setError("Сначала выберите отдел")
      return
    }
    if (!employeeId) {
      setError("Выберите сотрудника без отдела")
      return
    }

    setSaving(true)
    setError("")

    try {
      await client.patch(`/employees/${employeeId}`, { department_id: targetDept.id })
      await onSaved()
      onClose()
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(message || "Не удалось прикрепить сотрудника к отделу")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Добавить сотрудника в отдел</h3>
          <button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            Целевой отдел: <span className="font-medium">{targetDept?.name || "—"}</span>
          </div>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">— Выберите сотрудника без отдела —</option>
            {employeesWithoutDept.map((e) => (
              <option key={e.id} value={e.id}>
                {fullName(e)}{e.position ? ` · ${e.position}` : ""}
              </option>
            ))}
          </select>
          {employeesWithoutDept.length === 0 && (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Нет сотрудников без отдела.
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Сохранение..." : "Добавить в отдел"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TransferModal({
  open,
  onClose,
  employees,
  allDepts,
  defaultDeptId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  employees: EmployeeDto[]
  allDepts: DepartmentDto[]
  defaultDeptId: string | null
  onSaved: () => Promise<void>
}) {
  const [employeeId, setEmployeeId] = useState("")
  const [toDeptId, setToDeptId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setEmployeeId("")
    setToDeptId(defaultDeptId ?? "")
    setError("")
  }, [open, defaultDeptId])

  async function handleTransfer(e: FormEvent) {
    e.preventDefault()
    if (!employeeId || !toDeptId) {
      setError("Выберите сотрудника и целевой отдел")
      return
    }

    setSaving(true)
    setError("")

    try {
      await client.patch(`/employees/${employeeId}`, { department_id: toDeptId })
      await onSaved()
      onClose()
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(message || "Не удалось перевести сотрудника")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Перевести сотрудника</h3>
          <button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleTransfer} className="space-y-3">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">— Выберите сотрудника —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}{e.position ? ` · ${e.position}` : ""}</option>)}
          </select>
          <select value={toDeptId} onChange={(e) => setToDeptId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">— Целевой отдел —</option>
            {allDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Перевод..." : "Перевести"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RemoveEmployeeModal({
  open,
  onClose,
  employees,
  targetDeptName,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  employees: EmployeeDto[]
  targetDeptName: string
  onSaved: () => Promise<void>
}) {
  const [employeeId, setEmployeeId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setEmployeeId("")
    setError("")
  }, [open, targetDeptName])

  async function handleRemove(e: FormEvent) {
    e.preventDefault()
    if (!employeeId) {
      setError("Выберите сотрудника")
      return
    }

    setSaving(true)
    setError("")

    try {
      await client.patch(`/employees/${employeeId}`, { department_id: null })
      await onSaved()
      onClose()
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(message || "Не удалось удалить сотрудника из отдела")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Удалить сотрудника из отдела</h3>
          <button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleRemove} className="space-y-3">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            Отдел: <span className="font-medium">{targetDeptName || "—"}</span>
          </div>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">— Выберите сотрудника —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {fullName(e)}{e.position ? ` · ${e.position}` : ""}
              </option>
            ))}
          </select>
          {employees.length === 0 && (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              В этом отделе нет сотрудников.
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
              {saving ? "Удаление..." : "Удалить из отдела"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({ open, deptName, onClose, onConfirm, error }: {
  open: boolean
  deptName: string
  onClose: () => void
  onConfirm: () => void
  error: string
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Удалить отдел?</h3>
        <p className="mt-2 text-sm text-muted-foreground">Отдел «{deptName}» будет удалён. Это действие нельзя отменить.</p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border px-4 text-sm hover:bg-accent">Отмена</button>
          <button type="button" onClick={onConfirm} className="h-9 rounded-lg bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90">Удалить</button>
        </div>
      </div>
    </div>
  )
}

function InitView({ ready }: { ready: boolean }) {
  const { setCenter, getNodes } = useReactFlow()

  useEffect(() => {
    if (!ready) return

    const timer = setTimeout(() => {
      const root = getNodes().find((n) => n.id === "company-root")
      if (!root) return
      setCenter(root.position.x + ROOT_W / 2, root.position.y + ROOT_H + 180, { zoom: 0.8, duration: 460 })
    }, 130)

    return () => clearTimeout(timer)
  }, [ready, setCenter, getNodes])

  return null
}

function FocusNode({ nodeId }: { nodeId: string | null }) {
  const { setCenter, getNodes } = useReactFlow()

  useEffect(() => {
    if (!nodeId) return

    const timer = setTimeout(() => {
      const node = getNodes().find((n) => n.id === `dept-${nodeId}`)
      if (!node) return
      setCenter(node.position.x + DEPT_W / 2, node.position.y + DEPT_H / 2, { zoom: 0.96, duration: 280 })
    }, 50)

    return () => clearTimeout(timer)
  }, [nodeId, setCenter, getNodes])

  return null
}

function SearchFocus({ search, firstDeptId }: { search: string; firstDeptId: string | null }) {
  const { setCenter, getNodes } = useReactFlow()

  useEffect(() => {
    if (!search.trim() || !firstDeptId) return

    const timer = setTimeout(() => {
      const node = getNodes().find((n) => n.id === `dept-${firstDeptId}`)
      if (!node) return
      setCenter(node.position.x + DEPT_W / 2, node.position.y + DEPT_H / 2, { zoom: 0.92, duration: 320 })
    }, 120)

    return () => clearTimeout(timer)
  }, [search, firstDeptId, setCenter, getNodes])

  return null
}

type SidebarActionItem = { key: string; title: string; desc: string; icon: ReactNode; danger?: boolean; onClick: () => void }

function OrgTreeInner() {
  const { hasRole } = useAuthStore()
  const isAdmin = hasRole("admin")

  const [rawDepts, setRawDepts] = useState<DepartmentDto[]>([])
  const [rawEmps, setRawEmps] = useState<EmployeeDto[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editDept, setEditDept] = useState<DeptView | null>(null)
  const [addParentId, setAddParentId] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteDept, setDeleteDept] = useState<DeptView | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [removeEmployeeModalOpen, setRemoveEmployeeModalOpen] = useState(false)
  const [employeeModalDept, setEmployeeModalDept] = useState<string | null>(null)

  const [sideMenuOpen, setSideMenuOpen] = useState(false)
  const sideMenuRef = useRef<HTMLDivElement | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [deptsRes, employees] = await Promise.all([
        client.get<DepartmentDto[]>("/departments/"),
        fetchAllEmployees(),
      ])

      const localMeta = loadDeptMeta()
      const normalized = (Array.isArray(deptsRes.data) ? deptsRes.data : []).map((d) => ({
        ...d,
        description: d.description ?? localMeta[d.id]?.description ?? null,
        head_id: d.head_id ?? localMeta[d.id]?.head_id ?? null,
        parent_id: normalizeParentId(d.parent_id),
      }))
      setRawDepts(normalized)
      setRawEmps(employees)
      setReady(true)
    } catch (error) {
      console.error("ORG TREE LOAD ERROR", error)
      setRawDepts([])
      setRawEmps([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const views = useMemo(() => buildViews(rawDepts, rawEmps, search), [rawDepts, rawEmps, search])
  const selectedDept = useMemo(() => (selectedId ? views.find((d) => d.id === selectedId) ?? null : null), [selectedId, views])
  const selectedDeptParent = useMemo(
    () => (selectedDept?.parentId ? rawDepts.find((d) => d.id === selectedDept.parentId) ?? null : null),
    [rawDepts, selectedDept]
  )
  const selectedDeptChildren = useMemo(
    () => (selectedDept ? rawDepts.filter((d) => normalizeParentId(d.parent_id) === selectedDept.id).sort((a, b) => a.name.localeCompare(b.name, "ru")) : []),
    [rawDepts, selectedDept]
  )
  const employeeModalTargetDept = useMemo(
    () => (employeeModalDept ? rawDepts.find((d) => d.id === employeeModalDept) ?? null : null),
    [employeeModalDept, rawDepts]
  )
  const employeesWithoutDept = useMemo(
    () => rawEmps.filter((e) => !e.department_id),
    [rawEmps]
  )

  const firstMatchDeptId = useMemo(() => {
    if (!search.trim() || views.length === 0) return views[0]?.id ?? null
    const best = [...views].sort((a, b) => deptSearchScore(b, search) - deptSearchScore(a, search))[0]
    return best?.id ?? views[0]?.id ?? null
  }, [search, views])

  const openCreate = useCallback((parentId: string | null) => {
    if (!isAdmin) return
    setEditDept(null)
    setAddParentId(parentId)
    setModalOpen(true)
  }, [isAdmin])

  const openEdit = useCallback((dept: DeptView) => {
    if (!isAdmin) return
    setEditDept(dept)
    setAddParentId(null)
    setModalOpen(true)
  }, [isAdmin])

  const openDelete = useCallback((dept: DeptView) => {
    if (!isAdmin) return
    setDeleteDept(dept)
    setDeleteError("")
    setDeleteOpen(true)
  }, [isAdmin])

  const openEmployeeCreate = useCallback((deptId: string | null) => {
    if (!isAdmin) return
    setEmployeeModalDept(deptId)
    setEmployeeModalOpen(true)
  }, [isAdmin])

  const openTransfer = useCallback((deptId: string | null) => {
    if (!isAdmin) return
    setEmployeeModalDept(deptId)
    setTransferModalOpen(true)
  }, [isAdmin])

  const openRemoveEmployee = useCallback((deptId: string | null) => {
    if (!isAdmin) return
    setEmployeeModalDept(deptId)
    setRemoveEmployeeModalOpen(true)
  }, [isAdmin])

  const confirmDelete = useCallback(async () => {
    if (!isAdmin || !deleteDept) return

    try {
      await client.delete(`/departments/${deleteDept.id}`)
      setDeleteOpen(false)
      setDeleteDept(null)
      if (selectedId === deleteDept.id) setSelectedId(null)
      await loadData()
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setDeleteError(message || "Ошибка удаления")
    }
  }, [deleteDept, isAdmin, loadData, selectedId])

  useEffect(() => {
    if (!sideMenuOpen) return

    function handleOutside(e: MouseEvent) {
      const t = e.target
      if (t instanceof HTMLElement && sideMenuRef.current && !sideMenuRef.current.contains(t)) {
        setSideMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [sideMenuOpen])

  const graph = useMemo(() => {
    const { nodes, edges } = layoutTree(views, isAdmin, setSelectedId, openCreate)

    console.log(
      "GRAPH nodes raw",
      nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.type === "deptNode" ? (n.data as DeptNodeData).dept.name : "root",
      }))
    )

    console.log("GRAPH edges raw", edges)

    return {
      nodes: nodes.map((n) => {
        if (n.type !== "deptNode") return n
        const dn = n as FlowNode<DeptNodeData>
        return { ...dn, data: { ...dn.data, selected: dn.data.dept.id === selectedDept?.id } }
      }),
      edges,
    }
  }, [views, isAdmin, openCreate, selectedDept])

  const sidebarActions: SidebarActionItem[] = selectedDept
    ? [
      { key: "edit", title: "Редактировать отдел", desc: "Изменить название и структуру.", icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(selectedDept) },
      { key: "add-child", title: "Добавить в подчинение", desc: "Создать дочерний отдел.", icon: <Plus className="h-4 w-4" />, onClick: () => openCreate(selectedDept.id) },
      { key: "invite", title: "Добавить сотрудника", desc: "Оформить сотрудника в отдел.", icon: <UserPlus className="h-4 w-4" />, onClick: () => openEmployeeCreate(selectedDept.id) },
      { key: "transfer", title: "Перевести сотрудника", desc: "Переместить сотрудника в отдел.", icon: <Users className="h-4 w-4" />, onClick: () => openTransfer(selectedDept.id) },
      { key: "remove-employee", title: "Удалить из отдела", desc: "Убрать сотрудника из отдела.", icon: <UserIcon className="h-4 w-4" />, danger: true, onClick: () => openRemoveEmployee(selectedDept.id) },
      { key: "delete", title: "Удалить отдел", desc: "Удалить отдел без восстановления.", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => openDelete(selectedDept) },
    ]
    : []

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const totalEmp = views.reduce((sum, v) => sum + v.empCount, 0)

  return (
    <div className="space-y-4">
      <style>{CSS}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Оргструктура</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Иерархия отделов и распределение сотрудников</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => openCreate(null)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Добавить отдел
            </button>
          )}
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Поиск отдела или сотрудника…" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1"><Building2 className="h-3.5 w-3.5 text-primary/70" /> Отделов: {views.length}</span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1"><Users className="h-3.5 w-3.5 text-primary/70" /> Сотрудников: {totalEmp}</span>
      </div>

      {views.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">По запросу ничего не найдено</p>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="org-tree h-[calc(100vh-13rem)] min-h-[560px] flex-1 rounded-2xl border border-border/50 bg-gradient-to-b from-sky-50/50 to-background dark:from-sky-950/10">
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              minZoom={0.2}
              maxZoom={1.7}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnDrag
              fitView={false}
              defaultEdgeOptions={{ type: "step", animated: false }}
              onError={(code, message) => {
                console.error("REACTFLOW ERROR", code, message)
              }}
            >
              <Background gap={26} size={1} color="hsl(var(--border) / 0.30)" />
              <Controls showInteractive={false} position="bottom-left" />
              <InitView ready={ready} />
              <FocusNode nodeId={selectedId} />
              <SearchFocus search={search} firstDeptId={firstMatchDeptId} />
            </ReactFlow>
          </div>

          {selectedDept && (
            <aside className="flex h-[calc(100vh-13rem)] min-h-[560px] w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-muted/10 shadow-sm">
              <div className="border-b bg-card/70 px-4 py-3.5 backdrop-blur">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold leading-snug">{selectedDept.name}</h2>
                    <div className="mt-1.5 flex gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"><Users className="h-3 w-3" /> {selectedDept.empCount}</span>
                      {selectedDept.childCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"><Building2 className="h-3 w-3" /> {selectedDept.childCount} отд.</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <div ref={sideMenuRef} className="relative">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:bg-accent hover:text-foreground"
                          onClick={() => setSideMenuOpen((p) => !p)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {sideMenuOpen && (
                          <div className="absolute right-0 top-9 z-30 w-72 rounded-xl border bg-popover p-1.5 shadow-xl">
                            {sidebarActions.map((action) => (
                              <button
                                key={action.key}
                                type="button"
                                className={[
                                  "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition",
                                  action.danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-accent",
                                ].join(" ")}
                                onClick={() => {
                                  action.onClick()
                                  setSideMenuOpen(false)
                                }}
                              >
                                <span className="mt-0.5 shrink-0 text-muted-foreground">{action.icon}</span>
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-medium leading-tight">{action.title}</span>
                                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{action.desc}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg border p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5">
                <section>
                  <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Building2 className="h-3.5 w-3.5 text-sky-500" /> Положение в структуре</div>
                  <div className="space-y-2 rounded-xl border bg-card/75 p-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Родительский отдел</div>
                      <div className="mt-1 text-sm font-medium">{selectedDeptParent?.name || "Корневой отдел"}</div>
                    </div>
                    <div className="border-t pt-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Дочерние отделы · {selectedDeptChildren.length}</div>
                      {selectedDeptChildren.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedDeptChildren.slice(0, 6).map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => setSelectedId(child.id)}
                              className="max-w-[100%] truncate rounded-md border bg-background px-2 py-0.5 text-xs hover:bg-accent"
                              title={child.name}
                            >
                              {child.name}
                            </button>
                          ))}
                          {selectedDeptChildren.length > 6 && (
                            <span className="rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                              +{selectedDeptChildren.length - 6}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-muted-foreground">Нет дочерних отделов</div>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Crown className="h-3.5 w-3.5 text-amber-500" /> Руководитель</div>
                  {selectedDept.head ? (
                    <div className="rounded-xl border bg-card/80 p-3 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        {selectedDept.head.photo_url ? (
                          <img src={selectedDept.head.photo_url} alt={fullName(selectedDept.head)} className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><UserIcon className="h-4 w-4 text-muted-foreground" /></div>
                        )}
                        <div>
                          <div className="text-sm font-medium">{fullName(selectedDept.head)}</div>
                          <div className="text-xs text-muted-foreground">{selectedDept.head.position || "Должность не указана"}</div>
                        </div>
                      </div>
                      {selectedDept.head.email && <div className="mt-2 text-xs text-muted-foreground">{selectedDept.head.email}</div>}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Руководитель не назначен</div>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><UserCircle2 className="h-3.5 w-3.5 text-primary" /> Состав отдела</div>
                  {selectedDept.tree.length > 0 ? (
                    <div className="space-y-1 rounded-xl border bg-card/70 p-2">{selectedDept.tree.map((e) => <EmpItem key={e.id} node={e} search={search} />)}</div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">В этом отделе пока нет сотрудников</div>
                  )}
                </section>

                <section>
                  <div className="mb-2 text-[13px] font-semibold">Описание отдела</div>
                  <div className="rounded-xl border bg-card/80 p-3 text-sm text-muted-foreground">
                    {selectedDept.description?.trim() || "Описание не заполнено"}
                  </div>
                </section>
              </div>
            </aside>
          )}
        </div>
      )}

      {isAdmin && (
        <>
          <DeptModal open={modalOpen} onClose={() => setModalOpen(false)} deptToEdit={editDept} parentId={addParentId} allDepts={rawDepts} allEmps={rawEmps} onSaved={loadData} />
          <DeleteModal open={deleteOpen} deptName={deleteDept?.name ?? ""} onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} error={deleteError} />
          <EmployeeModal
            open={employeeModalOpen}
            onClose={() => setEmployeeModalOpen(false)}
            employeesWithoutDept={employeesWithoutDept}
            targetDept={employeeModalTargetDept}
            onSaved={loadData}
          />
          <TransferModal open={transferModalOpen} onClose={() => setTransferModalOpen(false)} employees={rawEmps} allDepts={rawDepts} defaultDeptId={employeeModalDept} onSaved={loadData} />
          <RemoveEmployeeModal
            open={removeEmployeeModalOpen}
            onClose={() => setRemoveEmployeeModalOpen(false)}
            employees={rawEmps.filter((e) => e.department_id === employeeModalDept)}
            targetDeptName={employeeModalTargetDept?.name ?? ""}
            onSaved={loadData}
          />
        </>
      )}
    </div>
  )
}

export default function OrgTreePage() {
  return (
    <ReactFlowProvider>
      <OrgTreeInner />
    </ReactFlowProvider>
  )
}
