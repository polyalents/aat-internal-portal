import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { LogOut, Menu, Moon, Sun, UserCircle } from "lucide-react"

import { useAuthStore } from "@/features/auth/store"
import { ROLE_LABELS } from "@/lib/utils"

interface HeaderProps {
  onMenuClick: () => void
}

type ThemeMode = "light" | "dark"

const THEME_STORAGE_KEY = "portal_theme"

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light"

  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === "light" || saved === "dark") return saved

  return "light"
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-2 transition-colors hover:bg-accent lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-2 sm:gap-3">
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
            onClick={toggleTheme}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

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