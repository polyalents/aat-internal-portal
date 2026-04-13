from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AAT Internal Portal"
    app_env: str = "development"
    debug: bool = True

    domain: str = "portal.aat.local"
    api_url: str = "https://portal.aat.local/api"
    frontend_url: str = "https://portal.aat.local"

    database_url: str = "postgresql+asyncpg://aat_user:change_me@127.0.0.1:5432/aat_portal"
    redis_url: str = "redis://127.0.0.1:6379/0"

    secret_key: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    max_upload_size_mb: int = 10
    upload_dir: str = "./uploads"

    escalation_timeout_minutes: int = 5

    admin_username: str = "admin"
    admin_password: str = "admin"
    admin_email: str = "admin@test.com"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://portal.aat.local"
    cors_allow_methods: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    cors_allow_headers: str = "Authorization,Content-Type,Accept,Origin"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def cors_allow_methods_list(self) -> list[str]:
        return [method.strip().upper() for method in self.cors_allow_methods.split(",") if method.strip()]

    @property
    def cors_allow_headers_list(self) -> list[str]:
        return [header.strip() for header in self.cors_allow_headers.split(",") if header.strip()]


settings = Settings()