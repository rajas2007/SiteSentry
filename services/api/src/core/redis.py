import hashlib
import json
import logging
from typing import Any, cast

import redis.asyncio as aioredis
from redis.exceptions import RedisError

from src.core.config import get_settings

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

    @staticmethod
    def _hash_url(url: str) -> str:
        normalized = url.strip().lower()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def _url_key(self, url: str) -> str:
        return f"sitesentry:cache:url:{self._hash_url(url)}"

    async def get_analysis(self, url: str) -> dict[str, Any] | None:
        """Retrieve cached analysis result for a URL, returning None on miss or error."""
        try:
            client = self._get_client()
            key = self._url_key(url)
            raw = await client.get(key)
            if raw:
                return cast(dict[str, Any], json.loads(raw))
        except (RedisError, ConnectionError, OSError, json.JSONDecodeError) as e:
            logger.warning(f"Redis get_analysis failed, proceeding without cache: {e}")
        return None

    async def set_analysis(
        self,
        url: str,
        data: dict[str, Any],
        ttl: int | None = None,
    ) -> bool:
        """Cache analysis result for a URL with a TTL in seconds."""
        try:
            client = self._get_client()
            key = self._url_key(url)
            expire = ttl if ttl is not None else get_settings().REDIS_CACHE_TTL_SECONDS
            serialized = json.dumps(data)
            await client.set(key, serialized, ex=expire)
            return True
        except (RedisError, ConnectionError, OSError, TypeError) as e:
            logger.warning(f"Redis set_analysis failed: {e}")
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
            logger.warning(f"Redis get_osint failed, proceeding without cache: {e}")
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
            logger.warning(f"Redis set_osint failed: {e}")
        return False

    async def close(self) -> None:
        """Close the Redis client connection pool."""
        if self._client is not None:
            try:
                await self._client.aclose()
            except (RedisError, ConnectionError, OSError) as e:
                logger.warning(f"Error closing Redis client: {e}")
            finally:
                self._client = None


_cache_instance: RedisCache | None = None


def get_cache() -> RedisCache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RedisCache()
    return _cache_instance
