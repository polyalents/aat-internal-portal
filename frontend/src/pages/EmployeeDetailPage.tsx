import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  Cake,
  Mail,
  Palmtree,
  Phone,
  User,
} from "lucide-react"

import type { Employee } from "@/shared/types"
import { getEmployee } from "@/features/employees/api"
import { formatDate } from "@/lib/utils"

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      navigate("/employees", { replace: true })
      return
    }

    setLoading(true)

    getEmployee(id)
      .then(setEmployee)
      .catch(() => navigate("/employees", { replace: true }))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (!employee) {
    return null
  }

  const isOnVacation = employee.is_on_vacation

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="bg-primary px-6 py-8 text-primary-foreground">
          <div className="flex items-center gap-6">
            {employee.photo_url ? (
              <img
                src={employee.photo_url}
                alt={employee.full_name}
                className="h-24 w-24 rounded-full border-4 border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/20 bg-white/10">
                <User className="h-10 w-10" />
              </div>
            )}

            <div>
              <h1 className="text-2xl font-bold">{employee.full_name}</h1>
              <p className="mt-1 text-lg text-primary-foreground/80">
                {employee.position}
              </p>

              {isOnVacation && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm text-primary-foreground">
                  <Palmtree className="h-4 w-4" />
                  {employee.vacation_end
                    ? `В отпуске до ${formatDate(employee.vacation_end)}`
                    : "В отпуске"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Контактная информация
            </h2>

            {employee.email && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <a
                    href={`mailto:${employee.email}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {employee.email}
                  </a>
                </div>
              </div>
            )}

            {employee.internal_phone && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Внутренний телефон
                  </p>
                  <p className="text-sm font-medium">{employee.internal_phone}</p>
                </div>
              </div>
            )}

            {employee.mobile_phone && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Мобильный</p>
                  <a
                    href={`tel:${employee.mobile_phone}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {employee.mobile_phone}
                  </a>
                </div>
              </div>
            )}

            {employee.room_number && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Кабинет</p>
                  <p className="text-sm font-medium">{employee.room_number}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Рабочая информация
            </h2>

            {employee.department_name && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Отдел</p>
                  <p className="text-sm font-medium">{employee.department_name}</p>
                </div>
              </div>
            )}

            {employee.manager_name && employee.manager_id && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Руководитель</p>
                  <Link
                    to={`/employees/${employee.manager_id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {employee.manager_name}
                  </Link>
                </div>
              </div>
            )}

            {employee.birth_date && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Cake className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Дата рождения</p>
                  <p className="text-sm font-medium">
                    {formatDate(employee.birth_date)}
                  </p>
                </div>
              </div>
            )}

            {employee.vacation_start && employee.vacation_end && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Palmtree className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Отпуск</p>
                  <p className="text-sm font-medium">
                    {formatDate(employee.vacation_start)} —{" "}
                    {formatDate(employee.vacation_end)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}