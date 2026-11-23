from pydantic_settings import BaseSettings, SettingsConfigDict


def async_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url.replace("sslmode=require", "ssl=require")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "BOJU BOJU Arena API"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_base_url: str = "http://localhost:8000"
    web_base_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173"

    database_url: str = "sqlite+aiosqlite:///./boju_dev.db"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-dev-secret-key-at-least-32-chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    refresh_cookie_name: str = "bb_refresh"
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: str = "lax"
    email_verification_expire_hours: int = 24
    password_reset_expire_minutes: int = 30
    ws_ticket_expire_seconds: int = 60

    email_provider: str = "console"
    email_from: str = "no-reply@boju-boju.local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

