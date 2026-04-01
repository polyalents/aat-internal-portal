import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(
        request: Request,
        exc: IntegrityError,
    ) -> JSONResponse:
        detail = "Database integrity error"

        error_text = str(exc.orig).lower() if exc.orig else str(exc).lower()

        if "unique" in error_text or "duplicate" in error_text:
            detail = "A record with this value already exists"
        elif "foreign key" in error_text:
            detail = "Related record not found or invalid reference"
        elif "not null" in error_text:
            detail = "A required field is missing"

        logger.exception("IntegrityError on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=409, content={"detail": detail})

    @app.exception_handler(ValueError)
    async def value_error_handler(
        request: Request,
        exc: ValueError,
    ) -> JSONResponse:
        logger.error(
            "Unhandled ValueError on %s %s: %s\n%s",
            request.method,
            request.url.path,
            str(exc),
            traceback.format_exc(),
        )
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(exc)}"},
        )