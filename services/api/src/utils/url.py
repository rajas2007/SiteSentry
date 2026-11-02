"""URL Sanitization Utilities for Site Sentry.

Provides centralized, deterministic URL sanitization to prevent sensitive data
leakage (credentials, tokens, session IDs, OAuth fragments) into application logs,
cache stores, databases, and third-party threat-intelligence providers.

SECURITY NOTICE:
This utility is designed strictly for telemetry, logging, caching, analytics,
and threat-intelligence dispatch. It replaces sensitive values with '[REDACTED]'
and removes authority credentials and fragments.

IT MUST NEVER BE USED TO CONSTRUCT A BROWSER NAVIGATION DESTINATION (e.g., Proceed Anyway).
Browser navigation targets must be preserved in ephemeral client-side memory
(chrome.storage.session) to retain legitimate application flow.
"""

from __future__ import annotations

import re
import urllib.parse
from typing import Final

from src.utils.normalization import (
    NormalizationError,
    normalize_host,
    normalize_scheme,
    strip_authority_credentials,
)

# Standard token used to mask sensitive parameter values
REDACTION_TOKEN: Final[str] = "[REDACTED]"

# Canonical set of sensitive parameter keys requiring value redaction
DEFAULT_SENSITIVE_PARAMS: Final[frozenset[str]] = frozenset(
    {
        "access_token",
        "api_key",
        "apikey",
        "auth",
        "client_secret",
        "code",
        "id_token",
        "jwt",
        "key",
        "magic_link",
        "pass",
        "password",
        "pwd",
        "refresh_token",
        "reset",
        "reset_token",
        "secret",
        "session",
        "sessionid",
        "sid",
        "sig",
        "signature",
        "state",
        "token",
    }
)

# Precompiled regex to catch brackets in parameter names (e.g. user[password] or auth[token])
_BRACKET_KEY_RE = re.compile(r"^[a-zA-Z0-9_\-]+\[([a-zA-Z0-9_\-]+)\]$")


class InvalidURLError(ValueError):
    """Raised when a URL is malformed, uses an unsupported scheme, or cannot be sanitized.

    SECURITY GUARANTEE:
    Instances of InvalidURLError must never contain the original URL or sensitive tokens
    in the exception message to prevent inadvertent logging of secrets.
    """


def is_sensitive_parameter(
    param_name: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
) -> bool:
    """Determine whether a query parameter key represents a sensitive token or credential.

    Evaluates exact match, casing variations, percent-encoded keys, and bracket notation.

    Args:
        param_name: The parameter name to test.
        sensitive_params: Canonical set of sensitive parameter keys.

    Returns:
        True if the parameter is deemed sensitive, False otherwise.
    """
    if not param_name:
        return False

    decoded = urllib.parse.unquote(param_name).strip()
    while "%" in decoded:
        next_decoded = urllib.parse.unquote(decoded).strip()
        if next_decoded == decoded:
            break
        decoded = next_decoded

    clean_key = decoded.lower()

    if clean_key in sensitive_params:
        return True

    bracket_match = _BRACKET_KEY_RE.match(clean_key)
    if bracket_match:
        nested_key = bracket_match.group(1).lower()
        if nested_key in sensitive_params:
            return True

    return False


def sanitize_query_string(
    query: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
    redaction_token: str = REDACTION_TOKEN,
    strip_sensitive: bool = False,
) -> str:
    """Sanitize an HTTP query string by masking or completely removing sensitive parameter values.

    Guarantees:
    - Query parameter order is strictly preserved.
    - Duplicate parameter names are strictly preserved.
    - Empty query components (e.g. '&&', '&', leading/trailing delimiters) are strictly preserved.
    - Original parameter name casing and percent-encoding are preserved.
    - Benign parameter names and values are completely untouched.
    - Empty and valueless parameters are handled safely.
    - When strip_sensitive=True, parameters matching sensitive_params are completely omitted.

    Args:
        query: The raw query string (without the leading '?').
        sensitive_params: Set of sensitive parameter names to redact or strip.
        redaction_token: Replacement string for sensitive values when not stripping.
        strip_sensitive: If True, completely remove sensitive parameters instead of redacting.

    Returns:
        The sanitized query string.
    """
    if not query:
        return ""

    pairs = query.split("&")
    sanitized_pairs: list[str] = []

    for pair in pairs:
        if not pair:
            sanitized_pairs.append("")
            continue

        if "=" in pair:
            key, val = pair.split("=", 1)
            if is_sensitive_parameter(key, sensitive_params=sensitive_params) or (
                strip_sensitive and redaction_token in val
            ):
                if not strip_sensitive:
                    sanitized_pairs.append(f"{key}={redaction_token}")
            else:
                sanitized_pairs.append(f"{key}={val}")
        else:
            # Valueless parameter (e.g., "?token" or "?debug")
            if is_sensitive_parameter(pair, sensitive_params=sensitive_params) or (
                strip_sensitive and redaction_token in pair
            ):
                if not strip_sensitive:
                    sanitized_pairs.append(f"{pair}={redaction_token}")
            else:
                sanitized_pairs.append(pair)

    # When strip_sensitive is True, collapse consecutive or trailing empty delimiters
    # that resulted from removing pairs, while maintaining valid query structure.
    if strip_sensitive:
        filtered_pairs = [p for p in sanitized_pairs if p]
        return "&".join(filtered_pairs)

    return "&".join(sanitized_pairs)


def sanitize_url(
    url: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
    redaction_token: str = REDACTION_TOKEN,
    strip_sensitive: bool = False,
) -> str:
    """Sanitize a URL by removing credentials, fragments, and sensitive query values or parameters.

    Operations:
    1. Rejects non-string, empty, or whitespace-only inputs.
    2. Rejects dangerous control characters (CRLF, null bytes) to prevent injection.
    3. Validates that the scheme is strictly HTTP or HTTPS.
    4. Strips user:password credentials from the authority.
    5. Normalizes the hostname (IDN punycode conversion, IPv4/IPv6 validation, lowercase).
    6. Preserves the exact case, slashes, and structure of the path.
    7. Redacts or strips sensitive query parameters while preserving ordering and benign values.
    8. Preserves the distinction between a URL without query delimiter and one with an explicit empty delimiter '?'.
    9. Completely removes URL fragments (RFC 7230 §5.1).

    Args:
        url: The URL to sanitize.
        sensitive_params: Optional custom set of sensitive parameter names.
        redaction_token: Optional custom redaction token string.
        strip_sensitive: If True, completely remove sensitive parameters instead of redacting.

    Returns:
        The canonical, sanitized URL string.

    Raises:
        InvalidURLError: If the URL is malformed, uses an invalid scheme, or contains control characters.
    """
    if not isinstance(url, str):
        raise InvalidURLError("URL must be a string.")

    # Guard against CRLF injection and control characters before stripping
    if any(c in url for c in "\r\n\x00"):
        raise InvalidURLError("URL contains invalid control characters.")

    clean_url = url.strip()
    if not clean_url:
        raise InvalidURLError("URL cannot be empty.")

    # Determine whether an explicit query delimiter '?' was present before any fragment
    url_before_frag = clean_url.split("#", 1)[0]
    has_explicit_query = "?" in url_before_frag

    try:
        parsed = urllib.parse.urlsplit(clean_url)
    except ValueError as e:
        if "ipv6" in str(e).lower():
            raise InvalidURLError("Invalid IPv6 address in URL authority.") from None
        raise InvalidURLError("Malformed URL structure.") from None

    # 1. Validate & normalize scheme
    try:
        scheme = normalize_scheme(parsed.scheme)
    except NormalizationError as e:
        raise InvalidURLError(str(e)) from None

    # 2. Validate authority & strip credentials
    if not parsed.netloc:
        raise InvalidURLError("URL is missing a valid authority (hostname).")

    try:
        host_part, port_str = strip_authority_credentials(parsed.netloc)
        normalized_host = normalize_host(host_part)
    except NormalizationError as e:
        raise InvalidURLError(str(e)) from None

    netloc = f"{normalized_host}{port_str}"

    # 3. Preserve original path case and structure
    path = parsed.path

    # 4. Sanitize query string (preserve ordering, redact/strip sensitive keys, keep benign components)
    query = sanitize_query_string(
        parsed.query,
        sensitive_params=sensitive_params,
        redaction_token=redaction_token,
        strip_sensitive=strip_sensitive,
    )

    # 5. Remove fragment (always empty) and reconstruct URL
    base_unsplit = urllib.parse.urlunsplit((scheme, netloc, path, query, ""))

    # 6. Preserve an explicitly present but empty query delimiter (e.g. "https://example.com/path?")
    # when not stripping sensitive parameters
    if has_explicit_query and not query and not strip_sensitive:
        return f"{base_unsplit}?"

    return base_unsplit


def prepare_url_for_persistence(
    url: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
) -> str | None:
    """Prepare a URL for database persistence (PersistedURL).

    Guarantees:
    - Never persists authority credentials.
    - Never persists URL fragments.
    - Completely removes sensitive query parameters and their values (no [REDACTED] tokens stored).
    - Preserves benign query parameters, query ordering, duplicate benign parameters, and path casing.
    - If a safe URL cannot be generated (e.g. malformed or invalid scheme), returns None to fail safely.

    Args:
        url: The URL string to prepare.
        sensitive_params: Set of sensitive parameter names to remove.

    Returns:
        A clean PersistedURL string, or None if the URL cannot be safely processed.
    """
    try:
        # Strip sensitive query parameters completely
        return sanitize_url(
            url,
            sensitive_params=sensitive_params,
            strip_sensitive=True,
        )
    except (InvalidURLError, NormalizationError, ValueError, TypeError):
        return None


def prepare_url_for_display(
    url: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
) -> str:
    """Prepare a URL for history/dashboard display (DisplayURL).

    Guarantees:
    - Sanitizes at read-time to protect clients against legacy contaminated database records.
    - Completely removes any residual credentials, fragments, sensitive parameters, or [REDACTED] tokens.
    - Preserves origin, path, and benign query parameters.
    - If a legacy record is malformed or unparseable, returns a safe fallback origin or empty string
      rather than reflecting the raw contaminated value.

    Args:
        url: The database URL string.
        sensitive_params: Set of sensitive parameter names to remove.

    Returns:
        A client-safe DisplayURL string.
    """
    if not url or not isinstance(url, str):
        return ""

    try:
        # Try full sanitization with sensitive parameters stripped
        sanitized = sanitize_url(
            url,
            sensitive_params=sensitive_params,
            strip_sensitive=True,
        )
        return sanitized
    except (InvalidURLError, NormalizationError, ValueError, TypeError):
        # Safe fallback: attempt to extract only scheme and host
        try:
            parsed = urllib.parse.urlsplit(url.strip())
            if parsed.scheme and parsed.netloc:
                host_part, _ = strip_authority_credentials(parsed.netloc)
                norm_host = normalize_host(host_part)
                norm_scheme = normalize_scheme(parsed.scheme)
                return f"{norm_scheme}://{norm_host}"
        except (InvalidURLError, NormalizationError, ValueError, TypeError):
            return "https://unknown-domain"
        return "https://unknown-domain"


def is_valid_url(url: str) -> bool:
    """Check whether a URL is a valid HTTP/HTTPS URL that can be sanitized safely.

    Args:
        url: The URL string to validate.

    Returns:
        True if valid and sanitizable, False otherwise.
    """
    try:
        sanitize_url(url)
        return True
    except (InvalidURLError, TypeError):
        return False


def has_sensitive_parameters(
    url: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
) -> bool:
    """Evaluate whether a URL contains any sensitive query parameters.

    Inspects all query parameter keys using `is_sensitive_parameter()`, which
    handles case-insensitivity, multi-pass percent decoding, and bracket notation.

    Args:
        url: The URL string to evaluate.
        sensitive_params: Set of sensitive parameter names to match against.

    Returns:
        True if any sensitive query parameter is detected, False otherwise.
    """
    if not isinstance(url, str):
        return False

    clean_url = url.strip()
    if not clean_url:
        return False

    try:
        parsed = urllib.parse.urlsplit(clean_url)
    except ValueError:
        return False

    if not parsed.query:
        return False

    pairs = parsed.query.split("&")
    for pair in pairs:
        if not pair:
            continue
        key = pair.split("=", 1)[0]
        if is_sensitive_parameter(key, sensitive_params=sensitive_params):
            return True

    return False


def prepare_url_for_provider(
    url: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
) -> str | None:
    """Prepare a URL for external threat intelligence providers (e.g. Google Safe Browsing).

    If the URL contains any sensitive query parameters, returns None to ensure
    the provider lookup is skipped rather than dispatching a redacted or sensitive URL.

    Otherwise, strips authority credentials and fragments while strictly preserving
    path case, query order, duplicate parameters, benign query values, and URL semantics.

    Args:
        url: The URL string to prepare.
        sensitive_params: Set of sensitive parameter names to match against.

    Returns:
        A clean, credential-free, fragment-free URL string, or None if sensitive
        query parameters are detected.

    Raises:
        InvalidURLError: If the URL is malformed, uses an invalid scheme, or contains control characters.
    """
    if (
        has_sensitive_parameters(url, sensitive_params=sensitive_params)
        or REDACTION_TOKEN in url
    ):
        return None

    return sanitize_url(url, sensitive_params=sensitive_params)
