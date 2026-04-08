import { NavLink, Outlet } from "react-router-dom"

import { cn } from "@/lib/utils"

const tabs = [
  { to: "/admin/users", label: "Учётные записи" },
  { to: "/admin/employees", label: "Карточки сотрудников" },
]

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Администрирование</h1>
        <p className="text-muted-foreground">Управление учётными записями для входа и карточками сотрудников.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "rounded-md border px-3 py-1.5 text-sm",
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}