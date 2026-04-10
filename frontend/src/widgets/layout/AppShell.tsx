import { useState } from "react"
import { Outlet } from "react-router-dom"

import { Sidebar } from "@/widgets/layout/Sidebar"
import { Header } from "@/widgets/layout/Header"

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}