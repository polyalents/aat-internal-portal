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
  new: "border border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-100",
  in_progress: "border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100",
  waiting: "border border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-900 dark:text-orange-100",
  completed: "border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100",
  rejected: "border border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-900 dark:text-rose-100",
  escalated: "border border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900 dark:text-violet-100",
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  now: "Сейчас",
  today: "Сегодня",
  normal: "В рабочем порядке",
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  now: "border border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-900 dark:text-rose-100",
  today: "border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100",
  normal: "border border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
}

export const ROLE_LABELS: Record<string, string> = {
  employee: "Сотрудник",
  it_specialist: "IT-специалист",
  admin: "Администратор",
}