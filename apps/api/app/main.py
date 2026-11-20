from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models.user  # noqa: F401 - register models with Base metadata
from app.api.routes_admin_reports import router as admin_reports_router
from app.api.routes_auth import router as auth_router
from app.api.routes_rooms import router as rooms_router
from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.db.session import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev/test convenience: create tables if they do not exist.
    # (Alembic remains available for managed migrations in later phases.)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await rate_limiter.init()
    try:
        yield
    finally:
        await rate_limiter.close()
        await engine.dispose()


app = FastAPI(title=settings.app_name, version="0.3.0-phase2", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_reports_router)
app.include_router(rooms_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "phase": "4"}
