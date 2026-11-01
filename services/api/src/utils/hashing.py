"""URL Hashing and Cache Key Generation Utilities for Site Sentry.

Provides deterministic SHA-256 hashing based on canonical sanitized URLs,
ensuring cache privacy, mitigating cache poisoning, and standardizing cache keys.
"""

from __future__ import annotations

import hashlib
from typing import Final

from src.utils.normalization import normalize_host
from src.utils.url import DEFAULT_SENSITIVE_PARAMS, sanitize_url

DEFAULT_CACHE_KEY_PREFIX: Final[str] = "sitesentry:cache:url:v2"
DEFAULT_DOMAIN_CACHE_KEY_PREFIX: Final[str] = "sitesentry:cache:osint"


def hash_url(
    url: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
) -> str:
    """Compute a deterministic SHA-256 digest of the canonical sanitized URL.

    Guarantees:
    - Differing sensitive parameter values produce identical digests.
    - Differing benign parameter values produce distinct digests.
    - Idempotent and deterministic across all executions.

    Args:
        url: The URL to hash (will be sanitized prior to hashing).
        sensitive_params: Optional custom set of sensitive parameters.

    Returns:
        A 64-character lowercase hexadecimal SHA-256 string.

    Raises:
        InvalidURLError: If the URL is malformed or invalid HTTP/HTTPS.
    """
    sanitized = sanitize_url(url, sensitive_params=sensitive_params)
    return hashlib.sha256(sanitized.encode("utf-8")).hexdigest()


def url_cache_key(
    url: str,
    prefix: str = DEFAULT_CACHE_KEY_PREFIX,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
) -> str:
    """Generate a versioned Redis cache key from a sanitized URL.

    Format:
        '{prefix}:{sha256(sanitized_url)}'

    SECURITY RATIONALE:
    Full URLs represent sensitive user navigation history. Caching under the SHA-256
    hash ensures private paths and parameters are never visible in plaintext Redis keys.

    Args:
        url: The target URL.
        prefix: Key namespace prefix (defaults to 'sitesentry:cache:url:v2').
        sensitive_params: Optional custom set of sensitive parameters.

    Returns:
        The fully formatted Redis key string containing the SHA-256 digest.
    """
    digest = hash_url(url, sensitive_params=sensitive_params)
    return f"{prefix}:{digest}"


def hash_domain(domain: str) -> str:
    """Compute a deterministic SHA-256 digest of a normalized domain name.

    Used when a cryptographic hash or fixed-length blinded identifier of a domain
    is required (e.g., for GroupKFold ML dataset partitioning, blinded telemetry,
    or anonymized cross-system aggregation).

    Args:
        domain: Hostname or domain name to hash.

    Returns:
        A 64-character lowercase hexadecimal SHA-256 string.

    Raises:
        NormalizationError: If the domain is malformed or invalid.
    """
    normalized = normalize_host(domain)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def domain_cache_key(
    domain: str,
    prefix: str = DEFAULT_DOMAIN_CACHE_KEY_PREFIX,
) -> str:
    """Generate a versioned Redis cache key for domain OSINT threat intelligence.

    ARCHITECTURAL CONVENTION & DESIGN RATIONALE:
    Unlike URL cache keys (which use SHA-256 hashes to protect user browsing privacy),
    domain OSINT cache keys intentionally preserve the normalized domain name in PLAINTEXT:
        Format: '{prefix}:{normalized_domain}' (e.g. 'sitesentry:cache:osint:example.com')

    This design aligns with existing project conventions across:
    - RedisCache._osint_key() in src/core/redis.py:
        f"sitesentry:cache:osint:{domain.strip().lower()}"
    - dev/31_DATA_PRIVACY_AND_RETENTION.md §3.1:
        "Domain OSINT cache keys (sitesentry:cache:osint:{domain}) expire automatically after 24 hours"

    REDIS COMPATIBILITY & IDN CANONICALIZATION BEHAVIOR:
    This helper aligns with the existing Redis key namespace convention, but introduces
    canonicalized domain keys for future-proof and attack-resilient caching:
    1. Exact Match for ASCII Domains: For standard ASCII domains ('example.com'), uppercase
       domains ('EXAMPLE.COM'), whitespace-padded domains ('  example.com  '), punycode domains
       ('xn--mnchen-3ya.de'), and trailing-dot domains ('example.com.'), domain_cache_key()
       produces keys that are 100% identical to RedisCache._osint_key().
    2. Intentional IDN Canonicalization Divergence: For raw Unicode Internationalized Domain
       Names (e.g., 'münchen.de'), legacy RedisCache._osint_key() left raw UTF-8 characters
       unencoded ('sitesentry:cache:osint:münchen.de'). That behavior caused cache fragmentation
       because 'münchen.de' and 'xn--mnchen-3ya.de' resolved to separate cache records.
       domain_cache_key() intentionally canonicalizes all IDNs to ASCII punycode via
       normalize_host() ('sitesentry:cache:osint:xn--mnchen-3ya.de').
       This guarantees:
       - Unified cache lookups: both Unicode and punycode representations hit the same cache record.
       - Threat-intelligence consistency: matches external providers (VirusTotal, Safe Browsing).
       - ASCII-safe key storage: avoids multi-byte encoding edge cases in Redis clients.

    Args:
        domain: Target domain or hostname.
        prefix: Key namespace prefix (defaults to 'sitesentry:cache:osint').

    Returns:
        The fully formatted Redis key string with normalized plaintext domain.

    Raises:
        NormalizationError: If the domain is malformed or invalid.
    """
    normalized = normalize_host(domain)
    return f"{prefix}:{normalized}"
