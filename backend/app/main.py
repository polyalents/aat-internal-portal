from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.exceptions import register_exception_handlers
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    print("\n=== REGISTERED ROUTES ===")
    for route in app.routes:
        if isinstance(route, APIRoute):
            methods = ",".join(sorted(route.methods))
            print(f"{methods:20} {route.path}")
    print("=========================\n")

    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AAT Portal API",
        version="0.1.0",
        docs_url="/api/docs" if settings.debug else None,
        openapi_url="/api/openapi.json" if settings.debug else None,
        lifespan=lifespan,
        redirect_slashes=False,
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=settings.cors_allow_methods_list,
        allow_headers=settings.cors_allow_headers_list,
    )

    register_exception_handlers(app)

    uploads_dir = Path(settings.upload_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

    from app.admin.router import router as admin_router
    from app.announcements.router import router as announcements_router
    from app.auth.router import router as auth_router
    from app.chat.router import router as chat_router
    from app.dashboard.router import router as dashboard_router
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
    app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
    app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])

    @app.get("/api/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()