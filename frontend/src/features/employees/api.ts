import client from "@/shared/api/client"
import type {
  Employee,
  OrgTreeNode,
  BirthdayEntry,
  PaginatedResponse,
} from "@/shared/types"

export async function getEmployees(params?: {
  page?: number
  size?: number
  search?: string
  department_id?: string
  sort_by?: "name" | "birth_date"
}): Promise<PaginatedResponse<Employee>> {
  const { data } = await client.get("/employees/", { params })

  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: params?.page ?? 1,
      size: params?.size ?? data.length,
    }
  }

  return data
}

export async function getEmployee(id: string): Promise<Employee> {
  const { data } = await client.get(`/employees/${id}`)
  return data
}

export async function createEmployee(payload: Partial<Employee>): Promise<Employee> {
  const { data } = await client.post("/employees", payload)
  return data
}

export async function updateEmployee(
  id: string,
  payload: Partial<Employee>
): Promise<Employee> {
  const { data } = await client.patch(`/employees/${id}`, payload)
  return data
}

export async function getOrgTree(): Promise<OrgTreeNode[]> {
  const { data } = await client.get("/employees/org-tree")
  return data
}

export async function getBirthdays(period: string): Promise<BirthdayEntry[]> {
  const { data } = await client.get("/employees/birthdays", {
    params: { period },
  })
  return data
}

export async function uploadEmployeePhoto(id: string, file: File): Promise<Employee> {
  const form = new FormData()
  form.append("file", file)

  const { data } = await client.post(`/employees/${id}/photo`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })

  return data
}