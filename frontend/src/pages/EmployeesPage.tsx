import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Building2,
  Mail,
  Phone,
  Search,
  User,
  X,
} from "lucide-react"

import type { Employee, PaginatedResponse } from "@/shared/types"
import { getEmployees } from "@/features/employees/api"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

export default function EmployeesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const initialPage = Number(searchParams.get("page") || "1")
  const initialSearch = searchParams.get("search") || ""
  const initialSort = searchParams.get("sort") === "birth_date" ? "birth_date" : "name"

  const [page, setPage] = useState(Number.isNaN(initialPage) ? 1 : initialPage)
  const [search, setSearch] = useState(initialSearch)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [sortBy, setSortBy] = useState<"name" | "birth_date">(initialSort)

  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set("page", String(page))
    if (search.trim()) params.set("search", search.trim())
    if (sortBy === "birth_date") params.set("sort", "birth_date")
    setSearchParams(params, { replace: true })
  }, [page, search, sortBy, setSearchParams])

  useEffect(() => {
    setLoading(true); setError("")
    getEmployees({ page, size: PAGE_SIZE, search: search.trim() || undefined, sort_by: sortBy })
      .then((res: PaginatedResponse<Employee>) => { setEmployees(res.items); setTotal(res.total) })
      .catch((err) => { console.error(err); setEmployees([]); setTotal(0); setError("Не удалось загрузить сотрудников") })
      .finally(() => setLoading(false))
  }, [page, search, sortBy])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i)
    return pages
  }, [page, totalPages])

  function handleSearchSubmit(e: React.FormEvent) { e.preventDefault(); setPage(1); setSearch(searchInput) }
  function handleClearSearch() { setSearchInput(""); setSearch(""); setPage(1) }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      {/* Header card */}
      <div className="emp-card overflow-hidden !rounded-2xl px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Сотрудники</h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">Телефонный и организационный справочник</p>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {loading ? "Загрузка..." : `${from}–${to} из ${total}`}
          </p>
        </div>

        {/* Search & sort */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по имени, должности, отделу, email..."
              className="emp-input h-9 w-full rounded-xl pl-9 pr-9 text-sm" />
            {searchInput && (
              <button type="button" onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            )}
          </div>
          <button type="submit" className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Найти</button>
        </form>

        <div className="mt-3 flex items-center gap-2 text-xs sm:text-sm">
          <label htmlFor="emp-sort" className="text-muted-foreground">Сортировка:</label>
          <select id="emp-sort" value={sortBy} onChange={(e) => { setSortBy(e.target.value === "birth_date" ? "birth_date" : "name"); setPage(1) }}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
            <option value="name">По ФИО</option>
            <option value="birth_date">По дате рождения</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : error ? (
        <div className="emp-card p-6 text-center"><p className="text-sm text-destructive">{error}</p></div>
      ) : employees.length === 0 ? (
        <div className="emp-card flex flex-col items-center p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground/40"><User className="h-8 w-8" /></div>
          <p className="mt-3 text-sm font-medium text-foreground/70">{search ? "Сотрудники не найдены" : "Список пока пуст"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{search ? "Попробуйте изменить запрос" : "Добавьте сотрудников через админку"}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
            {employees.map((emp) => (
              <Link key={emp.id} to={`/employees/${emp.id}`}
                className="emp-card group p-4 transition-all sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} alt={emp.full_name} className="h-12 w-12 shrink-0 rounded-full object-cover sm:h-14 sm:w-14" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted sm:h-14 sm:w-14"><User className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" /></div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold transition-colors group-hover:text-primary sm:text-base">{emp.full_name}</h2>
                        <p className="truncate text-xs text-muted-foreground sm:text-sm">{emp.position}</p>
                      </div>
                      {emp.is_on_vacation && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 sm:text-xs">Отпуск</span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {emp.department_name && (
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{emp.department_name}</span></span>
                      )}
                      {emp.email && (
                        <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{emp.email}</span></span>
                      )}
                      {(emp.internal_phone || emp.mobile_phone) && (
                        <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 shrink-0" />{emp.internal_phone || emp.mobile_phone}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="emp-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground sm:text-sm">Страница {page} из {totalPages}</p>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="inline-flex h-8 items-center rounded-lg border border-input bg-background px-3 text-xs transition hover:bg-accent disabled:opacity-50 sm:h-9 sm:text-sm">Назад</button>
                {pageNumbers.map((n) => (
                  <button key={n} type="button" onClick={() => setPage(n)}
                    className={cn("inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-xs transition sm:h-9 sm:min-w-9 sm:text-sm",
                      page === n ? "bg-primary text-primary-foreground" : "border border-input bg-background hover:bg-accent")}>{n}</button>
                ))}
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="inline-flex h-8 items-center rounded-lg border border-input bg-background px-3 text-xs transition hover:bg-accent disabled:opacity-50 sm:h-9 sm:text-sm">Вперёд</button>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .emp-card {
          border-radius: 1rem; border: 1px solid hsl(var(--border)); background: hsl(var(--card));
          box-shadow: -10px 0 20px -14px rgb(99 102 241/.14), 10px 0 20px -14px rgb(14 165 233/.1), 0 1px 3px rgb(0 0 0/.04);
          transition: border-color .15s, box-shadow .15s;
        }
        .dark .emp-card {
          box-shadow: -12px 0 24px -12px rgb(56 189 248/.12), 12px 0 24px -12px rgb(139 92 246/.1), 0 1px 3px rgb(0 0 0/.25);
        }
        .emp-card:hover {
          box-shadow: -12px 0 24px -12px rgb(99 102 241/.2), 12px 0 24px -12px rgb(14 165 233/.16), 0 4px 12px rgb(0 0 0/.06);
        }
        .dark .emp-card:hover {
          box-shadow: -14px 0 28px -10px rgb(56 189 248/.18), 14px 0 28px -10px rgb(139 92 246/.14), 0 4px 12px rgb(0 0 0/.3);
        }
        .emp-input {
          border: 1px solid rgb(209 213 219); background: rgb(249 250 251); color: rgb(17 24 39);
          transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .emp-input::placeholder { color: rgb(156 163 175); }
        .emp-input:hover { border-color: rgb(156 163 175); background: #fff; }
        .emp-input:focus { border-color: rgb(99 102 241); background: #fff; box-shadow: 0 0 0 3px rgb(99 102 241/.15); outline: none; }
        .dark .emp-input { border-color: rgb(51 65 85); background: rgb(30 41 59); color: rgb(241 245 249); }
        .dark .emp-input::placeholder { color: rgb(100 116 139); }
        .dark .emp-input:hover { border-color: rgb(71 85 105); background: rgb(35 46 66); }
        .dark .emp-input:focus { border-color: rgb(56 189 248); background: rgb(35 46 66); box-shadow: 0 0 0 3px rgb(56 189 248/.2); }
      `}</style>
    </div>
  )
}