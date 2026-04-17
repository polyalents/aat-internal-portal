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

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

const DEPT_META_STORAGE_KEY = "org_tree_dept_meta"

const BRANCH_COLORS = [
  "#38bdf8", "#a78bfa", "#34d399", "#fb923c",
  "#f472b6", "#facc15", "#60a5fa", "#c084fc",
]
const DIMMED_COLOR = "#64748b40"

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
  const matched = iq(fullName(node), q) || iq(node.position, q) || iq(node.email, q) || iq(node.internal_phone, q)
  const children = node.children.map((c) => filterEmpTree(c, q)).filter(Boolean) as TreeEmployee[]
  if (!matched && children.length === 0) return null
  return { ...node, children }
}

function countTree(nodes: TreeEmployee[]): number {
  return nodes.reduce((t, n) => t + 1 + countTree(n.children), 0)
}

function buildViews(depts: DepartmentDto[], emps: EmployeeDto[], query: string): DeptView[] {
  const q = query.trim().toLowerCase()
  const childCountMap = new Map<string, number>()
  const parentMap = new Map<string, string | null>()

  for (const d of depts) {
    const pid = normalizeParentId(d.parent_id)
    parentMap.set(d.id, pid)
    if (pid) childCountMap.set(pid, (childCountMap.get(pid) ?? 0) + 1)
  }

  type Internal = DeptView & { matched: boolean }

  const prepared = depts.map((dept): Internal => {
    const de = emps.filter((e) => e.department_id === dept.id)
    const head = dept.head_id ? de.find((e) => e.id === dept.head_id) ?? null : null
    const tree = buildEmpTree(de)
    const ft = q ? (tree.map((n) => filterEmpTree(n, q)).filter(Boolean) as TreeEmployee[]) : tree
    const dm = iq(dept.name, q) || iq(fullName(head), q)
    const hm = ft.length > 0
    const matched = q ? dm || hm : true

    return {
      id: dept.id, name: dept.name, description: dept.description ?? null,
      head, headId: dept.head_id, parentId: normalizeParentId(dept.parent_id),
      employees: de,
      tree: q ? (dm && ft.length === 0 ? tree : ft) : tree,
      empCount: q ? (dm && ft.length === 0 ? de.length : countTree(ft)) : de.length,
      childCount: childCountMap.get(dept.id) ?? 0,
      matched,
    }
  })

  if (!q) return prepared.map(({ matched: _, ...d }) => d)

  const visibleIds = new Set<string>()
  for (const dept of prepared) {
    if (!dept.matched) continue
    let cur: string | null = dept.id
    while (cur) { if (visibleIds.has(cur)) break; visibleIds.add(cur); cur = parentMap.get(cur) ?? null }
  }

  return prepared.filter((d) => visibleIds.has(d.id)).map(({ matched: _, ...d }) => d)
}

function collectDescendantIds(depts: DepartmentDto[], rootId: string): Set<string> {
  const childMap = new Map<string, string[]>()
  for (const d of depts) {
    const pid = normalizeParentId(d.parent_id)
    if (!pid) continue
    const list = childMap.get(pid) ?? []
    list.push(d.id)
    childMap.set(pid, list)
  }
  const result = new Set<string>()
  const stack = [rootId]
  while (stack.length > 0) {
    const cur = stack.pop()!
    for (const cid of (childMap.get(cur) ?? [])) { if (!result.has(cid)) { result.add(cid); stack.push(cid) } }
  }
  return result
}

function collectAncestorIds(views: DeptView[], deptId: string): Set<string> {
  const parentMap = new Map(views.map((d) => [d.id, d.parentId]))
  const result = new Set<string>()
  let cur: string | null = deptId
  while (cur) { result.add(cur); cur = parentMap.get(cur) ?? null }
  return result
}

function collectSubtreeIds(views: DeptView[], deptId: string): Set<string> {
  const childMap = new Map<string, string[]>()
  for (const d of views) { if (d.parentId) { const l = childMap.get(d.parentId) ?? []; l.push(d.id); childMap.set(d.parentId, l) } }
  const result = new Set<string>()
  const stack = [deptId]
  while (stack.length > 0) { const c = stack.pop()!; result.add(c); for (const ch of (childMap.get(c) ?? [])) stack.push(ch) }
  return result
}

type StoredDeptMeta = { description?: string | null; head_id?: string | null }

function loadDeptMeta(): Record<string, StoredDeptMeta> {
  try { const raw = localStorage.getItem(DEPT_META_STORAGE_KEY); if (!raw) return {}; const p = JSON.parse(raw); return p && typeof p === "object" ? p : {} } catch { return {} }
}

function saveDeptMeta(deptId: string, meta: { description?: string | null; head_id?: string | null }): void {
  const cur = loadDeptMeta(); cur[deptId] = { description: meta.description ?? null, head_id: meta.head_id ?? null }
  localStorage.setItem(DEPT_META_STORAGE_KEY, JSON.stringify(cur))
}

async function fetchAllEmployees(): Promise<EmployeeDto[]> {
  const ps = 100
  try {
    const first = await client.get<EmployeesResponse | EmployeeDto[]>("/employees/", { params: { page: 1, size: ps } })
    if (Array.isArray(first.data)) return first.data
    const items = first.data?.items ?? []; const total = first.data?.total ?? items.length
    if (items.length >= total) return items
    const pages = Math.ceil(total / ps); if (pages <= 1) return items
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => client.get<EmployeesResponse>("/employees/", { params: { page: i + 2, size: ps } })))
    return items.concat(...rest.map((r) => r.data?.items ?? []))
  } catch (err: unknown) {
    if ((err as { response?: { status?: number } })?.response?.status !== 422) throw err
    const fb = await client.get<EmployeesResponse | EmployeeDto[]>("/employees/")
    return Array.isArray(fb.data) ? fb.data : fb.data?.items ?? []
  }
}

function deptSearchScore(dept: DeptView, query: string): number {
  const q = query.trim().toLowerCase(); if (!q) return 0
  let s = 0; if (dept.name.toLowerCase().includes(q)) s += 5; if (fullName(dept.head).toLowerCase().includes(q)) s += 4
  for (const emp of dept.employees) { if (fullName(emp).toLowerCase().includes(q)) s += 2; if ((emp.position ?? "").toLowerCase().includes(q)) s += 1 }
  return s
}

/* ═══════════════════════════════════════════
   Layout engine
   ═══════════════════════════════════════════ */

const DEPT_W = 340
const DEPT_H = 170
const ROOT_W = 340
const ROOT_H = 92
const GAP_X = 34
const GAP_Y = 86

type LayoutNode = { id: string; children: LayoutNode[]; width: number; x: number; y: number }

function buildLayoutBranch(childrenByParent: Map<string | null, DeptView[]>, parentId: string | null): LayoutNode[] {
  return [...(childrenByParent.get(parentId) ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((d) => ({ id: d.id, children: buildLayoutBranch(childrenByParent, d.id), width: 0, x: 0, y: 0 }))
}

function measureSubtree(node: LayoutNode): number {
  if (!node.children.length) { node.width = DEPT_W; return DEPT_W }
  const cw = node.children.reduce((s, c, i) => s + measureSubtree(c) + (i > 0 ? GAP_X : 0), 0)
  node.width = Math.max(DEPT_W, cw); return node.width
}

function placeSubtree(node: LayoutNode, left: number, top: number): void {
  node.x = left + node.width / 2 - DEPT_W / 2; node.y = top
  let cx = left
  for (const c of node.children) { placeSubtree(c, cx, top + DEPT_H + GAP_Y); cx += c.width + GAP_X }
}

function flattenSubtree(node: LayoutNode, out: Array<{ id: string; x: number; y: number }>): void {
  out.push({ id: node.id, x: node.x, y: node.y }); node.children.forEach((c) => flattenSubtree(c, out))
}

function collectBranchIds(node: LayoutNode, out: Set<string>): void {
  out.add(node.id); node.children.forEach((c) => collectBranchIds(c, out))
}

function layoutTree(
  views: DeptView[],
  isAdmin: boolean,
  onSelect: (id: string) => void,
  onAddChild: (pid: string) => void,
  selectedId: string | null
): { nodes: FlowNode[]; edges: Edge[] } {
  const viewMap = new Map(views.map((v) => [v.id, v]))
  const visibleIds = new Set(views.map((d) => d.id))
  const childrenByParent = new Map<string | null, DeptView[]>()

  for (const dept of views) {
    const rawPid = normalizeParentId(dept.parentId)
    const effectivePid = rawPid && visibleIds.has(rawPid) ? rawPid : null
    const list = childrenByParent.get(effectivePid) ?? []
    list.push(dept)
    childrenByParent.set(effectivePid, list)
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
  soloRoots.forEach((node, i) => {
    node.width = DEPT_W; node.x = soloStartX + (i % soloCols) * (DEPT_W + GAP_X)
    node.y = Math.floor(i / soloCols) * (DEPT_H + GAP_Y)
  })

  // Assign branch colors: each top-level root gets a color
  const branchColorMap = new Map<string, string>()
  roots.forEach((root, i) => {
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length]
    const ids = new Set<string>()
    collectBranchIds(root, ids)
    ids.forEach((id) => branchColorMap.set(id, color))
  })

  // If a dept is selected, find its full lineage
  const highlightIds = selectedId ? new Set([
    ...collectAncestorIds(views, selectedId),
    ...collectSubtreeIds(views, selectedId),
  ]) : null

  const positions: Array<{ id: string; x: number; y: number }> = []
  roots.forEach((r) => flattenSubtree(r, positions))
  const graphWidth = Math.max(ROOT_W, ...positions.map((p) => p.x + DEPT_W))

  const rootId = "company-root"
  const totalEmp = views.reduce((s, d) => s + d.empCount, 0)

  const nodes: FlowNode[] = [{
    id: rootId, type: "rootNode",
    position: { x: graphWidth / 2 - ROOT_W / 2, y: -ROOT_H - 34 },
    data: { name: "Структура компании", deptCount: views.length, empCount: totalEmp } satisfies RootNodeData,
    draggable: false, selectable: false,
  }]

  const edges: Edge[] = []

  for (const p of positions) {
    const dept = viewMap.get(p.id)
    if (!dept) continue
    const nid = `dept-${dept.id}`
    nodes.push({
      id: nid, type: "deptNode", position: { x: p.x, y: p.y },
      data: { dept, selected: dept.id === selectedId, isAdmin, onSelect, onAddChild } satisfies DeptNodeData, draggable: false
    })

    const pid = normalizeParentId(dept.parentId)
    const hasVisibleParent = pid && visibleIds.has(pid)
    const sourceId = hasVisibleParent ? `dept-${pid}` : rootId

    // Color logic: if something selected, highlight lineage, dim rest
    const branchColor = branchColorMap.get(dept.id) ?? BRANCH_COLORS[0]
    let edgeColor: string
    let edgeWidth: number
    if (highlightIds) {
      if (highlightIds.has(dept.id)) {
        edgeColor = branchColor
        edgeWidth = 3
      } else {
        edgeColor = DIMMED_COLOR
        edgeWidth = 1.5
      }
    } else {
      edgeColor = branchColor
      edgeWidth = 2
    }

    edges.push({
      id: `e-${dept.id}`, source: sourceId, target: nid,
      type: "step", sourceHandle: "out", targetHandle: "in",
      style: { stroke: edgeColor, strokeWidth: edgeWidth },
    })
  }

  return { nodes, edges }
}

/* ═══════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════ */

const CSS = `
.org-tree .react-flow__edge-path { }
.org-tree .react-flow__edge-interaction { stroke-width: 22px !important; }
.org-tree .react-flow__renderer { background: transparent !important; }
.org-tree .react-flow__node { cursor: default !important; }
.org-tree .react-flow__attribution { display: none !important; }
.org-tree .react-flow__controls {
  background: rgba(255,255,255,.88) !important;
  border: 1px solid rgba(148,163,184,.45) !important;
  border-radius: 14px !important; overflow: hidden !important;
  box-shadow: 0 6px 20px rgba(0,0,0,.12) !important;
}
.dark .org-tree .react-flow__controls {
  background: rgba(30,41,59,.85) !important;
  border: 1px solid rgba(148,163,184,.42) !important;
}
.org-tree .react-flow__controls-button {
  width: 38px !important; height: 38px !important;
  background: transparent !important; border: none !important;
  border-bottom: 1px solid rgba(148,163,184,.45) !important;
}
.org-tree .react-flow__controls-button:last-child { border-bottom: none !important; }
.org-tree .react-flow__controls-button:hover { background: rgba(148,163,184,.16) !important; }
.org-tree .react-flow__controls-button svg { fill: #0f172a !important; }
.dark .org-tree .react-flow__controls-button svg { fill: #e2e8f0 !important; }

/* Mobile sidebar overlay */
@media (max-width: 1023px) {
  .org-sidebar-overlay { position: fixed; inset: 0; z-index: 40; background: rgba(0,0,0,0.5); }
  .org-sidebar-sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
    max-height: 75vh; border-radius: 1rem 1rem 0 0;
    overflow-y: auto; animation: slideUp 0.25s ease;
  }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
}
`

/* ═══════════════════════════════════════════
   Nodes
   ═══════════════════════════════════════════ */

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
  const { dept, selected, isAdmin, onSelect, onAddChild } = data
  const headLabel = shortName(dept.head)

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onSelect(dept.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(dept.id) } }}
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
        <button type="button" onClick={(e) => { e.stopPropagation(); onAddChild(dept.id) }}
          className="absolute -bottom-4 left-1/2 z-20 hidden h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-sky-400 bg-sky-500 text-white shadow-lg transition hover:bg-sky-600 group-hover:flex"
          title="Добавить отдел в подчинение">
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
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" /></div>
          )}
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">{headLabel || "Руководитель не назначен"}</div>
            <div className="truncate text-[11px] text-muted-foreground">{dept.head?.position || "Укажите руководителя"}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{dept.empCount} сотрудников</span>
      </div>
    </div>
  )
}

const nodeTypes = { rootNode: RootNode, deptNode: DeptNode }

/* ═══════════════════════════════════════════
   Employee tree (sidebar)
   ═══════════════════════════════════════════ */

function EmpItem({ node, level = 0, search }: { node: TreeEmployee; level?: number; search: string }) {
  const [open, setOpen] = useState(level < 1 || !!search.trim())
  const hasChildren = node.children.length > 0
  const forcedOpen = Boolean(search.trim())

  return (
    <div>
      <div className="rounded-xl border border-border/60 bg-background/70 p-2.5" style={{ marginLeft: level * 14 }}>
        <div className="flex items-start gap-2">
          <button type="button" disabled={!hasChildren} className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30" onClick={() => setOpen((p) => !p)}>
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
        <div className="mt-1 space-y-1">{node.children.map((c) => <EmpItem key={c.id} node={c} level={level + 1} search={search} />)}</div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   Modals
   ═══════════════════════════════════════════ */

function DeptModal({ open, onClose, deptToEdit, parentId, allDepts, allEmps, onSaved }: {
  open: boolean; onClose: () => void; deptToEdit: DeptView | null; parentId: string | null
  allDepts: DepartmentDto[]; allEmps: EmployeeDto[]; onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(""); const [headId, setHeadId] = useState("")
  const [selParent, setSelParent] = useState(""); const [desc, setDesc] = useState("")
  const [saving, setSaving] = useState(false); const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    if (deptToEdit) { setName(deptToEdit.name); setHeadId(deptToEdit.headId ?? ""); setSelParent(deptToEdit.parentId ?? ""); setDesc(deptToEdit.description ?? "") }
    else { setName(""); setHeadId(""); setSelParent(parentId ?? ""); setDesc("") }
    setError("")
  }, [open, deptToEdit, parentId])

  const forbidden = useMemo(() => deptToEdit ? collectDescendantIds(allDepts, deptToEdit.id) : new Set<string>(), [allDepts, deptToEdit])

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!name.trim()) { setError("Введите название отдела"); return }
    setSaving(true); setError("")
    try {
      const body = { name: name.trim(), description: desc.trim() || null, head_id: headId || null, parent_id: selParent || null }
      if (deptToEdit) { await client.patch(`/departments/${deptToEdit.id}`, body); saveDeptMeta(deptToEdit.id, { description: desc, head_id: headId || null }) }
      else { const r = await client.post<DepartmentDto>("/departments/", body); if (r.data?.id) saveDeptMeta(r.data.id, { description: desc, head_id: headId || null }) }
      await onSaved(); onClose()
    } catch (err: unknown) { setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка сохранения") }
    finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div><h3 className="text-lg font-semibold">{deptToEdit ? "Редактирование отдела" : "Создание отдела"}</h3><p className="mt-1 text-sm text-muted-foreground">Заполните данные отдела</p></div>
          <button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div><label className="mb-1 block text-sm font-medium">Название</label><Input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Название отдела" autoFocus /></div>
          <div><label className="mb-1 block text-sm font-medium">Руководитель</label>
            <select value={headId} onChange={(e) => setHeadId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Не назначен —</option>{allEmps.map((emp) => <option key={emp.id} value={emp.id}>{fullName(emp)} {emp.position ? `(${emp.position})` : ""}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-medium">Родительский отдел</label>
            <select value={selParent} onChange={(e) => setSelParent(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Корневой уровень —</option>{allDepts.filter((d) => d.id !== deptToEdit?.id && !forbidden.has(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-medium">Описание</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Короткое описание отдела" /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "Сохранение..." : deptToEdit ? "Сохранить" : "Создать"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmployeeModal({ open, onClose, employeesWithoutDept, targetDept, onSaved }: {
  open: boolean; onClose: () => void; employeesWithoutDept: EmployeeDto[]; targetDept: DepartmentDto | null; onSaved: () => Promise<void>
}) {
  const [empId, setEmpId] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  useEffect(() => { if (open) { setEmpId(""); setError("") } }, [open, targetDept])
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!targetDept || !empId) { setError("Выберите сотрудника"); return }
    setSaving(true); setError("")
    try { await client.patch(`/employees/${empId}`, { department_id: targetDept.id }); await onSaved(); onClose() }
    catch (err: unknown) { setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка") }
    finally { setSaving(false) }
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Добавить сотрудника</h3><button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">Отдел: <span className="font-medium">{targetDept?.name || "—"}</span></div>
          <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Выберите —</option>{employeesWithoutDept.map((e) => <option key={e.id} value={e.id}>{fullName(e)}{e.position ? ` · ${e.position}` : ""}</option>)}</select>
          {employeesWithoutDept.length === 0 && <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Нет сотрудников без отдела</div>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button><button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "..." : "Добавить"}</button></div>
        </form>
      </div>
    </div>
  )
}

function TransferModal({ open, onClose, employees, allDepts, defaultDeptId, onSaved }: {
  open: boolean; onClose: () => void; employees: EmployeeDto[]; allDepts: DepartmentDto[]; defaultDeptId: string | null; onSaved: () => Promise<void>
}) {
  const [empId, setEmpId] = useState(""); const [toDept, setToDept] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  useEffect(() => { if (open) { setEmpId(""); setToDept(defaultDeptId ?? ""); setError("") } }, [open, defaultDeptId])
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!empId || !toDept) { setError("Выберите сотрудника и отдел"); return }
    setSaving(true); setError("")
    try { await client.patch(`/employees/${empId}`, { department_id: toDept }); await onSaved(); onClose() }
    catch (err: unknown) { setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка") }
    finally { setSaving(false) }
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Перевести сотрудника</h3><button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Сотрудник —</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select>
          <select value={toDept} onChange={(e) => setToDept(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Целевой отдел —</option>{allDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button><button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "..." : "Перевести"}</button></div>
        </form>
      </div>
    </div>
  )
}

function RemoveEmployeeModal({ open, onClose, employees, targetDeptName, onSaved }: {
  open: boolean; onClose: () => void; employees: EmployeeDto[]; targetDeptName: string; onSaved: () => Promise<void>
}) {
  const [empId, setEmpId] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  useEffect(() => { if (open) { setEmpId(""); setError("") } }, [open, targetDeptName])
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!empId) { setError("Выберите сотрудника"); return }
    setSaving(true); setError("")
    try { await client.patch(`/employees/${empId}`, { department_id: null }); await onSaved(); onClose() }
    catch (err: unknown) { setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка") }
    finally { setSaving(false) }
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Удалить из отдела</h3><button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">Отдел: <span className="font-medium">{targetDeptName}</span></div>
          <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Сотрудник —</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select>
          {employees.length === 0 && <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Нет сотрудников</div>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button><button type="submit" disabled={saving} className="h-9 rounded-lg bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">{saving ? "..." : "Удалить"}</button></div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({ open, deptName, onClose, onConfirm, error }: { open: boolean; deptName: string; onClose: () => void; onConfirm: () => void; error: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Удалить отдел?</h3>
        <p className="mt-2 text-sm text-muted-foreground">«{deptName}» будет удалён.</p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border px-4 text-sm hover:bg-accent">Отмена</button>
          <button type="button" onClick={onConfirm} className="h-9 rounded-lg bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90">Удалить</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Viewport helpers
   ═══════════════════════════════════════════ */

function InitView({ ready }: { ready: boolean }) {
  const { setCenter, getNodes } = useReactFlow()
  useEffect(() => { if (!ready) return; const t = setTimeout(() => { const r = getNodes().find((n) => n.id === "company-root"); if (r) setCenter(r.position.x + ROOT_W / 2, r.position.y + ROOT_H + 180, { zoom: 0.8, duration: 460 }) }, 130); return () => clearTimeout(t) }, [ready, setCenter, getNodes])
  return null
}

function FocusNode({ nodeId }: { nodeId: string | null }) {
  const { setCenter, getNodes } = useReactFlow()
  useEffect(() => { if (!nodeId) return; const t = setTimeout(() => { const n = getNodes().find((nd) => nd.id === `dept-${nodeId}`); if (n) setCenter(n.position.x + DEPT_W / 2, n.position.y + DEPT_H / 2, { zoom: 0.96, duration: 280 }) }, 50); return () => clearTimeout(t) }, [nodeId, setCenter, getNodes])
  return null
}

function SearchFocus({ search, firstDeptId }: { search: string; firstDeptId: string | null }) {
  const { setCenter, getNodes } = useReactFlow()
  useEffect(() => { if (!search.trim() || !firstDeptId) return; const t = setTimeout(() => { const n = getNodes().find((nd) => nd.id === `dept-${firstDeptId}`); if (n) setCenter(n.position.x + DEPT_W / 2, n.position.y + DEPT_H / 2, { zoom: 0.92, duration: 320 }) }, 120); return () => clearTimeout(t) }, [search, firstDeptId, setCenter, getNodes])
  return null
}

/* ═══════════════════════════════════════════
   Main
   ═══════════════════════════════════════════ */

type SideAction = { key: string; title: string; desc: string; icon: ReactNode; danger?: boolean; onClick: () => void }

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
  const [empModalOpen, setEmpModalOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [removeEmpOpen, setRemoveEmpOpen] = useState(false)
  const [empModalDept, setEmpModalDept] = useState<string | null>(null)
  const [sideMenu, setSideMenu] = useState(false)
  const sideMenuRef = useRef<HTMLDivElement | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dr, emps] = await Promise.all([client.get<DepartmentDto[]>("/departments/"), fetchAllEmployees()])
      const meta = loadDeptMeta()
      const normalized = (Array.isArray(dr.data) ? dr.data : []).map((d) => ({
        ...d, description: d.description ?? meta[d.id]?.description ?? null,
        head_id: d.head_id ?? meta[d.id]?.head_id ?? null,
        parent_id: normalizeParentId(d.parent_id),
      }))
      setRawDepts(normalized); setRawEmps(emps); setReady(true)
    } catch (err) { console.error("ORG TREE LOAD ERROR", err); setRawDepts([]); setRawEmps([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const views = useMemo(() => buildViews(rawDepts, rawEmps, search), [rawDepts, rawEmps, search])
  const selDept = useMemo(() => (selectedId ? views.find((d) => d.id === selectedId) ?? null : null), [selectedId, views])
  const selParent = useMemo(() => (selDept?.parentId ? rawDepts.find((d) => d.id === selDept.parentId) ?? null : null), [rawDepts, selDept])
  const selChildren = useMemo(() => selDept ? rawDepts.filter((d) => normalizeParentId(d.parent_id) === selDept.id).sort((a, b) => a.name.localeCompare(b.name, "ru")) : [], [rawDepts, selDept])
  const empTarget = useMemo(() => empModalDept ? rawDepts.find((d) => d.id === empModalDept) ?? null : null, [empModalDept, rawDepts])
  const empsNoDept = useMemo(() => rawEmps.filter((e) => !e.department_id), [rawEmps])

  const firstMatch = useMemo(() => {
    if (!search.trim() || !views.length) return views[0]?.id ?? null
    return [...views].sort((a, b) => deptSearchScore(b, search) - deptSearchScore(a, search))[0]?.id ?? null
  }, [search, views])

  const openCreate = useCallback((pid: string | null) => { if (!isAdmin) return; setEditDept(null); setAddParentId(pid); setModalOpen(true) }, [isAdmin])
  const openEdit = useCallback((d: DeptView) => { if (!isAdmin) return; setEditDept(d); setAddParentId(null); setModalOpen(true) }, [isAdmin])
  const openDelete = useCallback((d: DeptView) => { if (!isAdmin) return; setDeleteDept(d); setDeleteError(""); setDeleteOpen(true) }, [isAdmin])
  const confirmDelete = useCallback(async () => {
    if (!isAdmin || !deleteDept) return
    try { await client.delete(`/departments/${deleteDept.id}`); setDeleteOpen(false); setDeleteDept(null); if (selectedId === deleteDept.id) setSelectedId(null); await loadData() }
    catch (err: unknown) { setDeleteError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка") }
  }, [deleteDept, isAdmin, loadData, selectedId])

  useEffect(() => {
    if (!sideMenu) return
    const h = (e: MouseEvent) => { if (sideMenuRef.current && e.target instanceof HTMLElement && !sideMenuRef.current.contains(e.target)) setSideMenu(false) }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [sideMenu])

  const graph = useMemo(() => {
    const { nodes, edges } = layoutTree(views, isAdmin, setSelectedId, openCreate, selectedId)
    return { nodes, edges }
  }, [views, isAdmin, openCreate, selectedId])

  const actions: SideAction[] = selDept ? [
    { key: "edit", title: "Редактировать отдел", desc: "Изменить название и структуру.", icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(selDept) },
    { key: "add", title: "Добавить в подчинение", desc: "Создать дочерний отдел.", icon: <Plus className="h-4 w-4" />, onClick: () => openCreate(selDept.id) },
    { key: "invite", title: "Добавить сотрудника", desc: "Оформить сотрудника в отдел.", icon: <UserPlus className="h-4 w-4" />, onClick: () => { setEmpModalDept(selDept.id); setEmpModalOpen(true) } },
    { key: "transfer", title: "Перевести сотрудника", desc: "Переместить в этот отдел.", icon: <Users className="h-4 w-4" />, onClick: () => { setEmpModalDept(selDept.id); setTransferOpen(true) } },
    { key: "remove", title: "Удалить из отдела", desc: "Убрать сотрудника.", icon: <UserIcon className="h-4 w-4" />, danger: true, onClick: () => { setEmpModalDept(selDept.id); setRemoveEmpOpen(true) } },
    { key: "delete", title: "Удалить отдел", desc: "Без восстановления.", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => openDelete(selDept) },
  ] : []

  if (loading) return <div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  const totalEmp = views.reduce((s, v) => s + v.empCount, 0)

  /* Sidebar content — shared between desktop and mobile */
  const sidebarContent = selDept ? (
    <div className="flex flex-col overflow-hidden">
      <div className="border-b bg-card/70 px-4 py-3.5 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug">{selDept.name}</h2>
            <div className="mt-1.5 flex gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"><Users className="h-3 w-3" /> {selDept.empCount}</span>
              {selDept.childCount > 0 && <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"><Building2 className="h-3 w-3" /> {selDept.childCount} отд.</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <div ref={sideMenuRef} className="relative">
                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setSideMenu((p) => !p)}><MoreHorizontal className="h-4 w-4" /></button>
                {sideMenu && (
                  <div className="absolute right-0 top-9 z-30 w-72 rounded-xl border bg-popover p-1.5 shadow-xl">
                    {actions.map((a) => (
                      <button key={a.key} type="button" className={["flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition", a.danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-accent"].join(" ")} onClick={() => { a.onClick(); setSideMenu(false) }}>
                        <span className="mt-0.5 shrink-0 text-muted-foreground">{a.icon}</span>
                        <span className="min-w-0"><span className="block text-[13px] font-medium leading-tight">{a.title}</span><span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{a.desc}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg border p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5">
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Building2 className="h-3.5 w-3.5 text-sky-500" /> Положение в структуре</div>
          <div className="space-y-2 rounded-xl border bg-card/75 p-3">
            <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Родительский отдел</div><div className="mt-1 text-sm font-medium">{selParent?.name || "Корневой отдел"}</div></div>
            <div className="border-t pt-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Дочерние отделы · {selChildren.length}</div>
              {selChildren.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">{selChildren.slice(0, 6).map((c) => <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className="max-w-full truncate rounded-md border bg-background px-2 py-0.5 text-xs hover:bg-accent" title={c.name}>{c.name}</button>)}{selChildren.length > 6 && <span className="rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">+{selChildren.length - 6}</span>}</div>
              ) : <div className="mt-1 text-xs text-muted-foreground">Нет дочерних отделов</div>}
            </div>
          </div>
        </section>
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Crown className="h-3.5 w-3.5 text-amber-500" /> Руководитель</div>
          {selDept.head ? (
            <div className="rounded-xl border bg-card/80 p-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                {selDept.head.photo_url ? <img src={selDept.head.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><UserIcon className="h-4 w-4 text-muted-foreground" /></div>}
                <div><div className="text-sm font-medium">{fullName(selDept.head)}</div><div className="text-xs text-muted-foreground">{selDept.head.position || "Должность не указана"}</div></div>
              </div>
              {selDept.head.email && <div className="mt-2 text-xs text-muted-foreground">{selDept.head.email}</div>}
            </div>
          ) : <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Руководитель не назначен</div>}
        </section>
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><UserCircle2 className="h-3.5 w-3.5 text-primary" /> Состав отдела</div>
          {selDept.tree.length > 0 ? <div className="space-y-1 rounded-xl border bg-card/70 p-2">{selDept.tree.map((e) => <EmpItem key={e.id} node={e} search={search} />)}</div>
            : <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Нет сотрудников</div>}
        </section>
        <section>
          <div className="mb-2 text-[13px] font-semibold">Описание отдела</div>
          <div className="rounded-xl border bg-card/80 p-3 text-sm text-muted-foreground">{selDept.description?.trim() || "Описание не заполнено"}</div>
        </section>
      </div>
    </div>
  ) : null

  return (
    <div className="space-y-4">
      <style>{CSS}</style>

      {/* Header — responsive */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Оргструктура</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Иерархия отделов и распределение сотрудников</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <button type="button" onClick={() => openCreate(null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Добавить отдел</button>}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Поиск отдела или сотрудника…" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1"><Building2 className="h-3.5 w-3.5 text-primary/70" /> Отделов: {views.length}</span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1"><Users className="h-3.5 w-3.5 text-primary/70" /> Сотрудников: {totalEmp}</span>
      </div>

      {views.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground"><Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" /><p className="text-sm">Ничего не найдено</p></div>
      ) : (
        <div className="flex gap-4">
          {/* Canvas — full width on mobile */}
          <div className="org-tree h-[calc(100vh-13rem)] min-h-[400px] flex-1 rounded-2xl border border-border/50 bg-gradient-to-b from-sky-50/50 to-background dark:from-sky-950/10 lg:min-h-[560px]">
            <ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} minZoom={0.15} maxZoom={1.7} proOptions={{ hideAttribution: true }} nodesDraggable={false} nodesConnectable={false} elementsSelectable panOnDrag fitView={false} defaultEdgeOptions={{ type: "step", animated: false }}>
              <Background gap={26} size={1} color="hsl(var(--border) / 0.30)" />
              <Controls showInteractive={false} position="bottom-left" />
              <InitView ready={ready} />
              <FocusNode nodeId={selectedId} />
              <SearchFocus search={search} firstDeptId={firstMatch} />
            </ReactFlow>
          </div>

          {/* Desktop sidebar */}
          {selDept && (
            <aside className="hidden h-[calc(100vh-13rem)] min-h-[560px] w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-muted/10 shadow-sm lg:flex">
              {sidebarContent}
            </aside>
          )}
        </div>
      )}

      {/* Mobile sidebar — bottom sheet */}
      {selDept && (
        <div className="lg:hidden">
          <div className="org-sidebar-overlay" onClick={() => setSelectedId(null)} />
          <div className="org-sidebar-sheet border-t bg-card shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {isAdmin && (
        <>
          <DeptModal open={modalOpen} onClose={() => setModalOpen(false)} deptToEdit={editDept} parentId={addParentId} allDepts={rawDepts} allEmps={rawEmps} onSaved={loadData} />
          <DeleteModal open={deleteOpen} deptName={deleteDept?.name ?? ""} onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} error={deleteError} />
          <EmployeeModal open={empModalOpen} onClose={() => setEmpModalOpen(false)} employeesWithoutDept={empsNoDept} targetDept={empTarget} onSaved={loadData} />
          <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} employees={rawEmps} allDepts={rawDepts} defaultDeptId={empModalDept} onSaved={loadData} />
          <RemoveEmployeeModal open={removeEmpOpen} onClose={() => setRemoveEmpOpen(false)} employees={rawEmps.filter((e) => e.department_id === empModalDept)} targetDeptName={empTarget?.name ?? ""} onSaved={loadData} />
        </>
      )}
    </div>
  )
}

export default function OrgTreePage() {
  return <ReactFlowProvider><OrgTreeInner /></ReactFlowProvider>
}