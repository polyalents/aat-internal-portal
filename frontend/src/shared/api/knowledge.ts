import api from "@/shared/api/client"
import type {
  KnowledgeArticle,
  KnowledgeCategory,
  PaginatedResponse,
} from "@/shared/types"

export interface KnowledgeAttachment {
  id: string
  article_id: string
  filename: string
  file_path: string
  file_url: string
  file_size: number
  content_type: string
  uploaded_at: string
}

export interface KnowledgeArticleListResponse extends PaginatedResponse<KnowledgeArticle> { }

export interface KnowledgeCategoryCreate {
  name: string
  sort_order?: number
}

export interface KnowledgeCategoryUpdate {
  name?: string
  sort_order?: number
}

export interface KnowledgeArticlePayload {
  title: string
  category_id: string
  content_html: string
  content_text: string
}

export interface UploadKnowledgeImageResponse {
  url: string
  filename: string
}

export async function getKnowledgeCategories(): Promise<KnowledgeCategory[]> {
  const { data } = await api.get<KnowledgeCategory[]>("/knowledge/categories")
  return data
}

export async function createKnowledgeCategory(payload: KnowledgeCategoryCreate): Promise<KnowledgeCategory> {
  const { data } = await api.post<KnowledgeCategory>("/knowledge/categories", payload)
  return data
}

export async function updateKnowledgeCategory(
  id: string,
  payload: KnowledgeCategoryUpdate,
): Promise<KnowledgeCategory> {
  const { data } = await api.patch<KnowledgeCategory>(`/knowledge/categories/${id}`, payload)
  return data
}

export async function deleteKnowledgeCategory(id: string): Promise<void> {
  await api.delete(`/knowledge/categories/${id}`)
}

export async function getKnowledgeArticles(params?: {
  page?: number
  size?: number
  category_id?: string
  search?: string
}): Promise<KnowledgeArticleListResponse> {
  const { data } = await api.get<KnowledgeArticleListResponse>("/knowledge/articles", { params })
  return data
}

export async function getKnowledgeArticle(id: string): Promise<KnowledgeArticle> {
  const { data } = await api.get<KnowledgeArticle>(`/knowledge/articles/${id}`)
  return data
}

export async function createKnowledgeArticle(payload: KnowledgeArticlePayload): Promise<KnowledgeArticle> {
  const { data } = await api.post<KnowledgeArticle>("/knowledge/articles", payload)
  return data
}

export async function updateKnowledgeArticle(
  id: string,
  payload: Partial<KnowledgeArticlePayload>,
): Promise<KnowledgeArticle> {
  const { data } = await api.patch<KnowledgeArticle>(`/knowledge/articles/${id}`, payload)
  return data
}

export async function deleteKnowledgeArticle(id: string): Promise<void> {
  await api.delete(`/knowledge/articles/${id}`)
}

export async function uploadKnowledgeImage(
  file: File
): Promise<{ url: string; filename: string }> {
  const formData = new FormData()
  formData.append("file", file)

  const { data } = await api.post("/knowledge/articles/images", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })

  return data
}