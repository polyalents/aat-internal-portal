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

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/?$/, "") || window.location.origin

function getPhotoUrl(url?: string | null): string | null {
  if (!url) return null
  if (url.startsWith("http")) return url
  return `${API_BASE}${url}`
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?"
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { navigate("/employees", { replace: true }); return }
    setLoading(true)
    getEmployee(id).then(setEmployee).catch(() => navigate("/employees", { replace: true })).finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  if (!employee) return null

  const photoUrl = getPhotoUrl(employee.photo_url)
  const initials = getInitials(employee.full_name)

  const contactItems = [
    employee.email && { icon: <Mail className="h-4 w-4" />, label: "Email", value: employee.email, href: `mailto:${employee.email}` },
    employee.internal_phone && { icon: <Phone className="h-4 w-4" />, label: "Внутренний", value: employee.internal_phone },
    employee.mobile_phone && { icon: <Phone className="h-4 w-4" />, label: "Мобильный", value: employee.mobile_phone, href: `tel:${employee.mobile_phone}` },
    employee.room_number && { icon: <Building2 className="h-4 w-4" />, label: "Кабинет", value: employee.room_number },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string; href?: string }>

  const workItems = [
    employee.department_name && { icon: <Building2 className="h-4 w-4" />, label: "Отдел", value: employee.department_name },
    employee.manager_name && employee.manager_id && { icon: <User className="h-4 w-4" />, label: "Руководитель", value: employee.manager_name, link: `/employees/${employee.manager_id}` },
    employee.birth_date && { icon: <Cake className="h-4 w-4" />, label: "Дата рождения", value: formatDate(employee.birth_date) },
    employee.vacation_start && employee.vacation_end && { icon: <Palmtree className="h-4 w-4" />, label: "Отпуск", value: `${formatDate(employee.vacation_start)} — ${formatDate(employee.vacation_end)}` },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string; link?: string }>

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      {/* Back */}
      <button type="button" onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Назад
      </button>

      {/* Hero card */}
      <div className="emp-detail-hero overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center px-5 py-8 text-center sm:px-8 sm:py-10">
          {/* Avatar */}
          <div className="h-24 w-24 overflow-hidden rounded-full ring-2 ring-indigo-100 dark:ring-sky-500/20 sm:h-28 sm:w-28">
            {photoUrl ? (
              <img src={photoUrl} alt={employee.full_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-sky-500 text-2xl font-semibold text-white dark:from-sky-500 dark:to-indigo-600 sm:text-3xl">{initials}</div>
            )}
          </div>

          <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">{employee.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{employee.position}</p>

          {employee.is_on_vacation && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <Palmtree className="h-3.5 w-3.5" />
              {employee.vacation_end ? `В отпуске до ${formatDate(employee.vacation_end)}` : "В отпуске"}
            </span>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Contacts */}
        <div className="emp-detail-card overflow-hidden">
          <div className="border-b border-border bg-muted/25 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Контакты</h2>
          </div>
          {contactItems.length > 0 ? (
            <div className="divide-y divide-border/60">
              {contactItems.map((item) => (
                <InfoRow key={item.label} icon={item.icon} label={item.label} value={item.value} href={item.href} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">Контакты не указаны</div>
          )}
        </div>

        {/* Work info */}
        <div className="emp-detail-card overflow-hidden">
          <div className="border-b border-border bg-muted/25 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Рабочая информация</h2>
          </div>
          {workItems.length > 0 ? (
            <div className="divide-y divide-border/60">
              {workItems.map((item) => (
                <InfoRow key={item.label} icon={item.icon} label={item.label} value={item.value} link={item.link} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">Информация не заполнена</div>
          )}
        </div>
      </div>

      <style>{`
        .emp-detail-hero {
          border: 1px solid hsl(var(--border)); background: hsl(var(--card));
          box-shadow:
            -16px 0 32px -14px rgb(99 102 241/.2),
            16px 0 32px -14px rgb(14 165 233/.16),
            0 2px 12px -4px rgb(99 102 241/.08);
        }
        .dark .emp-detail-hero {
          box-shadow:
            -18px 0 36px -12px rgb(56 189 248/.18),
            18px 0 36px -12px rgb(139 92 246/.14),
            0 2px 12px -4px rgb(56 189 248/.08);
        }
        .emp-detail-card {
          border-radius: 1rem; border: 1px solid hsl(var(--border)); background: hsl(var(--card));
          box-shadow:
            -10px 0 20px -14px rgb(99 102 241/.14),
            10px 0 20px -14px rgb(14 165 233/.1),
            0 1px 3px rgb(0 0 0/.04);
        }
        .dark .emp-detail-card {
          box-shadow:
            -12px 0 24px -12px rgb(56 189 248/.12),
            12px 0 24px -12px rgb(139 92 246/.1),
            0 1px 3px rgb(0 0 0/.25);
        }
      `}</style>
    </div>
  )
}

function InfoRow({ icon, label, value, href, link }: {
  icon: React.ReactNode; label: string; value: string; href?: string; link?: string
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-sky-500/15 dark:text-sky-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {link ? (
          <Link to={link} className="mt-0.5 block break-words text-sm font-medium text-primary hover:underline">{value}</Link>
        ) : href ? (
          <a href={href} className="mt-0.5 block break-words text-sm font-medium text-primary hover:underline">{value}</a>
        ) : (
          <p className="mt-0.5 break-words text-sm font-medium">{value}</p>
        )}
      </div>
    </div>
  )
}