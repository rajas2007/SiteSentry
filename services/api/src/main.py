import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
            logger.error(
                "Cannot connect to %s database: %s", dialect, e
            )
            raise
        logger.warning("Database init warning (sqlite): %s", e)
    yield
    # Cleanup connection pools on shutdown
    await get_cache().close()
    await close_db()


app = FastAPI(title="Site Sentry API", version="0.1.0", lifespan=lifespan)

# Allow extension to call backend during MVP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP, later restrict to chrome-extension://
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(analytics_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
