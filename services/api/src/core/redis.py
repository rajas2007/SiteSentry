import json
import logging
from typing import Any, cast

import redis.asyncio as aioredis
from redis.exceptions import RedisError

from src.core.config import get_settings
from src.utils.hashing import compute_analysis_cache_key

logger = logging.getLogger(__name__)


class RedisCache:
    def __init__(self, url: str | None = None) -> None:
        self.url = url or get_settings().REDIS_URL
        self._client: aioredis.Redis | None = None

    def _get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(
                self.url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
            )
        return self._client

    def _resolve_analysis_key(self, request_or_key: Any) -> str | None:
        """Resolve a cache key from either an explicit key string or a PageAnalysisRequest.

        Returns None if cache bypass is required or a valid key cannot be derived.
        """
        if isinstance(request_or_key, str):
            # Explicit key already resolved or mock test key
            return request_or_key

        # PageAnalysisRequest or object with url / features
        settings = get_settings()
        return compute_analysis_cache_key(
            request=request_or_key,
            secret_key=settings.SECRET_KEY,
        )

    async def get_analysis(self, request_or_key: Any) -> dict[str, Any] | None:
        """Retrieve cached analysis result for a request or key, returning None on miss, bypass, or error."""
        try:
            key = self._resolve_analysis_key(request_or_key)
            if not key:
                return None

            client = self._get_client()
            raw = await client.get(key)
            if raw:
                return cast(dict[str, Any], json.loads(raw))
        except (RedisError, ConnectionError, OSError, json.JSONDecodeError) as e:
            logger.warning(
                "Redis get_analysis failed, proceeding without cache: %s",
                type(e).__name__,
            )
        return None

    async def set_analysis(
        self,
        request_or_key: Any,
        data: dict[str, Any],
        ttl: int | None = None,
    ) -> bool:
        """Cache analysis result for a request or key with a TTL in seconds."""
        try:
            key = self._resolve_analysis_key(request_or_key)
            if not key:
                return False

            client = self._get_client()
            expire = ttl if ttl is not None else get_settings().REDIS_CACHE_TTL_SECONDS
            serialized = json.dumps(data)
            await client.set(key, serialized, ex=expire)
            return True
        except (RedisError, ConnectionError, OSError, TypeError) as e:
            logger.warning("Redis set_analysis failed: %s", type(e).__name__)
        return False

    def _osint_key(self, domain: str) -> str:
        return f"sitesentry:cache:osint:{domain.strip().lower()}"

    async def get_osint(self, domain: str) -> dict[str, Any] | None:
        """Retrieve cached OSINT threat intelligence for a domain."""
        try:
            client = self._get_client()
            key = self._osint_key(domain)
            raw = await client.get(key)
            if raw:
                return cast(dict[str, Any], json.loads(raw))
        except (RedisError, ConnectionError, OSError, json.JSONDecodeError) as e:
            logger.warning(
                "Redis get_osint failed, proceeding without cache: %s", type(e).__name__
            )
        return None

    async def set_osint(
        self,
        domain: str,
        data: dict[str, Any],
        ttl: int = 86400,
    ) -> bool:
        """Cache OSINT threat intelligence for a domain (default TTL: 24h)."""
        try:
            client = self._get_client()
            key = self._osint_key(domain)
            serialized = json.dumps(data)
            await client.set(key, serialized, ex=ttl)
            return True
        except (RedisError, ConnectionError, OSError, TypeError) as e:
            logger.warning("Redis set_osint failed: %s", type(e).__name__)
        return False

    async def close(self) -> None:
        """Close the Redis client connection pool."""
        if self._client is not None:
            try:
                await self._client.aclose()
            except (RedisError, ConnectionError, OSError) as e:
                logger.warning("Error closing Redis client: %s", type(e).__name__)
            finally:
                self._client = None


_cache_instance: RedisCache | None = None


def get_cache() -> RedisCache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RedisCache()
    return _cache_instance
