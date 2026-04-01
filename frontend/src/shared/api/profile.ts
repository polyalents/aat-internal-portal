import client from "@/shared/api/client"
import type { Employee } from "@/shared/types"

export type UpdateProfilePayload = {
  mobile_phone?: string | null
  internal_phone?: string | null
  room_number?: string | null
  birth_date?: string | null
  vacation_start?: string | null
  vacation_end?: string | null
}

export async function getProfile(): Promise<Employee> {
  const { data } = await client.get<Employee>("/profile")
  return data
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<Employee> {
  const { data } = await client.patch<Employee>("/profile", payload)
  return data
}

export async function uploadProfilePhoto(file: File): Promise<Employee> {
  const { data } = await client.postForm<Employee>("/profile/photo", {
    file,
  })

  return data
}