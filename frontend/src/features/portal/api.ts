import client from "@/shared/api/client"
import type {
  Announcement,
  KnowledgeCategory,
  KnowledgeArticle,
  ChatMessage,
  Dashboard,
  User,
  UserCreate,
  UserUpdate,
  Department,
  PaginatedResponse,
  SystemSetting,
} from "@/shared/types"

// === Announcements ===
export async function getAnnouncements(params?: {
  page?: number
  size?: number
  active_only?: boolean
}): Promise<PaginatedResponse<Announcement>> {
  const { data } = await client.get("/announcements/", { params })
  return data
}

export async function createAnnouncement(payload: {
  title: string
  content: string
  expires_at?: string
}): Promise<Announcement> {
  const { data } = await client.post("/announcements/", payload)
  return data
}

export async function updateAnnouncement(
  id: string,
  payload: Partial<Announcement>
): Promise<Announcement> {
  const { data } = await client.patch(`/announcements/${id}`, payload)
  return data
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await client.delete(`/announcements/${id}`)
}

// === Knowledge ===
export async function getKnowledgeCategories(): Promise<KnowledgeCategory[]> {
  const { data } = await client.get("/knowledge/categories/")
  return data
}

export async function createKnowledgeCategory(payload: {
  name: string
  sort_order?: number
}): Promise<KnowledgeCategory> {
  const { data } = await client.post("/knowledge/categories/", payload)
  return data
}

export async function getArticles(params?: {
  page?: number
  size?: number
  category_id?: string
  search?: string
}): Promise<PaginatedResponse<KnowledgeArticle>> {
  const { data } = await client.get("/knowledge/articles/", { params })
  return data
}

export async function getArticle(id: string): Promise<KnowledgeArticle> {
  const { data } = await client.get(`/knowledge/articles/${id}`)
  return data
}

export async function createArticle(payload: {
  title: string
  content: string
  category_id: string
}): Promise<KnowledgeArticle> {
  const { data } = await client.post("/knowledge/articles/", payload)
  return data
}

export async function updateArticle(
  id: string,
  payload: Partial<KnowledgeArticle>
): Promise<KnowledgeArticle> {
  const { data } = await client.patch(`/knowledge/articles/${id}`, payload)
  return data
}

export async function deleteArticle(id: string): Promise<void> {
  await client.delete(`/knowledge/articles/${id}`)
}

// === Chat ===
export async function getChatMessages(params?: {
  before?: string
  limit?: number
}): Promise<{ items: ChatMessage[]; has_more: boolean }> {
  const { data } = await client.get("/chat/messages/", { params })
  return data
}

export async function deleteChatMessage(id: string): Promise<void> {
  await client.delete(`/chat/messages/${id}`)
}

export async function pinChatMessage(id: string): Promise<ChatMessage> {
  const { data } = await client.patch(`/chat/messages/${id}/pin`)
  return data
}

// === Dashboard ===
export async function getDashboard(): Promise<Dashboard> {
  const token = localStorage.getItem("access_token")

  const response = await fetch("/api/dashboard/", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

// === Users ===
export async function getUsers(params?: {
  page?: number
  size?: number
  role?: string
  is_active?: boolean
  search?: string
}): Promise<PaginatedResponse<User>> {
  const { data } = await client.get("/users/", { params })
  return data
}

export async function createUser(payload: UserCreate): Promise<User> {
  const { data } = await client.post("/users/", payload)
  return data
}

export async function updateUser(id: string, payload: UserUpdate): Promise<User> {
  const { data } = await client.patch(`/users/${id}`, payload)
  return data
}

// === Departments ===
export async function getDepartments(): Promise<Department[]> {
  const { data } = await client.get("/departments/")
  return data
}

export async function createDepartment(payload: { name: string }): Promise<Department> {
  const { data } = await client.post("/departments/", payload)
  return data
}

export async function updateDepartment(
  id: string,
  payload: Partial<Department>
): Promise<Department> {
  const { data } = await client.patch(`/departments/${id}`, payload)
  return data
}

export async function deleteDepartment(id: string): Promise<void> {
  await client.delete(`/departments/${id}`)
}

// === Profile ===
export async function getProfile() {
  const { data } = await client.get("/profile/")
  return data
}

export async function updateProfile(payload: Record<string, unknown>) {
  const { data } = await client.patch("/profile/", payload)
  return data
}

export async function uploadProfilePhoto(file: File) {
  const form = new FormData()
  form.append("file", file)

  const { data } = await client.post("/profile/photo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })

  return data
}

// === Settings ===
export async function getSettings(): Promise<SystemSetting[]> {
  const { data } = await client.get("/admin/settings/")
  return data
}

export async function updateSettings(
  settings: Record<string, string>
): Promise<SystemSetting[]> {
  const { data } = await client.patch("/admin/settings/", { settings })
  return data
}