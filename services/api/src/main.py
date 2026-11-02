import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from src.api.analytics import router as analytics_router
from src.api.analyze import router as analyze_router
from src.core.config import get_settings
from src.core.database import close_db, init_db
from src.core.redis import get_cache

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    dialect = settings.database_dialect

    logger.info("Database backend: %s", dialect)

    # Initialize database tables on startup
    try:
        await init_db()
        logger.info("Database initialised successfully (%s)", dialect)
    except (SQLAlchemyError, OSError) as e:
        if dialect != "sqlite":
            # An explicitly configured database (e.g. PostgreSQL) must
            # connect successfully.  Do not silently fall back to SQLite.
            logger.error("Cannot connect to %s database: %s", dialect, e)
            raise
        logger.warning("Database init warning (sqlite): %s", e)
    yield
    # Cleanup connection pools on shutdown
    await get_cache().close()
    await close_db()


app = FastAPI(title="Site Sentry API", version="0.1.0", lifespan=lifespan)

settings = get_settings()
cors_origins = [
    origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()
]
# Starlette requires allow_credentials=False when allow_origins=["*"]
allow_credentials = cors_origins != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Sanitize validation errors to prevent reflection of raw URL secrets in HTTP 422 responses."""
    sanitized_errors = []
    for err in exc.errors():
        clean_err = dict(err)
        clean_err.pop("input", None)
        clean_err.pop("ctx", None)

        sanitized_errors.append(clean_err)
    return JSONResponse(status_code=422, content={"detail": sanitized_errors})


app.include_router(analyze_router)
app.include_router(analytics_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
