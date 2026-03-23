from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, server_default="")

    def __repr__(self) -> str:
        return f"<SystemSettings {self.key}>"