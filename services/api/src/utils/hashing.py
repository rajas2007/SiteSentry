"""URL Hashing and Cache Key Generation Utilities for Site Sentry.

Provides deterministic SHA-256 and HMAC-SHA-256 hashing based on canonical
sanitized URLs and security-relevant request features, ensuring cache privacy,
mitigating cache poisoning, and standardizing cache keys.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Final

from src.utils.normalization import NormalizationError, normalize_host
from src.utils.url import (
    DEFAULT_SENSITIVE_PARAMS,
    InvalidURLError,
    has_sensitive_parameters,
    sanitize_url,
)

DEFAULT_CACHE_KEY_PREFIX: Final[str] = "sitesentry:cache:url:v2"
DEFAULT_DOMAIN_CACHE_KEY_PREFIX: Final[str] = "sitesentry:cache:osint"
ANALYSIS_HMAC_PURPOSE: Final[bytes] = b"sitesentry:analysis_cache:v2"


def derive_cache_hmac_key(secret: str | None) -> bytes | None:
    """Derive a domain-separated 256-bit HMAC key from an application secret.

    Returns None if the secret is None, empty, or whitespace-only, safely disabling caching.
    """
    if not secret or not secret.strip():
        return None
    return hmac.new(
        secret.encode("utf-8"),
        ANALYSIS_HMAC_PURPOSE,
        hashlib.sha256,
    ).digest()


def extract_security_feature_identity(features: Any) -> dict[str, Any]:
    """Extract deterministic security-relevant DOM features influencing production engines.

    Accepts PageFeatures instance or dict. Normalizes suspicious keywords into a sorted,
    lowercased unique list to avoid whitespace or casing variations causing cache fragmentation.
    """
    if hasattr(features, "model_dump"):
        f_dict = features.model_dump()
    elif isinstance(features, dict):
        f_dict = features
    else:
        f_dict = {
            "hasHttps": getattr(features, "hasHttps", False),
            "hasPasswordField": getattr(features, "hasPasswordField", False),
            "hasLoginForm": getattr(features, "hasLoginForm", False),
            "formCount": getattr(features, "formCount", 0),
            "externalLinkCount": getattr(features, "externalLinkCount", 0),
            "suspiciousKeywords": getattr(features, "suspiciousKeywords", []),
            "hostnameLength": getattr(features, "hostnameLength", 0),
            "subdomainCount": getattr(features, "subdomainCount", 0),
        }

    raw_keywords = f_dict.get("suspiciousKeywords", []) or []
    norm_keywords = sorted(
        {k.strip().lower() for k in raw_keywords if isinstance(k, str) and k.strip()}
    )

    return {
        "externalLinkCount": int(f_dict.get("externalLinkCount", 0)),
        "formCount": int(f_dict.get("formCount", 0)),
        "hasHttps": bool(f_dict.get("hasHttps", False)),
        "hasLoginForm": bool(f_dict.get("hasLoginForm", False)),
        "hasPasswordField": bool(f_dict.get("hasPasswordField", False)),
        "hostnameLength": int(f_dict.get("hostnameLength", 0)),
        "subdomainCount": int(f_dict.get("subdomainCount", 0)),
        "suspiciousKeywords": norm_keywords,
    }


def should_bypass_analysis_cache(request: Any) -> bool:
    """Evaluate whether an analysis request must bypass the full URL analysis cache.

    Bypass triggers:
    1. privacy_policy_text is non-empty (triggers live LLM extraction).
    2. URL contains sensitive query parameters (prevents sharing/caching sensitive user contexts).
    """
    privacy_text = getattr(request, "privacy_policy_text", None)
    if (
        privacy_text is not None
        and isinstance(privacy_text, str)
        and privacy_text.strip()
    ):
        return True

    url_val = getattr(request, "url", None)
    url_str = str(url_val) if url_val is not None else ""
    return bool(has_sensitive_parameters(url_str) or "[REDACTED]" in url_str)


def compute_analysis_cache_key(
    request: Any,
    secret_key: str | None = None,
    prefix: str = DEFAULT_CACHE_KEY_PREFIX,
) -> str | None:
    """Generate an HMAC-SHA-256 analysis cache key for a PageAnalysisRequest.

    Returns None if:
    - The request triggers cache bypass (privacy_policy_text or sensitive query parameters).
    - A valid HMAC key cannot be obtained.
    - URL is malformed or invalid.

    Cache key structure:
        '{prefix}:{hmac_digest}'
    """
    if should_bypass_analysis_cache(request):
        return None

    hmac_key = derive_cache_hmac_key(secret_key)
    if hmac_key is None:
        return None

    url_val = getattr(request, "url", None)
    url_str = str(url_val) if url_val is not None else ""
    try:
        sanitized = sanitize_url(url_str)
    except (InvalidURLError, NormalizationError, ValueError):
        return None

    features = getattr(request, "features", None)
    if features is None:
        return None

    features_dict = extract_security_feature_identity(features)
    cookie_count = int(getattr(request, "third_party_cookie_count", 0))

    identity_payload = {
        "cookie_excess": cookie_count > 10,
        "features": features_dict,
        "url": sanitized,
    }

    serialized = json.dumps(identity_payload, sort_keys=True, separators=(",", ":"))
    digest = hmac.new(hmac_key, serialized.encode("utf-8"), hashlib.sha256).hexdigest()

    return f"{prefix}:{digest}"


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
