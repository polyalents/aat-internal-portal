import client, { setTokens, clearTokens } from "@/shared/api/client"
import type { LoginRequest, TokenResponse, User } from "@/shared/types"

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const { data: res } = await client.post<TokenResponse>("/auth/login", data)

  setTokens(res.access_token, res.refresh_token)

  return res
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<User>("/auth/me")
  return data
}

export function logout(): void {
  clearTokens()
  window.location.href = "/login"
}