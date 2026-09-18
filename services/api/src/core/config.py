from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    API_ENV: str = "development"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # PostgreSQL / SQLite async connection string
    DATABASE_URL: str = "sqlite+aiosqlite:///./sitesentry.db"

    # Redis connection string & cache TTL
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL_SECONDS: int = 3600

    SECRET_KEY: str = "default_development_secret"


@lru_cache
def get_settings() -> Settings:
    return Settings()
