import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarHeart,
  Ticket,
  MessageCircle,
  Megaphone,
  BookOpen,
  UserCircle,
  Shield,
  X,
} from "lucide-react"

import { useAuthStore } from "@/features/auth/store"
import { cn } from "@/lib/utils"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Главная" },
  { to: "/employees", icon: Users, label: "Сотрудники" },
  { to: "/org-tree", icon: Building2, label: "Оргструктура" },
  { to: "/birthdays", icon: CalendarHeart, label: "Дни рождения" },
  { to: "/tickets", icon: Ticket, label: "Заявки" },
  { to: "/chat", icon: MessageCircle, label: "Чат" },
  { to: "/announcements", icon: Megaphone, label: "Объявления" },
  { to: "/knowledge", icon: BookOpen, label: "База знаний" },
]

const BOTTOM_ITEMS = [{ to: "/profile", icon: UserCircle, label: "Профиль" }]

function Logo() {
  return (
    <>
      {/* Dark theme */}
      <div className="hidden items-center gap-2.5 dark:flex">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" className="h-8 w-8 shrink-0">
          <rect width="64" height="64" rx="16" fill="#0B0B0F" />
          <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="24" fontWeight="800" letterSpacing="0.5">
            <tspan fill="#A78BFA">A</tspan><tspan fill="#60A5FA">P</tspan>
          </text>
        </svg>
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          AAT Portal
        </span>
      </div>

      {/* Light theme */}
      <div className="flex items-center gap-2.5 dark:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" className="h-8 w-8 shrink-0">
          <rect width="64" height="64" rx="16" fill="#2D2B3D" />
          <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="24" fontWeight="800" letterSpacing="0.5">
            <tspan fill="#A78BFA">A</tspan><tspan fill="#60A5FA">P</tspan>
          </text>
        </svg>
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          AAT Portal
        </span>
      </div>
    </>
  )
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const { isIT, hasRole } = useAuthStore()

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/" onClick={onClose} className="min-w-0">
            <Logo />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 transition hover:bg-sidebar-accent lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== "/" && location.pathname.startsWith(item.to))

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "border-transparent text-sidebar-foreground/78 hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}

          {(isIT() || hasRole("admin")) && (
            <>
              <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Управление
              </div>

              {hasRole("admin") && (
                <Link
                  to="/admin/users"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                    location.pathname.startsWith("/admin")
                      ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "border-transparent text-sidebar-foreground/78 hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  Админка
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="space-y-1 border-t border-sidebar-border p-3">
          {BOTTOM_ITEMS.map((item) => {
            const isActive = location.pathname === item.to

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "border-transparent text-sidebar-foreground/78 hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </aside>
    </>
  )
}