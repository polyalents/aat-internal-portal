import enum


class TicketStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    waiting = "waiting"
    completed = "completed"
    rejected = "rejected"
    escalated = "escalated"


class TicketPriority(str, enum.Enum):
    now = "now"           # Сейчас
    today = "today"       # Сегодня
    normal = "normal"     # В рабочем порядке


# Допустимые переходы статусов
ALLOWED_TRANSITIONS: dict[TicketStatus, list[TicketStatus]] = {
    TicketStatus.new: [TicketStatus.in_progress, TicketStatus.escalated],
    TicketStatus.escalated: [TicketStatus.in_progress],
    TicketStatus.in_progress: [TicketStatus.waiting, TicketStatus.completed, TicketStatus.rejected],
    TicketStatus.waiting: [TicketStatus.in_progress],
    TicketStatus.completed: [],
    TicketStatus.rejected: [],
}