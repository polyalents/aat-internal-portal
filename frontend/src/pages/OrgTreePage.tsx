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
  id: string; name: string; description?: string | null
  head_id: string | null; parent_id: string | null; created_at: string
}

type EmployeeDto = {
  id: string; user_id?: string | null; first_name: string; last_name: string
  middle_name?: string | null; position?: string | null; department_id?: string | null
  room_number?: string | null; internal_phone?: string | null; mobile_phone?: string | null
  email?: string | null; birth_date?: string | null; photo_url?: string | null
  manager_id?: string | null; vacation_start?: string | null; vacation_end?: string | null
  is_active?: boolean; created_at?: string; updated_at?: string
}

type EmployeesResponse = { items: EmployeeDto[]; total: number; page: number; size: number }
type TreeEmployee = EmployeeDto & { children: TreeEmployee[] }

type DeptView = {
  id: string; name: string; description?: string | null
  head: EmployeeDto | null; headId: string | null; parentId: string | null
  employees: EmployeeDto[]; tree: TreeEmployee[]; empCount: number; childCount: number
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

const DEPT_META_STORAGE_KEY = "org_tree_dept_meta"

function iq(v: string | null | undefined, q: string): boolean { return v ? v.toLowerCase().includes(q) : false }
function fullName(e: EmployeeDto | null | undefined): string { if (!e) return ""; return [e.last_name, e.first_name, e.middle_name].filter(Boolean).join(" ").trim() }
function shortName(e: EmployeeDto | null | undefined): string { if (!e) return ""; return [e.first_name, e.last_name].filter(Boolean).join(" ").trim() }
function normalizeParentId(pid: string | null | undefined): string | null { const n = pid?.trim(); return n || null }

function isOnVacation(e: EmployeeDto): boolean {
  if (!e.vacation_start || !e.vacation_end) return false
  const now = new Date(); return now >= new Date(e.vacation_start) && now <= new Date(e.vacation_end)
}

function buildEmpTree(emps: EmployeeDto[]): TreeEmployee[] {
  const byId = new Map<string, TreeEmployee>()
  emps.forEach((e) => byId.set(e.id, { ...e, children: [] }))
  const roots: TreeEmployee[] = []
  byId.forEach((e) => { if (e.manager_id && byId.has(e.manager_id)) byId.get(e.manager_id)?.children.push(e); else roots.push(e) })
  return roots
}

function filterEmpTree(node: TreeEmployee, q: string): TreeEmployee | null {
  if (!q) return node
  const matched = iq(fullName(node), q) || iq(node.position, q) || iq(node.email, q) || iq(node.internal_phone, q)
  const children = node.children.map((c) => filterEmpTree(c, q)).filter(Boolean) as TreeEmployee[]
  if (!matched && !children.length) return null
  return { ...node, children }
}

function countTree(nodes: TreeEmployee[]): number { return nodes.reduce((t, n) => t + 1 + countTree(n.children), 0) }

function buildViews(depts: DepartmentDto[], emps: EmployeeDto[], query: string): DeptView[] {
  const q = query.trim().toLowerCase()
  const childCountMap = new Map<string, number>()
  const parentMap = new Map<string, string | null>()
  for (const d of depts) { const pid = normalizeParentId(d.parent_id); parentMap.set(d.id, pid); if (pid) childCountMap.set(pid, (childCountMap.get(pid) ?? 0) + 1) }

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
      employees: de, tree: q ? (dm && !ft.length ? tree : ft) : tree,
      empCount: q ? (dm && !ft.length ? de.length : countTree(ft)) : de.length,
      childCount: childCountMap.get(dept.id) ?? 0, matched,
    }
  })
  if (!q) return prepared.map(({ matched: _, ...d }) => d)
  const visibleIds = new Set<string>()
  for (const dept of prepared) { if (!dept.matched) continue; let cur: string | null = dept.id; while (cur) { if (visibleIds.has(cur)) break; visibleIds.add(cur); cur = parentMap.get(cur) ?? null } }
  return prepared.filter((d) => visibleIds.has(d.id)).map(({ matched: _, ...d }) => d)
}

function collectDescendantIds(depts: DepartmentDto[], rootId: string): Set<string> {
  const childMap = new Map<string, string[]>()
  for (const d of depts) { const pid = normalizeParentId(d.parent_id); if (!pid) continue; const l = childMap.get(pid) ?? []; l.push(d.id); childMap.set(pid, l) }
  const result = new Set<string>(); const stack = [rootId]
  while (stack.length) { const cur = stack.pop()!; for (const cid of (childMap.get(cur) ?? [])) { if (!result.has(cid)) { result.add(cid); stack.push(cid) } } }
  return result
}

type StoredDeptMeta = { description?: string | null; head_id?: string | null }
function loadDeptMeta(): Record<string, StoredDeptMeta> { try { const r = localStorage.getItem(DEPT_META_STORAGE_KEY); if (!r) return {}; const p = JSON.parse(r); return p && typeof p === "object" ? p : {} } catch { return {} } }
function saveDeptMeta(id: string, m: { description?: string | null; head_id?: string | null }) { const c = loadDeptMeta(); c[id] = { description: m.description ?? null, head_id: m.head_id ?? null }; localStorage.setItem(DEPT_META_STORAGE_KEY, JSON.stringify(c)) }

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

/* ═══════════════════════════════════════════
   Tree data structure for rendering
   ═══════════════════════════════════════════ */

type DeptTreeNode = { dept: DeptView; children: DeptTreeNode[] }

function buildDeptTree(views: DeptView[]): DeptTreeNode[] {
  const visibleIds = new Set(views.map((v) => v.id))
  const childrenByParent = new Map<string | null, DeptView[]>()
  for (const dept of views) {
    const pid = normalizeParentId(dept.parentId)
    const effectivePid = pid && visibleIds.has(pid) ? pid : null
    const list = childrenByParent.get(effectivePid) ?? []
    list.push(dept)
    childrenByParent.set(effectivePid, list)
  }
  function build(parentId: string | null): DeptTreeNode[] {
    return [...(childrenByParent.get(parentId) ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((d) => ({ dept: d, children: build(d.id) }))
  }
  return build(null)
}

/* ═══════════════════════════════════════════
   Employee row
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
          {node.photo_url
            ? <img src={node.photo_url} alt={fullName(node)} className="h-8 w-8 rounded-full object-cover" />
            : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" /></div>}
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
   Department tree node (Bitrix-style card)
   ═══════════════════════════════════════════ */

function DeptTreeCard({
  node, level, selectedId, expandedIds, search, isAdmin,
  onSelect, onToggle, onAddChild,
}: {
  node: DeptTreeNode; level: number; selectedId: string | null
  expandedIds: Set<string>; search: string; isAdmin: boolean
  onSelect: (id: string) => void; onToggle: (id: string) => void
  onAddChild: (pid: string) => void
}) {
  const { dept, children } = node
  const isExpanded = expandedIds.has(dept.id)
  const isSelected = selectedId === dept.id
  const hasChildren = children.length > 0
  const headLabel = shortName(dept.head)

  return (
    <div style={{ paddingLeft: level > 0 ? 12 : 0 }}>
      {/* Dept card */}
      <div
        role="button" tabIndex={0}
        onClick={() => onSelect(dept.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(dept.id) } }}
        className={[
          "group relative cursor-pointer rounded-2xl p-3 transition-all sm:p-4 org-card",
          isSelected ? "org-card-selected" : "",
        ].join(" ")}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          {/* Expand/collapse */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(dept.id) }}
            disabled={!hasChildren}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent disabled:opacity-30"
          >
            {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="h-4 w-4" />}
          </button>

          {/* Icon — hidden on small screens */}
          <div className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 sm:flex">
            <Building2 className="h-4 w-4" />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <span className="text-[13px] font-semibold leading-tight sm:text-sm">{dept.name}</span>
              {dept.childCount > 0 && (
                <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">{dept.childCount} отд.</span>
              )}
            </div>

            {/* Head + employees inline */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {dept.head?.photo_url
                  ? <img src={dept.head.photo_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                  : <UserIcon className="h-3.5 w-3.5" />}
                {headLabel || "Нет руководителя"}
              </span>
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{dept.empCount}</span>
            </div>
          </div>

          {/* Admin: add child */}
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAddChild(dept.id) }}
              className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
              title="Добавить подотдел"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="mt-1.5 space-y-1.5 border-l-2 border-border/40 ml-3 pl-1 sm:mt-2 sm:space-y-2 sm:ml-[18px] sm:pl-2">
          {children.map((child) => (
            <DeptTreeCard key={child.dept.id} node={child} level={level + 1} selectedId={selectedId}
              expandedIds={expandedIds} search={search} isAdmin={isAdmin}
              onSelect={onSelect} onToggle={onToggle} onAddChild={onAddChild} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   Modals (identical to previous version)
   ═══════════════════════════════════════════ */

function DeptModal({ open, onClose, deptToEdit, parentId, allDepts, allEmps, onSaved }: {
  open: boolean; onClose: () => void; deptToEdit: DeptView | null; parentId: string | null
  allDepts: DepartmentDto[]; allEmps: EmployeeDto[]; onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(""); const [headId, setHeadId] = useState("")
  const [selParent, setSelParent] = useState(""); const [desc, setDesc] = useState("")
  const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  useEffect(() => { if (!open) return; if (deptToEdit) { setName(deptToEdit.name); setHeadId(deptToEdit.headId ?? ""); setSelParent(deptToEdit.parentId ?? ""); setDesc(deptToEdit.description ?? "") } else { setName(""); setHeadId(""); setSelParent(parentId ?? ""); setDesc("") }; setError("") }, [open, deptToEdit, parentId])
  const forbidden = useMemo(() => deptToEdit ? collectDescendantIds(allDepts, deptToEdit.id) : new Set<string>(), [allDepts, deptToEdit])
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!name.trim()) { setError("Введите название отдела"); return }
    setSaving(true); setError("")
    try { const body = { name: name.trim(), description: desc.trim() || null, head_id: headId || null, parent_id: selParent || null }; if (deptToEdit) { await client.patch(`/departments/${deptToEdit.id}`, body); saveDeptMeta(deptToEdit.id, { description: desc, head_id: headId || null }) } else { const r = await client.post<DepartmentDto>("/departments/", body); if (r.data?.id) saveDeptMeta(r.data.id, { description: desc, head_id: headId || null }) }; await onSaved(); onClose() }
    catch (err: unknown) { setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка сохранения") }
    finally { setSaving(false) }
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b px-6 py-4"><div><h3 className="text-lg font-semibold">{deptToEdit ? "Редактирование отдела" : "Создание отдела"}</h3><p className="mt-1 text-sm text-muted-foreground">Заполните данные</p></div><button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button></div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div><label className="mb-1 block text-sm font-medium">Название</label><Input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Название отдела" autoFocus /></div>
          <div><label className="mb-1 block text-sm font-medium">Руководитель</label><select value={headId} onChange={(e) => setHeadId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Не назначен —</option>{allEmps.map((emp) => <option key={emp.id} value={emp.id}>{fullName(emp)} {emp.position ? `(${emp.position})` : ""}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-medium">Родительский отдел</label><select value={selParent} onChange={(e) => setSelParent(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Корневой —</option>{allDepts.filter((d) => d.id !== deptToEdit?.id && !forbidden.has(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-medium">Описание</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Описание" /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button><button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "..." : deptToEdit ? "Сохранить" : "Создать"}</button></div>
        </form>
      </div>
    </div>
  )
}

function EmployeeModal({ open, onClose, employeesWithoutDept, targetDept, onSaved }: { open: boolean; onClose: () => void; employeesWithoutDept: EmployeeDto[]; targetDept: DepartmentDto | null; onSaved: () => Promise<void> }) {
  const [empId, setEmpId] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  useEffect(() => { if (open) { setEmpId(""); setError("") } }, [open, targetDept])
  async function submit(e: FormEvent) { e.preventDefault(); if (!targetDept || !empId) { setError("Выберите сотрудника"); return }; setSaving(true); setError(""); try { await client.patch(`/employees/${empId}`, { department_id: targetDept.id }); await onSaved(); onClose() } catch (err: unknown) { setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка") } finally { setSaving(false) } }
  if (!open) return null
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}><div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Добавить сотрудника</h3><button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button></div><form onSubmit={submit} className="space-y-3"><div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">Отдел: <span className="font-medium">{targetDept?.name || "—"}</span></div><select value={empId} onChange={(e) => setEmpId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Выберите —</option>{employeesWithoutDept.map((e) => <option key={e.id} value={e.id}>{fullName(e)}{e.position ? ` · ${e.position}` : ""}</option>)}</select>{employeesWithoutDept.length === 0 && <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Нет сотрудников без отдела</div>}{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button><button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "..." : "Добавить"}</button></div></form></div></div>)
}

function TransferModal({ open, onClose, employees, allDepts, defaultDeptId, onSaved }: { open: boolean; onClose: () => void; employees: EmployeeDto[]; allDepts: DepartmentDto[]; defaultDeptId: string | null; onSaved: () => Promise<void> }) {
  const [empId, setEmpId] = useState(""); const [toDept, setToDept] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  useEffect(() => { if (open) { setEmpId(""); setToDept(defaultDeptId ?? ""); setError("") } }, [open, defaultDeptId])
  async function submit(e: FormEvent) { e.preventDefault(); if (!empId || !toDept) { setError("Выберите сотрудника и отдел"); return }; setSaving(true); setError(""); try { await client.patch(`/employees/${empId}`, { department_id: toDept }); await onSaved(); onClose() } catch (err: unknown) { setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка") } finally { setSaving(false) } }
  if (!open) return null
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}><div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Перевести сотрудника</h3><button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button></div><form onSubmit={submit} className="space-y-3"><select value={empId} onChange={(e) => setEmpId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Сотрудник —</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select><select value={toDept} onChange={(e) => setToDept(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Целевой отдел —</option>{allDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button><button type="submit" disabled={saving} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "..." : "Перевести"}</button></div></form></div></div>)
}

function RemoveEmployeeModal({ open, onClose, employees, targetDeptName, onSaved }: { open: boolean; onClose: () => void; employees: EmployeeDto[]; targetDeptName: string; onSaved: () => Promise<void> }) {
  const [empId, setEmpId] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  useEffect(() => { if (open) { setEmpId(""); setError("") } }, [open, targetDeptName])
  async function submit(e: FormEvent) { e.preventDefault(); if (!empId) { setError("Выберите"); return }; setSaving(true); setError(""); try { await client.patch(`/employees/${empId}`, { department_id: null }); await onSaved(); onClose() } catch (err: unknown) { setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка") } finally { setSaving(false) } }
  if (!open) return null
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}><div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Удалить из отдела</h3><button type="button" className="rounded-lg p-1 hover:bg-accent" onClick={onClose}><X className="h-4 w-4" /></button></div><form onSubmit={submit} className="space-y-3"><div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">Отдел: <span className="font-medium">{targetDeptName}</span></div><select value={empId} onChange={(e) => setEmpId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">— Сотрудник —</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select>{!employees.length && <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Нет сотрудников</div>}{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="h-9 rounded-lg border px-4 text-sm hover:bg-accent" onClick={onClose}>Отмена</button><button type="submit" disabled={saving} className="h-9 rounded-lg bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">{saving ? "..." : "Удалить"}</button></div></form></div></div>)
}

function DeleteModal({ open, deptName, onClose, onConfirm, error }: { open: boolean; deptName: string; onClose: () => void; onConfirm: () => void; error: string }) {
  if (!open) return null
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}><div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}><h3 className="text-lg font-semibold">Удалить отдел?</h3><p className="mt-2 text-sm text-muted-foreground">«{deptName}» будет удалён.</p>{error && <p className="mt-3 text-sm text-destructive">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 rounded-lg border px-4 text-sm hover:bg-accent">Отмена</button><button type="button" onClick={onConfirm} className="h-9 rounded-lg bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90">Удалить</button></div></div></div>)
}

/* ═══════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════ */

type SideAction = { key: string; title: string; desc: string; icon: ReactNode; danger?: boolean; onClick: () => void }

export default function OrgTreePage() {
  const { hasRole } = useAuthStore()
  const isAdmin = hasRole("admin")

  const [rawDepts, setRawDepts] = useState<DepartmentDto[]>([])
  const [rawEmps, setRawEmps] = useState<EmployeeDto[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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
      setRawDepts(normalized); setRawEmps(emps)
      // Auto-expand first level
      const rootIds = normalized.filter((d) => !d.parent_id).map((d) => d.id)
      setExpandedIds(new Set(rootIds))
    } catch (err) { console.error("ORG TREE LOAD ERROR", err); setRawDepts([]); setRawEmps([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const views = useMemo(() => buildViews(rawDepts, rawEmps, search), [rawDepts, rawEmps, search])
  const deptTree = useMemo(() => buildDeptTree(views), [views])
  const selDept = useMemo(() => selectedId ? views.find((d) => d.id === selectedId) ?? null : null, [selectedId, views])
  const selParent = useMemo(() => selDept?.parentId ? rawDepts.find((d) => d.id === selDept.parentId) ?? null : null, [rawDepts, selDept])
  const selChildren = useMemo(() => selDept ? rawDepts.filter((d) => normalizeParentId(d.parent_id) === selDept.id).sort((a, b) => a.name.localeCompare(b.name, "ru")) : [], [rawDepts, selDept])
  const empTarget = useMemo(() => empModalDept ? rawDepts.find((d) => d.id === empModalDept) ?? null : null, [empModalDept, rawDepts])
  const empsNoDept = useMemo(() => rawEmps.filter((e) => !e.department_id), [rawEmps])

  // Auto-expand all when searching
  useEffect(() => {
    if (search.trim()) { setExpandedIds(new Set(views.map((v) => v.id))) }
  }, [search, views])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])

  const expandAll = useCallback(() => setExpandedIds(new Set(views.map((v) => v.id))), [views])
  const collapseAll = useCallback(() => {
    const rootIds = views.filter((v) => !v.parentId).map((v) => v.id)
    setExpandedIds(new Set(rootIds))
  }, [views])

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

  const actions: SideAction[] = selDept ? [
    { key: "edit", title: "Редактировать", desc: "Название, руководитель, описание", icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(selDept) },
    { key: "add", title: "Добавить подотдел", desc: "Создать дочерний отдел", icon: <Plus className="h-4 w-4" />, onClick: () => openCreate(selDept.id) },
    { key: "invite", title: "Добавить сотрудника", desc: "Прикрепить к отделу", icon: <UserPlus className="h-4 w-4" />, onClick: () => { setEmpModalDept(selDept.id); setEmpModalOpen(true) } },
    { key: "transfer", title: "Перевести", desc: "Переместить сотрудника", icon: <Users className="h-4 w-4" />, onClick: () => { setEmpModalDept(selDept.id); setTransferOpen(true) } },
    { key: "remove", title: "Убрать из отдела", desc: "Открепить сотрудника", icon: <UserIcon className="h-4 w-4" />, danger: true, onClick: () => { setEmpModalDept(selDept.id); setRemoveEmpOpen(true) } },
    { key: "delete", title: "Удалить отдел", desc: "Без восстановления", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => openDelete(selDept) },
  ] : []

  if (loading) return <div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  const totalEmp = views.reduce((s, v) => s + v.empCount, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      {/* Header */}
      <div className="org-card overflow-hidden !rounded-2xl px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Оргструктура</h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">Иерархия отделов и распределение сотрудников</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            {isAdmin && <button type="button" onClick={() => openCreate(null)} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:h-9 sm:text-sm"><Plus className="h-3.5 w-3.5" /> Добавить</button>}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-9 text-xs sm:h-9 sm:text-sm" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Поиск…" />
            </div>
          </div>
        </div>

        {/* Stats inline */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1"><Building2 className="h-3.5 w-3.5 text-primary/70" /> {views.length} отделов</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1"><Users className="h-3.5 w-3.5 text-primary/70" /> {totalEmp} сотрудников</span>
          <span className="mx-1 text-border/50">·</span>
          <button type="button" onClick={expandAll} className="rounded-lg bg-muted/30 px-2.5 py-1 transition hover:bg-accent">Развернуть</button>
          <button type="button" onClick={collapseAll} className="rounded-lg bg-muted/30 px-2.5 py-1 transition hover:bg-accent">Свернуть</button>
        </div>
      </div>

      {views.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground"><Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" /><p className="text-sm">Ничего не найдено</p></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          {/* Tree */}
          <div className="space-y-2">
            {deptTree.map((node) => (
              <DeptTreeCard key={node.dept.id} node={node} level={0} selectedId={selectedId}
                expandedIds={expandedIds} search={search} isAdmin={isAdmin}
                onSelect={setSelectedId} onToggle={toggleExpand} onAddChild={openCreate} />
            ))}
          </div>

          {/* Detail sidebar */}
          {selDept ? (
            <aside className="org-sidebar hidden lg:block lg:sticky lg:top-4 lg:self-start">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-muted/10 shadow-sm">
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
                            <div className="absolute right-0 top-9 z-30 w-64 rounded-xl border bg-popover p-1.5 shadow-xl">
                              {actions.map((a) => (
                                <button key={a.key} type="button" className={["flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition", a.danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-accent"].join(" ")} onClick={() => { a.onClick(); setSideMenu(false) }}>
                                  <span className="mt-0.5 shrink-0 text-muted-foreground">{a.icon}</span>
                                  <span className="min-w-0"><span className="block text-[13px] font-medium leading-tight">{a.title}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{a.desc}</span></span>
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

                <div className="max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto px-4 py-3.5">
                  <section>
                    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Building2 className="h-3.5 w-3.5 text-sky-500" /> Положение</div>
                    <div className="space-y-2 rounded-xl border bg-card/75 p-3">
                      <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Родительский</div><div className="mt-1 text-sm font-medium">{selParent?.name || "Корневой"}</div></div>
                      <div className="border-t pt-2"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Дочерние · {selChildren.length}</div>
                        {selChildren.length > 0 ? <div className="mt-1 flex flex-wrap gap-1">{selChildren.slice(0, 6).map((c) => <button key={c.id} type="button" onClick={() => { setSelectedId(c.id); if (!expandedIds.has(selDept!.id)) toggleExpand(selDept!.id) }} className="max-w-full truncate rounded-md border bg-background px-2 py-0.5 text-xs hover:bg-accent" title={c.name}>{c.name}</button>)}{selChildren.length > 6 && <span className="rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">+{selChildren.length - 6}</span>}</div> : <div className="mt-1 text-xs text-muted-foreground">Нет</div>}
                      </div>
                    </div>
                  </section>
                  <section>
                    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Crown className="h-3.5 w-3.5 text-amber-500" /> Руководитель</div>
                    {selDept.head ? (
                      <div className="rounded-xl border bg-card/80 p-3 shadow-sm">
                        <div className="flex items-center gap-2.5">
                          {selDept.head.photo_url ? <img src={selDept.head.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><UserIcon className="h-4 w-4 text-muted-foreground" /></div>}
                          <div><div className="text-sm font-medium">{fullName(selDept.head)}</div><div className="text-xs text-muted-foreground">{selDept.head.position || "—"}</div></div>
                        </div>
                        {selDept.head.email && <div className="mt-2 text-xs text-muted-foreground">{selDept.head.email}</div>}
                      </div>
                    ) : <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Не назначен</div>}
                  </section>
                  <section>
                    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><UserCircle2 className="h-3.5 w-3.5 text-primary" /> Состав ({selDept.empCount})</div>
                    {selDept.tree.length > 0 ? <div className="space-y-1 rounded-xl border bg-card/70 p-2">{selDept.tree.map((e) => <EmpItem key={e.id} node={e} search={search} />)}</div>
                      : <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Нет сотрудников</div>}
                  </section>
                  {selDept.description?.trim() && (
                    <section>
                      <div className="mb-2 text-[13px] font-semibold">Описание</div>
                      <div className="rounded-xl border bg-card/80 p-3 text-sm text-muted-foreground">{selDept.description}</div>
                    </section>
                  )}
                </div>
              </div>
            </aside>
          ) : (
            <aside className="hidden lg:flex lg:sticky lg:top-4 lg:self-start items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/50 p-10 text-center text-muted-foreground">
              <div>
                <Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium text-foreground/60">Выберите отдел</p>
                <p className="mt-1 text-xs">Нажмите на карточку отдела чтобы увидеть подробности</p>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Mobile detail sheet */}
      {selDept && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelectedId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t bg-card shadow-2xl animate-in slide-in-from-bottom">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3">
              <h2 className="text-base font-semibold">{selDept.name}</h2>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 px-4 py-4">
              {selDept.head && (
                <div className="flex items-center gap-2.5">
                  {selDept.head.photo_url ? <img src={selDept.head.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><UserIcon className="h-4 w-4 text-muted-foreground" /></div>}
                  <div><div className="text-sm font-medium">{fullName(selDept.head)}</div><div className="text-xs text-muted-foreground">{selDept.head.position || "—"}</div></div>
                </div>
              )}
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-2 py-0.5"><Users className="mr-1 inline h-3 w-3" />{selDept.empCount} сотр.</span>
                {selDept.childCount > 0 && <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">{selDept.childCount} подотд.</span>}
              </div>
              {selDept.tree.length > 0 && <div className="space-y-1">{selDept.tree.map((e) => <EmpItem key={e.id} node={e} search={search} />)}</div>}
              {isAdmin && (
                <div className="flex flex-wrap gap-2">{actions.map((a) => (
                  <button key={a.key} type="button" onClick={a.onClick} className={["inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition", a.danger ? "border-red-200 text-red-600 hover:bg-red-50" : "hover:bg-accent"].join(" ")}>
                    {a.icon}{a.title}
                  </button>
                ))}</div>
              )}
            </div>
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

      <style>{`
        .org-sidebar {
          box-shadow: -10px 0 20px -14px rgb(99 102 241/.14), 10px 0 20px -14px rgb(14 165 233/.1), 0 1px 3px rgb(0 0 0/.04);
        }
        .dark .org-sidebar {
          box-shadow: -12px 0 24px -12px rgb(56 189 248/.12), 12px 0 24px -12px rgb(139 92 246/.1), 0 1px 3px rgb(0 0 0/.25);
        }
        .org-card {
          border-radius: 1rem; border: 1px solid hsl(var(--border)); background: hsl(var(--card));
          box-shadow: -10px 0 20px -14px rgb(99 102 241/.14), 10px 0 20px -14px rgb(14 165 233/.1), 0 1px 3px rgb(0 0 0/.04);
          transition: border-color .15s, box-shadow .15s;
        }
        .dark .org-card {
          box-shadow: -12px 0 24px -12px rgb(56 189 248/.12), 12px 0 24px -12px rgb(139 92 246/.1), 0 1px 3px rgb(0 0 0/.25);
        }
        .org-card:hover { box-shadow: -12px 0 24px -12px rgb(99 102 241/.2), 12px 0 24px -12px rgb(14 165 233/.16), 0 4px 12px rgb(0 0 0/.06); }
        .dark .org-card:hover { box-shadow: -14px 0 28px -10px rgb(56 189 248/.18), 14px 0 28px -10px rgb(139 92 246/.14), 0 4px 12px rgb(0 0 0/.3); }
        .org-card-selected {
          border-color: rgb(56 189 248 / 0.5) !important;
          box-shadow: -14px 0 28px -12px rgb(56 189 248/.25), 14px 0 28px -12px rgb(99 102 241/.2), 0 4px 16px rgb(56 189 248/.1) !important;
        }
        .dark .org-card-selected {
          border-color: rgb(56 189 248 / 0.4) !important;
          box-shadow: -16px 0 32px -10px rgb(56 189 248/.22), 16px 0 32px -10px rgb(139 92 246/.18), 0 4px 16px rgb(56 189 248/.08) !important;
        }
      `}</style>
    </div>
  )
}