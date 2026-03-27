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

  const [page, setPage] = useState(Number.isNaN(initialPage) ? 1 : initialPage)
  const [search, setSearch] = useState(initialSearch)
  const [searchInput, setSearchInput] = useState(initialSearch)

  useEffect(() => {
    const params = new URLSearchParams()

    if (page > 1) {
      params.set("page", String(page))
    }

    if (search.trim()) {
      params.set("search", search.trim())
    }

    setSearchParams(params, { replace: true })
  }, [page, search, setSearchParams])

  useEffect(() => {
    setLoading(true)
    setError("")

    getEmployees({
      page,
      size: PAGE_SIZE,
      search: search.trim() || undefined,
    })
      .then((res: PaginatedResponse<Employee>) => {
        setEmployees(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        console.error(err)
        setEmployees([])
        setTotal(0)
        setError("Не удалось загрузить сотрудников")
      })
      .finally(() => setLoading(false))
  }, [page, search])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const pageNumbers = useMemo(() => {
    const pages: number[] = []

    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, page + 2)

    for (let i = start; i <= end; i += 1) {
      pages.push(i)
    }

    return pages
  }, [page, totalPages])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function handleClearSearch() {
    setSearchInput("")
    setSearch("")
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Сотрудники</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Телефонный и организационный справочник сотрудников
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          {loading ? "Загрузка..." : `Показано ${from}-${to} из ${total}`}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 md:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по имени, должности, отделу, email..."
              className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Найти
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {search
              ? "По вашему запросу сотрудники не найдены"
              : "Список сотрудников пока пуст"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {employees.map((employee) => (
              <Link
                key={employee.id}
                to={`/employees/${employee.id}`}
                className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  {employee.photo_url ? (
                    <img
                      src={employee.photo_url}
                      alt={employee.full_name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <User className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1">
                      <h2 className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                        {employee.full_name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {employee.position}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      {employee.department_name && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {employee.department_name}
                          </span>
                        </div>
                      )}

                      {employee.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{employee.email}</span>
                        </div>
                      )}

                      {(employee.internal_phone || employee.mobile_phone) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {employee.internal_phone || employee.mobile_phone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {employee.is_on_vacation && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      В отпуске
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Страница {page} из {totalPages}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Назад
                </button>

                {pageNumbers.map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm transition-colors",
                      page === pageNum
                        ? "bg-primary text-primary-foreground"
                        : "border border-input bg-background hover:bg-accent"
                    )}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={page === totalPages}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}