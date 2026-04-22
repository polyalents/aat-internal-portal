import client from "@/shared/api/client"
import type {
  Chat,
  ChatAttachment,
  ChatMessage,
  Employee,
  PaginatedResponse,
} from "@/shared/types"

const EMPLOYEE_PAGE_SIZE = 100

export async function getChats(): Promise<Chat[]> {
  const { data } = await client.get("/chat/chats")
  return data.items
}

export async function getOrCreateDirectChat(userId: string): Promise<Chat> {
  const { data } = await client.post("/chat/chats/direct", { user_id: userId })
  return data
}

export async function pinChat(chatId: string): Promise<Chat> {
  const { data } = await client.post(`/chat/chats/${chatId}/pin`)
  return data
}

export async function unpinChat(chatId: string): Promise<Chat> {
  const { data } = await client.post(`/chat/chats/${chatId}/unpin`)
  return data
}

export async function markChatAsRead(chatId: string): Promise<void> {
  await client.post(`/chat/chats/${chatId}/read`)
}

export async function searchChatEmployees(search: string): Promise<Employee[]> {
  const normalized = search.trim()
  let page = 1
  let total = 0
  const all: Employee[] = []

  do {
    const { data } = await client.get("/employees/", {
      params: {
        page,
        size: EMPLOYEE_PAGE_SIZE,
        search: normalized || undefined,
        is_active: true,
      },
    })

    all.push(...(data.items ?? []))
    total = data.total ?? all.length
    page += 1
  } while (all.length < total)

  return all
}

export async function fetchChatAttachmentBlob(
  attachmentId: string
): Promise<{ blob: Blob; contentType: string }> {
  const response = await client.get(`/chat/attachments/${attachmentId}/file`, {
    responseType: "blob",
  })

  const headerType = response.headers["content-type"]
  const normalizedType = typeof headerType === "string" ? headerType : "application/octet-stream"
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: normalizedType })

  return { blob, contentType: blob.type || normalizedType }
}

export async function downloadChatAttachment(attachment: ChatAttachment): Promise<void> {
  const { blob } = await fetchChatAttachmentBlob(attachment.id)
  const objectUrl = URL.createObjectURL(blob)

  try {
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = attachment.filename
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function getChatMessages(
  chatId: string,
  params?: {
    page?: number
    size?: number
  }
): Promise<PaginatedResponse<ChatMessage>> {
  const { data } = await client.get(`/chat/chats/${chatId}/messages`, { params })
  return data
}

export async function createChatMessage(payload: {
  chatId: string
  text?: string
  files?: File[]
}): Promise<ChatMessage> {
  const form = new FormData()

  if (payload.text) {
    form.append("text", payload.text)
  }

  for (const file of payload.files ?? []) {
    form.append("files", file)
  }

  const { data } = await client.post(`/chat/chats/${payload.chatId}/messages`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

export async function deleteChatMessage(chatId: string, messageId: string): Promise<ChatMessage> {
  const { data } = await client.delete(`/chat/chats/${chatId}/messages/${messageId}`)
  return data
}

export async function pinChatMessage(chatId: string, messageId: string): Promise<ChatMessage> {
  const { data } = await client.post(`/chat/chats/${chatId}/messages/${messageId}/pin`)
  return data
}

export async function unpinChatMessage(chatId: string, messageId: string): Promise<ChatMessage> {
  const { data } = await client.post(`/chat/chats/${chatId}/messages/${messageId}/unpin`)
  return data
}