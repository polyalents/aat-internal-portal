export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export type UserRole = "employee" | "it_specialist" | "admin"

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  is_it_manager: boolean
  is_active: boolean
  employee_id?: string | null
  created_at: string
  updated_at: string
}

export interface UserCreate {
  username: string
  email: string
  password: string
  role: UserRole
  is_it_manager: boolean
}

export interface UserUpdate {
  email?: string
  role?: UserRole
  is_it_manager?: boolean
  is_active?: boolean
  password?: string
}

export interface UserPasswordChange {
  password: string
}

export interface Department {
  id: string
  name: string
  head_id: string | null
  parent_id: string | null
  created_at: string
}

export interface Employee {
  id: string
  user_id: string | null
  first_name: string
  last_name: string
  middle_name: string | null
  full_name: string
  position: string
  department_id: string | null
  department_name: string | null
  room_number: string | null
  internal_phone: string | null
  mobile_phone: string | null
  email: string
  birth_date: string | null
  photo_url: string | null
  manager_id: string | null
  manager_name: string | null
  vacation_start: string | null
  vacation_end: string | null
  is_on_vacation: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrgTreeEmployeeNode {
  id: string
  full_name: string
  position: string
  photo_url: string | null
  is_on_vacation: boolean
  children: OrgTreeEmployeeNode[]
}

export interface OrgTreeDepartmentNode {
  id: string | null
  name: string
  head_id: string | null
  head_name: string | null
  employees_count: number
  employees: OrgTreeEmployeeNode[]
}

export interface BirthdayEntry {
  id: string
  full_name: string
  position: string
  department_name: string | null
  birth_date: string
  photo_url: string | null
}

export type TicketStatus =
  | "new"
  | "in_progress"
  | "waiting"
  | "completed"
  | "rejected"
  | "escalated"

export type TicketPriority = "now" | "today" | "normal"

export interface TicketCategory {
  id: string
  name: string
  is_active: boolean
}

export interface TicketAttachment {
  id: string
  ticket_id: string
  filename: string
  file_path: string
  file_size: number
  content_type: string
  uploaded_at: string
}

export interface Ticket {
  id: string
  number: number
  subject: string
  description: string
  category_id: string
  category_name: string | null
  priority: TicketPriority
  status: TicketStatus
  author_id: string
  author_name: string | null
  assignee_id: string | null
  assignee_name: string | null
  contact_phone: string | null
  internal_phone: string | null
  room_number: string | null
  contact_email: string | null
  attachments: TicketAttachment[]
  created_at: string
  updated_at: string
  escalated_at: string | null
  completed_at: string | null
  is_archived: boolean
  archived_at: string | null
}

export interface TicketCreate {
  subject: string
  description: string
  category_id: string
  priority: TicketPriority
  contact_phone?: string
  internal_phone?: string
  room_number?: string
  contact_email?: string
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  author_name: string | null
  text: string
  created_at: string
}

export interface TicketHistory {
  id: string
  ticket_id: string
  changed_by: string
  changed_by_name: string | null
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface TicketStats {
  total: number
  new: number
  in_progress: number
  waiting: number
  escalated: number
  completed: number
  rejected: number
}

export interface TicketAssigneeOption {
  user_id: string
  username: string
  full_name: string | null
  is_it_manager: boolean
  is_on_vacation: boolean
  is_available: boolean
}

export interface Announcement {
  id: string
  title: string
  content: string
  author_id: string
  author_name: string | null
  published_at: string
  expires_at: string | null
  is_active: boolean
}

export interface KnowledgeCategory {
  id: string
  name: string
  sort_order: number
  is_user_visible: boolean
}

export interface KnowledgeAttachment {
  id: string
  article_id: string
  filename: string
  file_path?: string
  file_url?: string
  file_size: number
  content_type: string
  uploaded_at: string
}

export interface KnowledgeArticle {
  id: string
  title: string
  content_html: string
  content_text: string
  category_id: string
  category_name: string | null
  author_id: string
  author_name: string | null
  created_at: string
  updated_at: string
  attachments?: KnowledgeAttachment[]
}

export interface KnowledgeArticleCreate {
  title: string
  category_id: string
  content_html: string
  content_text: string
}

export interface KnowledgeArticleUpdate {
  title?: string
  category_id?: string
  content_html?: string
  content_text?: string
}

export type ChatType = "global" | "direct" | "department"
export type ChatAttachmentType = "image" | "document"

export interface ChatParticipant {
  user_id: string
  name: string | null
  email: string | null
}

export interface Chat {
  id: string
  type: ChatType
  title: string
  participants: ChatParticipant[]
  unread_count: number
  last_message_preview?: string | null
  last_message_at?: string | null
  is_pinned: boolean
  is_fixed: boolean
  created_at: string
  updated_at: string
}

export interface ChatAttachment {
  id: string
  filename: string
  file_path: string
  file_url: string
  file_size: number
  content_type: string
  attachment_type: ChatAttachmentType
  uploaded_at: string
}

export interface ChatMessageStatus {
  id?: string
  user_id: string
  delivered_at: string | null
  read_at: string | null
  email_notified_at?: string | null
}

export interface ChatMessage {
  id: string
  chat_id: string
  author_id: string
  author_name: string | null
  text: string
  is_pinned: boolean
  created_at: string
  is_deleted: boolean
  attachments: ChatAttachment[]
  statuses: ChatMessageStatus[]
}

export interface Dashboard {
  ticket_stats: TicketStats
  recent_tickets: Ticket[]
  birthdays_today: BirthdayEntry[]
  birthdays_week: BirthdayEntry[]
  recent_announcements: Announcement[]
  unassigned_tickets: Ticket[]
  urgent_tickets: Ticket[]
  assigned_tickets: Ticket[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface SystemSetting {
  key: string
  value: string
}