import client from "@/shared/api/client"
import type {
  Department,
  Employee,
  PaginatedResponse,
  User,
  UserCreate,
  UserPasswordChange,
  UserUpdate,
} from "@/shared/types"

export interface EmployeeBindingUpdate {
  user_id: string | null
}

export interface DepartmentAdminPayload {
  name: string
  head_id?: string | null
}

export interface EmployeeAdminCreatePayload {
  first_name: string
  last_name: string
  middle_name?: string | null
  position: string
  email: string
  room_number?: string | null
  internal_phone?: string | null
  mobile_phone?: string | null
  birth_date?: string | null
  vacation_start?: string | null
  vacation_end?: string | null
  manager_id?: string | null
  department_id?: string | null
  is_active?: boolean
  user_id?: string | null
}

export interface EmployeeAdminUpdatePayload {
  first_name?: string
  last_name?: string
  middle_name?: string | null
  position?: string
  email?: string
  room_number?: string | null
  internal_phone?: string | null
  mobile_phone?: string | null
  birth_date?: string | null
  vacation_start?: string | null
  vacation_end?: string | null
  manager_id?: string | null
  department_id?: string | null
  is_active?: boolean
  user_id?: string | null
}

export async function getAdminUsers(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}): Promise<PaginatedResponse<User>> {
  const { data } = await client.get<PaginatedResponse<User>>("/users/", { params })
  return data
}

export async function createAdminUser(payload: UserCreate): Promise<User> {
  const { data } = await client.post<User>("/users/", payload)
  return data
}

export async function updateAdminUser(id: string, payload: UserUpdate): Promise<User> {
  const { data } = await client.patch<User>(`/users/${id}`, payload)
  return data
}

export async function changeAdminUserPassword(
  id: string,
  payload: UserPasswordChange
): Promise<User> {
  const { data } = await client.patch<User>(`/users/${id}/password`, payload)
  return data
}

export async function deleteAdminUser(id: string): Promise<{ status: string }> {
  const { data } = await client.delete<{ status: string }>(`/users/${id}`)
  return data
}

export async function getAdminEmployees(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}): Promise<PaginatedResponse<Employee>> {
  const { data } = await client.get<PaginatedResponse<Employee>>("/employees/", { params })
  return data
}

export async function createAdminEmployee(payload: EmployeeAdminCreatePayload): Promise<Employee> {
  const { data } = await client.post<Employee>("/employees/", payload)
  return data
}

export async function updateAdminEmployee(
  id: string,
  payload: EmployeeAdminUpdatePayload
): Promise<Employee> {
  const { data } = await client.patch<Employee>(`/employees/${id}`, payload)
  return data
}

export async function deleteAdminEmployee(id: string): Promise<{ status: string }> {
  const { data } = await client.delete<{ status: string }>(`/employees/${id}`)
  return data
}

export async function updateEmployeeBinding(
  id: string,
  payload: EmployeeBindingUpdate
): Promise<Employee> {
  const { data } = await client.patch<Employee>(`/employees/${id}`, payload)
  return data
}

export async function getAdminDepartments(): Promise<Department[]> {
  const { data } = await client.get<Department[]>("/departments/")
  return data
}

export async function createAdminDepartment(payload: DepartmentAdminPayload): Promise<Department> {
  const { data } = await client.post<Department>("/departments/", payload)
  return data
}

export async function updateAdminDepartment(
  id: string,
  payload: DepartmentAdminPayload
): Promise<Department> {
  const { data } = await client.patch<Department>(`/departments/${id}`, payload)
  return data
}

export async function deleteAdminDepartment(id: string): Promise<void> {
  await client.delete(`/departments/${id}`)
}