from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    debug: bool = True

    domain: str = "portal.aat.local"
    api_url: str = "https://portal.aat.local/api"
    frontend_url: str = "https://portal.aat.local"

    database_url: str = "postgresql+asyncpg://portal:portal_dev_password@localhost:5432/portal_db"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "CHANGE_ME"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    jwt_algorithm: str = "HS256"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    max_upload_size_mb: int = 10
    upload_dir: str = "/app/uploads"

    escalation_timeout_minutes: int = 5

    cors_origins: str = "https://portal.aat.local"

    admin_username: str = "admin"
    admin_password: str = "admin"
    admin_email: str = "admin@aat.local"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()