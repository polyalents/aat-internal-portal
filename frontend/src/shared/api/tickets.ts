import client from "@/shared/api/client"
import type {
  PaginatedResponse,
  Ticket,
  TicketCategory,
  TicketCreate,
} from "@/shared/types"

export async function getTickets(params?: {
  page?: number
  size?: number
  status?: string
  search?: string
}): Promise<PaginatedResponse<Ticket>> {
  const { data } = await client.get("/tickets/", { params })
  return data
}

export async function getTicket(id: string): Promise<Ticket> {
  const { data } = await client.get(`/tickets/${id}/`)
  return data
}

export async function createTicket(payload: TicketCreate): Promise<Ticket> {
  const { data } = await client.post("/tickets/", payload)
  return data
}

export async function getCategories(): Promise<TicketCategory[]> {
  const { data } = await client.get("/tickets/categories")
  return data
}