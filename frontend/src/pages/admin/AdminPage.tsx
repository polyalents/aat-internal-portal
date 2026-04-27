import { NavLink, Outlet } from "react-router-dom"
import { Settings2, Shield, Users, Building2 } from "lucide-react"

import { cn } from "@/lib/utils"

const tabs = [
  { to: "/admin/users", label: "Учётные записи", icon: Shield },
  { to: "/admin/employees", label: "Карточки сотрудников", icon: Users },
  { to: "/admin/departments", label: "Отделы", icon: Building2 },
]

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 pb-8 sm:space-y-6 sm:px-4 sm:pb-12">
      <section className="admin-hero relative overflow-hidden rounded-[1.5rem] border border-border/80 bg-card/95 sm:rounded-[2rem]">
        <div className="relative z-10 px-4 py-5 sm:px-8 sm:py-7">
          <div className="max-w-3xl">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">Системные настройки доступа</p>
            <h1 className="mt-2 flex items-center gap-3 text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 sm:h-10 sm:w-10">
                <Settings2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="min-w-0">Администрирование</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Управление учётными записями, карточками сотрудников и отделами.
            </p>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/[0.07] blur-3xl sm:h-56 sm:w-56 dark:bg-sky-500/[0.08]" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-sky-500/[0.06] blur-3xl sm:h-44 sm:w-44 dark:bg-indigo-500/[0.06]" />
      </section>

      <div className="admin-card overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/25 px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition sm:justify-start",
                      isActive
                        ? "border-primary/20 bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </NavLink>
              )
            })}
          </div>
        </div>

        <div className="px-3 py-4 sm:px-5 sm:py-5">
          <Outlet />
        </div>
      </div>

      <style>{`
        .admin-hero {
          border: 1px solid hsl(var(--border));
          background:
            radial-gradient(circle at top right, rgb(99 102 241 / 0.08), transparent 30%),
            radial-gradient(circle at bottom left, rgb(14 165 233 / 0.08), transparent 28%),
            hsl(var(--card));
          box-shadow:
            -20px 0 40px -18px rgb(99 102 241 / 0.18),
            20px 0 40px -18px rgb(14 165 233 / 0.12),
            0 6px 22px -10px rgb(99 102 241 / 0.12);
        }
        .dark .admin-hero {
          box-shadow:
            -22px 0 44px -16px rgb(56 189 248 / 0.16),
            22px 0 44px -16px rgb(139 92 246 / 0.12),
            0 6px 22px -10px rgb(56 189 248 / 0.08);
        }
        .admin-card {
          box-shadow:
            -10px 0 20px -14px rgb(99 102 241 / 0.14),
            10px 0 20px -14px rgb(14 165 233 / 0.10),
            0 1px 3px rgb(0 0 0 / 0.04);
        }
        .dark .admin-card {
          box-shadow:
            -12px 0 24px -12px rgb(56 189 248 / 0.12),
            12px 0 24px -12px rgb(139 92 246 / 0.10),
            0 1px 3px rgb(0 0 0 / 0.25);
        }
      `}</style>
    </div>
  )
}