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
    max_decode_passes: int = 3,
) -> bool:
    """Evaluate whether a query parameter name represents a sensitive parameter.

    Performs case-insensitive matching, multi-pass percent-decoding detection
    (to prevent single and double URL-encoding bypasses), whitespace stripping,
    and structured bracket notation evaluation (e.g. 'auth[token]').

    Args:
        param_name: The raw or encoded query parameter name.
        sensitive_params: Set of sensitive parameter keys to match against.
        max_decode_passes: Maximum percent-decoding iterations to evaluate.

    Returns:
        True if the parameter is identified as sensitive, False otherwise.
    """
    if not param_name:
        return False

    current = param_name.strip()
    clean = current.strip("\x00 \t\r\n").lower()

    if clean in sensitive_params:
        return True

    # Check bracketed parameter notation: e.g. "auth[token]" -> "token"
    bracket_match = _BRACKET_KEY_RE.match(clean)
    if bracket_match and bracket_match.group(1) in sensitive_params:
        return True

    # Iterative percent-decoding to uncover obfuscated / double-encoded parameter names
    for _ in range(max_decode_passes):
        try:
            decoded = urllib.parse.unquote(current)
        except (ValueError, TypeError):
            break

        if decoded == current:
            break

        current = decoded
        clean = current.strip("\x00 \t\r\n").lower()
        if clean in sensitive_params:
            return True

        bracket_match = _BRACKET_KEY_RE.match(clean)
        if bracket_match and bracket_match.group(1) in sensitive_params:
            return True

    return False


def sanitize_query_string(
    query: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
    redaction_token: str = REDACTION_TOKEN,
) -> str:
    """Sanitize a raw query string by masking sensitive parameter values.

    Guarantees:
    - Original query parameter ordering is strictly preserved.
    - Duplicate parameter names are strictly preserved.
    - Empty query components (e.g. '&&', '&', leading/trailing delimiters) are strictly preserved.
    - Original parameter name casing and percent-encoding are preserved.
    - Benign parameter names and values are completely untouched.
    - Empty and valueless parameters are handled safely.

    Args:
        query: The raw query string (without the leading '?').
        sensitive_params: Set of sensitive parameter names to redact.
        redaction_token: Replacement string for sensitive values.

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
            if is_sensitive_parameter(key, sensitive_params=sensitive_params):
                sanitized_pairs.append(f"{key}={redaction_token}")
            else:
                sanitized_pairs.append(f"{key}={val}")
        else:
            # Valueless parameter (e.g., "?token" or "?debug")
            if is_sensitive_parameter(pair, sensitive_params=sensitive_params):
                sanitized_pairs.append(f"{pair}={redaction_token}")
            else:
                sanitized_pairs.append(pair)

    return "&".join(sanitized_pairs)


def sanitize_url(
    url: str,
    sensitive_params: frozenset[str] = DEFAULT_SENSITIVE_PARAMS,
    redaction_token: str = REDACTION_TOKEN,
) -> str:
    """Sanitize a URL by removing credentials, fragments, and sensitive query values.

    Operations:
    1. Rejects non-string, empty, or whitespace-only inputs.
    2. Rejects dangerous control characters (CRLF, null bytes) to prevent injection.
    3. Validates that the scheme is strictly HTTP or HTTPS.
    4. Strips user:password credentials from the authority.
    5. Normalizes the hostname (IDN punycode conversion, IPv4/IPv6 validation, lowercase).
    6. Preserves the exact case, slashes, and structure of the path.
    7. Redacts values of sensitive query parameters while preserving ordering, keys, and empty components.
    8. Preserves the distinction between a URL without query delimiter and one with an explicit empty delimiter '?'.
    9. Completely removes URL fragments (RFC 7230 §5.1).

    Args:
        url: The URL to sanitize.
        sensitive_params: Optional custom set of sensitive parameter names.
        redaction_token: Optional custom redaction token string.

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

    # 4. Sanitize query string (preserve ordering, redact sensitive keys, keep empty components)
    query = sanitize_query_string(
        parsed.query,
        sensitive_params=sensitive_params,
        redaction_token=redaction_token,
    )

    # 5. Remove fragment (always empty) and reconstruct URL
    base_unsplit = urllib.parse.urlunsplit((scheme, netloc, path, query, ""))

    # 6. Preserve an explicitly present but empty query delimiter (e.g. "https://example.com/path?")
    if has_explicit_query and not query:
        return f"{base_unsplit}?"

    return base_unsplit


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
