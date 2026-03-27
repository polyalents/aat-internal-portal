import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import dayjs from "dayjs"
import "dayjs/locale/ru"
import type { TicketStatus, TicketPriority } from "@/shared/types"

dayjs.locale("ru")

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—"
  return dayjs(date).format("DD.MM.YYYY")
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—"
  return dayjs(date).format("DD.MM.YYYY HH:mm")
}

export function formatRelative(date: string): string {
  const d = dayjs(date)
  const now = dayjs()

  const diffMin = now.diff(d, "minute")
  if (diffMin < 1) return "только что"
  if (diffMin < 60) return `${diffMin} мин. назад`

  const diffHours = now.diff(d, "hour")
  if (diffHours < 24) return `${diffHours} ч. назад`

  return d.format("DD.MM.YYYY HH:mm")
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  waiting: "Ожидает",
  completed: "Завершена",
  rejected: "Отклонена",
  escalated: "Эскалировано",
}

export const STATUS_COLORS: Record<TicketStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  waiting: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  escalated: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  now: "Сейчас",
  today: "Сегодня",
  normal: "В рабочем порядке",
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  now: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  today: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  normal: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
}

export const ROLE_LABELS: Record<string, string> = {
  employee: "Сотрудник",
  it_specialist: "IT-специалист",
  admin: "Администратор",
}