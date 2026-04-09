import client from "@/shared/api/client"
import type {
  Ticket,
  TicketCreate,
  TicketComment,
  TicketHistory,
  TicketCategory,
  TicketStats,
  TicketAssigneeOption,
  PaginatedResponse,
} from "@/shared/types"

export async function getTickets(params?: {
  page?: number
  size?: number
  status?: string
  priority?: string
  search?: string
  archived?: boolean
}): Promise<PaginatedResponse<Ticket>> {
  const { data } = await client.get("/tickets", { params })
  return data
}

export async function getTicket(id: string): Promise<Ticket> {
  const { data } = await client.get(`/tickets/${id}`)
  return data
}

export async function createTicket(payload: TicketCreate): Promise<Ticket> {
  const { data } = await client.post("/tickets", payload)
  return data
}

export async function updateTicket(
  id: string,
  payload: {
    status?: string
    assignee_id?: string | null
    priority?: string
  }
): Promise<Ticket> {
  const { data } = await client.patch(`/tickets/${id}`, payload)
  return data
}

export async function archiveTicket(id: string): Promise<Ticket> {
  const { data } = await client.post(`/tickets/${id}/archive`)
  return data
}

export async function restoreTicket(id: string): Promise<Ticket> {
  const { data } = await client.post(`/tickets/${id}/restore`)
  return data
}

export async function deleteTicketPermanently(id: string): Promise<void> {
  await client.delete(`/tickets/${id}`)
}

export async function cleanupOldTickets(): Promise<{ deleted: number }> {
  const { data } = await client.post("/tickets/cleanup-old")
  return data
}

export async function getTicketComments(id: string): Promise<TicketComment[]> {
  const { data } = await client.get(`/tickets/${id}/comments`)
  return data
}

export async function addTicketComment(id: string, text: string): Promise<TicketComment> {
  const { data } = await client.post(`/tickets/${id}/comments`, { text })
  return data
}

export async function getTicketHistory(id: string): Promise<TicketHistory[]> {
  const { data } = await client.get(`/tickets/${id}/history`)
  return data
}

export async function getTicketStats(): Promise<TicketStats> {
  const { data } = await client.get("/tickets/stats")
  return data
}

export async function getTicketCategories(): Promise<TicketCategory[]> {
  const { data } = await client.get("/tickets/categories")
  return data
}

export async function getTicketAssignees(): Promise<TicketAssigneeOption[]> {
  const { data } = await client.get("/tickets/assignees")
  return data
}

export async function uploadAttachment(ticketId: string, file: File) {
  const form = new FormData()
  form.append("file", file)

  const { data } = await client.post(`/tickets/${ticketId}/attachments`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })

  return data
}