from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AAT Portal API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
        debug=settings.debug,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.announcements.router import router as announcements_router
    from app.auth.router import router as auth_router
    from app.chat.router import router as chat_router
    from app.departments.router import router as departments_router
    from app.employees.router import router as employees_router
    from app.knowledge.router import router as knowledge_router
    from app.tickets.router import router as tickets_router
    from app.users.profile_router import router as profile_router
    from app.users.router import router as users_router

    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    app.include_router(users_router, prefix="/api/users", tags=["users"])
    app.include_router(profile_router, prefix="/api/profile", tags=["profile"])
    app.include_router(departments_router, prefix="/api/departments", tags=["departments"])
    app.include_router(employees_router, prefix="/api/employees", tags=["employees"])
    app.include_router(tickets_router, prefix="/api/tickets", tags=["tickets"])
    app.include_router(announcements_router, prefix="/api/announcements", tags=["announcements"])
    app.include_router(knowledge_router, prefix="/api/knowledge", tags=["knowledge"])
    app.include_router(chat_router, prefix="/api/chat", tags=["chat"])

    @app.get("/api/health")
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()