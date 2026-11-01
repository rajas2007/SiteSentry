"""URL Normalization Utilities for Site Sentry.

Provides low-level, deterministic normalization functions for schemes,
hostnames (IDN/punycode, IPv4, IPv6), and authority credentials.
"""

from __future__ import annotations

import ipaddress
import re
from typing import Final

SUPPORTED_SCHEMES: Final[frozenset[str]] = frozenset({"http", "https"})


class NormalizationError(ValueError):
    """Raised when URL normalization fails due to invalid syntax."""


def normalize_scheme(scheme: str) -> str:
    """Validate and normalize a URL scheme to lowercase.

    Args:
        scheme: The URL scheme (e.g. 'http', 'HTTPS').

    Returns:
        The lowercased scheme string.

    Raises:
        NormalizationError: If the scheme is missing or not HTTP/HTTPS.
    """
    if not scheme:
        raise NormalizationError("Missing URL scheme.")
    normalized = scheme.strip().lower()
    if normalized not in SUPPORTED_SCHEMES:
        raise NormalizationError(
            f"Unsupported scheme '{normalized}'. Only HTTP and HTTPS are permitted."
        )
    return normalized


def normalize_host(host: str) -> str:
    """Normalize and strictly validate a hostname or IP address.

    Handles:
    - IPv6 bracketed addresses (e.g. '[::1]', '[2001:db8::1]')
    - IPv4 decimal addresses (e.g. '192.168.1.1')
    - Domain names and IDN (punycode conversion)
    - Fully qualified domain names with a single trailing dot (e.g. 'example.com.')
    - Lowercasing

    Validation rules:
    - Rejects empty hostnames.
    - Rejects whitespace or illegal control characters.
    - Rejects invalid IPv4 and IPv6 syntax.
    - Rejects malformed numeric IPv4-looking addresses as DNS names (e.g. '256.1.1.1', '1.2.3.4.5').
    - Rejects invalid IDNA conversions (no silent fallback).
    - Rejects multiple trailing dots (e.g. 'example.com..').
    - Validates DNS label constraints (max 63 chars, no empty labels, no hyphen prefixes/suffixes, no underscores).

    Args:
        host: The raw host string.

    Returns:
        The normalized host string.

    Raises:
        NormalizationError: If the host is empty, contains invalid characters,
            or fails hostname/IP validation.
    """
    if not host:
        raise NormalizationError("URL host cannot be empty.")

    clean_host = host.strip()
    if not clean_host:
        raise NormalizationError("URL host cannot be empty.")

    # IPv6 bracketed notation
    if clean_host.startswith("[") and clean_host.endswith("]"):
        inner_ip = clean_host[1:-1]
        try:
            ipaddress.IPv6Address(inner_ip)
            return f"[{inner_ip.lower()}]"
        except ValueError:
            raise NormalizationError("Invalid IPv6 address in URL authority.") from None

    # Reject whitespace or illegal characters in host (colons only permitted in bracketed IPv6)
    if any(c.isspace() or c in '<>"{}|\\^~`/?#@:;' for c in clean_host):
        raise NormalizationError("Invalid character in URL hostname.")

    # Reject leading dot or consecutive dots (empty labels, multiple trailing dots)
    if clean_host.startswith(".") or ".." in clean_host:
        raise NormalizationError("Hostname cannot contain empty labels.")

    # IPv4 address check
    try:
        ipaddress.IPv4Address(clean_host)
        return clean_host
    except ValueError:
        pass

    # Reject numeric IPv4-looking addresses that failed IPv4 validation
    labels_raw = clean_host.rstrip(".").split(".")
    if all(lbl.isdigit() for lbl in labels_raw):
        raise NormalizationError("Malformed IPv4 address.")
    if len(labels_raw) > 1 and labels_raw[-1].isdigit():
        raise NormalizationError("Top-level domain cannot be all-numeric.")

    # Domain name / IDN punycode handling: reject invalid hostnames without silent fallback
    try:
        punycode = clean_host.encode("idna").decode("ascii").lower()
    except (UnicodeError, ValueError):
        raise NormalizationError(
            "Invalid or malformed hostname: IDN encoding failed."
        ) from None

    # Validate punycode labels
    labels = punycode.rstrip(".").split(".")
    for label in labels:
        if not label:
            raise NormalizationError("Hostname cannot contain empty labels.")
        if len(label) > 63:
            raise NormalizationError("Hostname label exceeds 63 characters.")
        if label.startswith("-") or label.endswith("-"):
            raise NormalizationError(
                "Hostname label cannot start or end with a hyphen."
            )
        if not re.match(r"^[a-z0-9-]+$", label):
            raise NormalizationError("Hostname contains invalid characters.")

    return punycode


def strip_authority_credentials(netloc: str) -> tuple[str, str]:
    """Strip user:password credentials from a URL netloc (authority).

    Args:
        netloc: The authority component from urllib.parse (e.g. 'user:pass@host:port').

    Returns:
        A tuple of (host, port_str) where port_str is either empty or ':port'.

    Raises:
        NormalizationError: If the netloc is empty or malformed.
    """
    if not netloc:
        raise NormalizationError("Authority (netloc) cannot be empty.")

    # Strip userinfo: everything before the last '@'
    clean_authority = netloc.rsplit("@", 1)[-1]

    # Handle IPv6 with port: '[::1]:8080' vs '[::1]'
    if clean_authority.startswith("["):
        close_idx = clean_authority.find("]")
        if close_idx == -1:
            raise NormalizationError("Malformed IPv6 address: missing closing bracket.")
        host_part = clean_authority[: close_idx + 1]
        rest = clean_authority[close_idx + 1 :]
        if rest.startswith(":"):
            port_str = rest[1:]
            if not port_str.isdigit() or not (1 <= int(port_str) <= 65535):
                raise NormalizationError("Invalid port number in authority.")
            return host_part, f":{port_str}"
        return host_part, ""

    # Standard host:port or host
    if ":" in clean_authority:
        host_part, port_candidate = clean_authority.rsplit(":", 1)
        if port_candidate.isdigit():
            if not (1 <= int(port_candidate) <= 65535):
                raise NormalizationError("Invalid port number in authority.")
            return host_part, f":{port_candidate}"
        raise NormalizationError("Invalid port number in authority.")

    return clean_authority, ""
