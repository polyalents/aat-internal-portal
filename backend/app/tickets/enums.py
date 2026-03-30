import enum


class TicketStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    waiting = "waiting"
    completed = "completed"
    rejected = "rejected"
    escalated = "escalated"


class TicketPriority(str, enum.Enum):
    now = "now"
    today = "today"
    normal = "normal"


ALLOWED_TRANSITIONS: dict[TicketStatus, list[TicketStatus]] = {
    TicketStatus.new: [
        TicketStatus.in_progress,
        TicketStatus.waiting,
        TicketStatus.escalated,
        TicketStatus.completed,
        TicketStatus.rejected,
    ],
    TicketStatus.in_progress: [
        TicketStatus.waiting,
        TicketStatus.escalated,
        TicketStatus.completed,
        TicketStatus.rejected,
    ],
    TicketStatus.waiting: [
        TicketStatus.in_progress,
        TicketStatus.escalated,
        TicketStatus.completed,
        TicketStatus.rejected,
    ],
    TicketStatus.escalated: [
        TicketStatus.in_progress,
        TicketStatus.waiting,
        TicketStatus.completed,
        TicketStatus.rejected,
    ],
    TicketStatus.completed: [],
    TicketStatus.rejected: [],
}