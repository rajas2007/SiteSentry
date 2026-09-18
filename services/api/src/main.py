import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from src.api.analyze import router as analyze_router
from src.core.database import init_db
from src.core.redis import get_cache

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Initialize database tables on startup
    try:
        await init_db()
    except (SQLAlchemyError, OSError) as e:
        logger.warning(f"Database init warning: {e}")
    yield
    # Cleanup Redis connection pool on shutdown
    await get_cache().close()


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


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
