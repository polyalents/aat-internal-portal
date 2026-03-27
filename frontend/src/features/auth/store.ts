import { create } from "zustand"
import { getMe, login as apiLogin, logout as apiLogout } from "@/features/auth/api"
import { getAccessToken, clearTokens } from "@/shared/api/client"
import type { User, UserRole } from "@/shared/types"

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean

  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  hasRole: (...roles: UserRole[]) => boolean
  isIT: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true })

    await apiLogin({ username, password })
    const user = await getMe()

    set({
      user,
      isAuthenticated: true,
      isLoading: false,
    })
  },

  logout: () => {
    clearTokens()
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })
    apiLogout()
  },

  loadUser: async () => {
    const token = getAccessToken()

    if (!token) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
      return
    }

    try {
      const user = await getMe()

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      clearTokens()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  hasRole: (...roles: UserRole[]) => {
    const { user } = get()
    return user ? roles.includes(user.role) : false
  },

  isIT: () => {
    const { user } = get()
    return user?.role === "it_specialist" || user?.role === "admin"
  },
}))