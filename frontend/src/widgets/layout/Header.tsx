import { Link } from "react-router-dom"
import { LogOut, Menu, UserCircle } from "lucide-react"

import { useAuthStore } from "@/features/auth/store"
import { ROLE_LABELS } from "@/lib/utils"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-2 hover:bg-accent lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>

          <Link
            to="/profile"
            className="rounded-md p-2 transition-colors hover:bg-accent"
            title="Профиль"
          >
            <UserCircle className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={logout}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Выйти"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      )}
    </header>
  )
}