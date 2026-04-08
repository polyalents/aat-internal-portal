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

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const { isIT, hasRole } = useAuthStore()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/" className="text-lg font-semibold" onClick={onClose}>
            AAT Portal
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-sidebar-accent lg:hidden"
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
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    location.pathname.startsWith("/admin")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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