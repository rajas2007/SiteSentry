import asyncio
import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest

# Configure an isolated SQLite test database for the test suite,
# ensuring tests do not touch or depend on the developer's local PostgreSQL database.
# Production configuration is preserved because production loads services/api/.env at runtime.
_TEST_DB_FILE = Path(tempfile.gettempdir()) / "sitesentry_test.db"
_DEFAULT_TEST_DB_URL = f"sqlite+aiosqlite:///{_TEST_DB_FILE}"

if not os.environ.get("DATABASE_URL") or "postgresql" in os.environ.get("DATABASE_URL", ""):
    os.environ["DATABASE_URL"] = _DEFAULT_TEST_DB_URL

from src.core.config import get_settings

get_settings.cache_clear()

from src.core.database import init_db, reset_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> Generator[None, None, None]:
    """Session-wide fixture ensuring a fresh SQLite test database."""
    if _TEST_DB_FILE.exists():
        try:
            _TEST_DB_FILE.unlink()
        except OSError:
            pass

    reset_db()
    asyncio.run(init_db())
    reset_db()

    yield

    reset_db()
    if _TEST_DB_FILE.exists():
        try:
            _TEST_DB_FILE.unlink()
        except OSError:
            pass
