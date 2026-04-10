import client from "@/shared/api/client"
import type { ChatMessage, PaginatedResponse } from "@/shared/types"

export async function getChatMessages(params?: {
  page?: number
  size?: number
}): Promise<PaginatedResponse<ChatMessage>> {
  const { data } = await client.get("/chat/", { params })
  return data
}

export async function createChatMessage(text: string): Promise<ChatMessage> {
  const { data } = await client.post("/chat/", { text })
  return data
}

export async function deleteChatMessage(messageId: string): Promise<ChatMessage> {
  const { data } = await client.delete(`/chat/${messageId}`)
  return data
}

export async function pinChatMessage(messageId: string): Promise<ChatMessage> {
  const { data } = await client.post(`/chat/${messageId}/pin`)
  return data
}

export async function unpinChatMessage(messageId: string): Promise<ChatMessage> {
  const { data } = await client.post(`/chat/${messageId}/unpin`)
  return data
}