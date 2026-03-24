from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError


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

        return JSONResponse(status_code=409, content={"detail": detail})

    @app.exception_handler(ValueError)
    async def value_error_handler(
        request: Request,
        exc: ValueError,
    ) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})