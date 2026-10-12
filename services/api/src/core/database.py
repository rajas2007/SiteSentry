import asyncio
import logging
from collections.abc import AsyncGenerator

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.core.config import get_settings
from src.models.base import Base

logger = logging.getLogger(__name__)

_engines: dict[int, AsyncEngine] = {}
_session_factories: dict[int, async_sessionmaker[AsyncSession]] = {}


def _current_loop_id() -> int:
    try:
        return id(asyncio.get_running_loop())
    except RuntimeError:
        return 0


def get_engine() -> AsyncEngine:
    """Return an AsyncEngine scoped to the current event loop.

    Caching engines per event loop ensures that async connections and drivers
    are never reused across incompatible event loops or threads.
    """
    key = _current_loop_id()
    if key not in _engines:
        settings = get_settings()
        _engines[key] = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            future=True,
        )
    return _engines[key]


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return an async sessionmaker bound to the current loop's engine."""
    key = _current_loop_id()
    if key not in _session_factories:
        engine = get_engine()
        _session_factories[key] = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factories[key]


async def init_db() -> None:
    """Create all tables if they do not exist."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close and dispose database engines for the current event loop."""
    key = _current_loop_id()
    engine = _engines.pop(key, None)
    _session_factories.pop(key, None)
    if engine is not None:
        try:
            await engine.dispose()
        except (SQLAlchemyError, OSError) as e:
            logger.debug("Error disposing engine for loop %s: %s", key, e)


def reset_db() -> None:
    """Synchronously reset all cached engine and session factory references."""
    _engines.clear()
    _session_factories.clear()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for providing an async database session."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
