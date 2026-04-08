import { useEffect, type ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { useAuthStore } from "@/features/auth/store"
import { AppShell } from "@/widgets/layout/AppShell"

import LoginPage from "@/pages/login/LoginPage"
import DashboardPage from "@/pages/dashboard/DashboardPage"

import EmployeesPage from "@/pages/EmployeesPage"
import EmployeeDetailPage from "@/pages/EmployeeDetailPage"
import OrgTreePage from "@/pages/OrgTreePage"
import BirthdaysPage from "@/pages/BirthdaysPage"

import TicketsPage from "@/pages/TicketsPage"
import TicketDetailPage from "@/pages/TicketDetailPage"
import TicketCreatePage from "@/pages/TicketCreatePage"

import ChatPage from "@/pages/ChatPage"
import AnnouncementsPage from "@/pages/AnnouncementsPage"
import KnowledgePage from "@/pages/KnowledgePage"
import ArticlePage from "@/pages/ArticlePage"
import ProfilePage from "@/pages/ProfilePage"

import AdminPage from "@/pages/admin/AdminPage"
import AdminUsersPage from "@/pages/admin/AdminUsersPage"
import AdminEmployeesPage from "@/pages/admin/AdminEmployeesPage"

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Загрузка...</div>
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { hasRole } = useAuthStore()

  if (!hasRole("admin")) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function App() {
  const { loadUser } = useAuthStore()

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />

          <Route path="employees" element={<EmployeesPage />} />
          <Route path="employees/:id" element={<EmployeeDetailPage />} />

          <Route path="org-tree" element={<OrgTreePage />} />
          <Route path="birthdays" element={<BirthdaysPage />} />

          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/new" element={<TicketCreatePage />} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />

          <Route path="chat" element={<ChatPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />

          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="knowledge/:id" element={<ArticlePage />} />

          <Route path="profile" element={<ProfilePage />} />

          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="employees" element={<AdminEmployeesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}