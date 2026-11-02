from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to the services/api directory so it loads
# regardless of the working directory used to start the process.
_CONFIG_DIR = Path(__file__).resolve().parent  # src/core/
_API_DIR = _CONFIG_DIR.parent.parent  # services/api/
_ENV_FILE = _API_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    API_ENV: str = "development"
    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8000

    # PostgreSQL / SQLite async connection string
    DATABASE_URL: str = "sqlite+aiosqlite:///./sitesentry.db"

    # Redis connection string & cache TTL
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL_SECONDS: int = 3600

    SECRET_KEY: str = "default_development_secret"

    # Threat Intelligence API Keys & timeouts
    GOOGLE_SAFE_BROWSING_API_KEY: str | None = None
    VIRUSTOTAL_API_KEY: str | None = None
    THREAT_INTEL_TIMEOUT_SECONDS: float = 2.5

    # CORS origins (comma-separated, e.g. "https://dashboard.example.com,chrome-extension://<id>")
    CORS_ORIGINS: str = "*"

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.API_ENV.lower() == "production" and (
            not self.SECRET_KEY
            or not self.SECRET_KEY.strip()
            or self.SECRET_KEY == "default_development_secret"
            or len(self.SECRET_KEY.strip()) < 32
        ):
            raise ValueError(
                "In production (API_ENV=production), SECRET_KEY must be a strong, "
                "non-default secret of at least 32 characters."
            )
        return self

    @property
    def database_dialect(self) -> str:
        """Return the database dialect (e.g. 'postgresql' or 'sqlite')
        without exposing any credentials."""
        return self.DATABASE_URL.split(":", 1)[0].split("+")[0]


@lru_cache
def get_settings() -> Settings:
    return Settings()
