import client from "@/shared/api/client"

export type DepartmentDto = {
  id: string
  name: string
  head_id: string | null
  head_name?: string | null
  parent_id: string | null
  created_at?: string
}

export type DepartmentsResponse = {
  items: DepartmentDto[]
  total: number
  page: number
  size: number
}

export async function getDepartments(params?: {
  page?: number
  size?: number
  search?: string
}) {
  const { data } = await client.get<DepartmentsResponse>("/departments/", {
    params,
  })
  return data
}