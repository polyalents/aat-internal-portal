import json
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for the general chat room."""

    def __init__(self) -> None:
        self.active_connections: dict[UUID, WebSocket] = {}

    async def connect(self, user_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: UUID) -> None:
        self.active_connections.pop(user_id, None)

    async def broadcast(self, message: dict) -> None:
        dead: list[UUID] = []
        data = json.dumps(message, default=str)

        for user_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(data)
            except Exception:
                dead.append(user_id)

        for user_id in dead:
            self.active_connections.pop(user_id, None)

    async def send_personal(self, user_id: UUID, message: dict) -> None:
        websocket = self.active_connections.get(user_id)
        if websocket is not None:
            try:
                await websocket.send_text(json.dumps(message, default=str))
            except Exception:
                self.active_connections.pop(user_id, None)


manager = ConnectionManager()