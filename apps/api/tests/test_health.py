import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from fastapi.testclient import TestClient

from app.core.config import async_database_url
from app.main import app


def test_async_database_url_normalizes_render_connection_strings():
    assert (
        async_database_url("postgres://user:pass@host:5432/db")
        == "postgresql+asyncpg://user:pass@host:5432/db"
    )
    assert (
        async_database_url("postgresql://user:pass@host:5432/db")
        == "postgresql+asyncpg://user:pass@host:5432/db"
    )
    assert (
        async_database_url("postgresql+asyncpg://user:pass@host:5432/db")
        == "postgresql+asyncpg://user:pass@host:5432/db"
    )
    assert (
        async_database_url("postgresql://user:pass@host/db?sslmode=require")
        == "postgresql+asyncpg://user:pass@host/db?ssl=require"
    )


def test_health_ok():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data.get("phase") == "4"
