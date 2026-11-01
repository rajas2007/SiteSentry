"""Comprehensive Test Suite for URL Sanitization, Normalization, and Hashing.

Validates compliance with Site Sentry Phase B.1 specifications:
- Zero data leakage (credentials, tokens, session IDs, OAuth fragments)
- Strict preservation of empty query components ('&&', leading/trailing delimiters)
- Strict preservation of explicitly present but empty query delimiters ('?')
- Strict hostname validation rejecting malformed hostnames without silent fallback
- Documented domain cache key behavior (plaintext normalized domain vs. SHA-256 hash)
- Strict preservation of benign parameters, query order, duplicate keys, and path casing
- Robust handling of IPv4, IPv6, IDN hostnames, and malformed inputs
- Deterministic hashing and cache key generation
"""

import pytest

from src.core.redis import RedisCache
from src.utils.hashing import domain_cache_key, hash_domain, hash_url, url_cache_key
from src.utils.normalization import (
    NormalizationError,
    normalize_host,
    normalize_scheme,
    strip_authority_credentials,
)
from src.utils.url import (
    DEFAULT_SENSITIVE_PARAMS,
    REDACTION_TOKEN,
    InvalidURLError,
    is_sensitive_parameter,
    is_valid_url,
    sanitize_query_string,
    sanitize_url,
)


# ==============================================================================
# 1. Normal HTTP and HTTPS URLs
# ==============================================================================
def test_normal_http_and_https_urls() -> None:
    assert sanitize_url("http://example.com") == "http://example.com"
    assert sanitize_url("http://example.com/") == "http://example.com/"
    assert sanitize_url("https://example.com/path") == "https://example.com/path"
    assert (
        sanitize_url("https://example.com/deep/nested/path.html")
        == "https://example.com/deep/nested/path.html"
    )
    assert sanitize_url("HTTPS://EXAMPLE.COM/PATH") == "https://example.com/PATH"


# ==============================================================================
# 2. Authority Credentials Stripping
# ==============================================================================
def test_authority_credentials_stripped() -> None:
    # Standard user:pass
    assert sanitize_url("http://user:password@example.com/") == "http://example.com/"
    # User only
    assert (
        sanitize_url("http://admin@example.com/dashboard")
        == "http://example.com/dashboard"
    )
    # Password only
    assert (
        sanitize_url("http://:secretpass@example.com/api") == "http://example.com/api"
    )
    # Multiple @ signs in userinfo
    assert (
        sanitize_url("https://user:p%40ss@sub.example.com/login")
        == "https://sub.example.com/login"
    )
    assert sanitize_url("https://user:p@ss@word@example.com/") == "https://example.com/"
    # Authority with non-default port
    assert (
        sanitize_url("http://user:pass@example.com:8080/app")
        == "http://example.com:8080/app"
    )


# ==============================================================================
# 3. Fragments Removed (OAuth & Client Directives)
# ==============================================================================
def test_fragments_removed() -> None:
    # OAuth implicit flow fragment
    oauth_url = "https://app.example.com/oauth/callback#access_token=ya29.secret123&token_type=bearer&expires_in=3600"
    assert sanitize_url(oauth_url) == "https://app.example.com/oauth/callback"

    # In-page anchor fragment
    assert (
        sanitize_url("https://example.com/docs#installation")
        == "https://example.com/docs"
    )

    # URL with both query string and fragment
    combined = "https://example.com/search?q=security#results"
    assert sanitize_url(combined) == "https://example.com/search?q=security"


# ==============================================================================
# 4. Sensitive Query Parameter Redaction (All 24 Canonical Keys)
# ==============================================================================
@pytest.mark.parametrize("param_name", sorted(DEFAULT_SENSITIVE_PARAMS))
def test_all_canonical_sensitive_parameters_redacted(param_name: str) -> None:
    url = f"https://example.com/api?{param_name}=SUPER_SECRET_VALUE_123"
    expected = f"https://example.com/api?{param_name}={REDACTION_TOKEN}"
    assert sanitize_url(url) == expected


def test_mixed_sensitive_and_benign_parameters() -> None:
    url = "https://example.com/checkout?item=laptop&token=secret123&quantity=1&session=sess456"
    expected = "https://example.com/checkout?item=laptop&token=[REDACTED]&quantity=1&session=[REDACTED]"
    assert sanitize_url(url) == expected


# ==============================================================================
# 5. Mixed-Case Parameter Names
# ==============================================================================
def test_mixed_case_sensitive_parameter_names() -> None:
    url = "https://example.com/login?TOKEN=secret1&Token=secret2&toKen=secret3&API_KEY=key4"
    expected = "https://example.com/login?TOKEN=[REDACTED]&Token=[REDACTED]&toKen=[REDACTED]&API_KEY=[REDACTED]"
    assert sanitize_url(url) == expected


# ==============================================================================
# 6. Multiple Duplicate Sensitive Parameters
# ==============================================================================
def test_duplicate_sensitive_parameters_preserved() -> None:
    url = "https://example.com/auth?token=val1&token=val2&token=val3"
    expected = (
        "https://example.com/auth?token=[REDACTED]&token=[REDACTED]&token=[REDACTED]"
    )
    assert sanitize_url(url) == expected


# ==============================================================================
# 7. Encoded and Double-Encoded Parameter Names
# ==============================================================================
def test_encoded_parameter_names() -> None:
    # Single percent-encoded "%74%6f%6b%65%6e" -> "token"
    url1 = "https://example.com/login?%74%6f%6b%65%6e=secret123"
    assert sanitize_url(url1) == "https://example.com/login?%74%6f%6b%65%6e=[REDACTED]"

    # Single percent-encoded underscore "api%5fkey" -> "api_key"
    url2 = "https://example.com/api?api%5fkey=secret456"
    assert sanitize_url(url2) == "https://example.com/api?api%5fkey=[REDACTED]"

    # Double percent-encoded "%2574%256f%256b%2565%256e" -> "%74%6f%6b%65%6e" -> "token"
    url3 = "https://example.com/login?%2574%256f%256b%2565%256e=secret789"
    assert (
        sanitize_url(url3)
        == "https://example.com/login?%2574%256f%256b%2565%256e=[REDACTED]"
    )

    # Partially encoded "t%6fk%65n" -> "token"
    url4 = "https://example.com/login?t%6fk%65n=secret321"
    assert sanitize_url(url4) == "https://example.com/login?t%6fk%65n=[REDACTED]"

    # Partially double-encoded "t%256fk%2565n" -> "t%6fk%65n" -> "token"
    url5 = "https://example.com/login?t%256fk%2565n=secret654"
    assert sanitize_url(url5) == "https://example.com/login?t%256fk%2565n=[REDACTED]"


def test_bracketed_parameter_names() -> None:
    # Bracketed sub-keys (e.g. auth[token], user[password])
    url = (
        "https://example.com/api?user[password]=secret&auth[token]=abc&user[name]=alice"
    )
    expected = "https://example.com/api?user[password]=[REDACTED]&auth[token]=[REDACTED]&user[name]=alice"
    assert sanitize_url(url) == expected


# ==============================================================================
# 8. Benign Parameters Unmodified
# ==============================================================================
def test_benign_parameters_unmodified() -> None:
    url = "https://example.com/search?category=electronics&sort=price_asc&page=3&in_stock=true"
    assert sanitize_url(url) == url

    # Percent-encoded benign values should NOT be re-encoded or changed
    url_encoded_val = "https://example.com/search?query=hello%20world&tag=%23security"
    assert sanitize_url(url_encoded_val) == url_encoded_val

    # Empty and valueless benign flags
    url_empty = "https://example.com/app?verbose&debug=&format=json"
    assert sanitize_url(url_empty) == url_empty


# ==============================================================================
# 9. Query Ordering Preservation
# ==============================================================================
def test_query_ordering_strictly_preserved() -> None:
    url = "https://example.com/?z=last&token=secret&a=first&auth=secret2&m=middle"
    expected = (
        "https://example.com/?z=last&token=[REDACTED]&a=first&auth=[REDACTED]&m=middle"
    )
    assert sanitize_url(url) == expected


# ==============================================================================
# 10. Case-Sensitive Paths Preserved
# ==============================================================================
def test_case_sensitive_paths_preserved() -> None:
    # Path casing must not be altered
    url = "https://example.com/API/v1/UserData/PROFILE.JSON"
    assert sanitize_url(url) == "https://example.com/API/v1/UserData/PROFILE.JSON"

    # Consecutive slashes and dot segments are preserved
    url_slashes = "https://example.com/a//b/./c/../d"
    assert sanitize_url(url_slashes) == "https://example.com/a//b/./c/../d"


# ==============================================================================
# 11. IPv4 and IPv6 Hostnames
# ==============================================================================
def test_ipv4_hostnames() -> None:
    assert sanitize_url("http://192.168.1.1/") == "http://192.168.1.1/"
    assert sanitize_url("http://192.168.1.1:8080/api") == "http://192.168.1.1:8080/api"
    assert (
        sanitize_url("http://admin:pass@127.0.0.1:3000/app")
        == "http://127.0.0.1:3000/app"
    )


def test_ipv6_hostnames() -> None:
    assert sanitize_url("http://[::1]/") == "http://[::1]/"
    assert sanitize_url("http://[::1]:8080/api") == "http://[::1]:8080/api"
    assert sanitize_url("http://admin:pass@[::1]:8080/api") == "http://[::1]:8080/api"
    assert sanitize_url("http://[2001:db8::1]/path") == "http://[2001:db8::1]/path"
    # Upper-case hex in IPv6 is lowercased
    assert (
        sanitize_url("http://[2001:0DB8::ABCD]:8080/path")
        == "http://[2001:0db8::abcd]:8080/path"
    )


# ==============================================================================
# 12. IDN / Punycode Hostnames
# ==============================================================================
def test_idn_punycode_hostnames() -> None:
    # Unicode domain converts to punycode
    assert sanitize_url("http://münchen.de/tour") == "http://xn--mnchen-3ya.de/tour"
    # Existing punycode preserved lowercase
    assert (
        sanitize_url("http://XN--MNCHEN-3YA.DE/TOUR") == "http://xn--mnchen-3ya.de/TOUR"
    )


# ==============================================================================
# 13. Malformed URLs & Error Handling
# ==============================================================================
def test_malformed_urls_raise_invalid_url_error() -> None:
    with pytest.raises(InvalidURLError, match="URL cannot be empty"):
        sanitize_url("")

    with pytest.raises(InvalidURLError, match="URL cannot be empty"):
        sanitize_url("   ")

    with pytest.raises(InvalidURLError, match="URL must be a string"):
        sanitize_url(None)  # type: ignore[arg-type]

    with pytest.raises(InvalidURLError, match="Missing URL scheme"):
        sanitize_url("example.com/no-scheme")

    with pytest.raises(InvalidURLError, match="URL is missing a valid authority"):
        sanitize_url("http:///missing-authority")

    with pytest.raises(InvalidURLError, match="Invalid IPv6 address"):
        sanitize_url("http://[not-a-valid-ipv6]/path")

    with pytest.raises(InvalidURLError, match="Invalid port number"):
        sanitize_url("http://example.com:9999999/path")


# ==============================================================================
# 14. Unsupported Schemes
# ==============================================================================
def test_unsupported_schemes_raise_invalid_url_error() -> None:
    unsupported = [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "ftp://ftp.example.com/file",
        "blob:https://example.com/uuid",
    ]
    for url in unsupported:
        with pytest.raises(InvalidURLError, match="Only HTTP and HTTPS are permitted"):
            sanitize_url(url)


# ==============================================================================
# 15. CRLF & Control Characters
# ==============================================================================
def test_crlf_and_control_characters_rejected() -> None:
    crlf_urls = [
        "https://example.com/test\r\nSet-Cookie:admin=1",
        "https://example.com/test\r",
        "https://example.com/test\n",
        "https://example.com/test\x00path",
    ]
    for url in crlf_urls:
        with pytest.raises(
            InvalidURLError, match="URL contains invalid control characters"
        ):
            sanitize_url(url)


# ==============================================================================
# 16. Security: No URL Values in Error Messages
# ==============================================================================
def test_error_messages_never_leak_url_contents() -> None:
    secret_url = "javascript:steal_token('TOP_SECRET_PASSWORD_123')"
    with pytest.raises(InvalidURLError) as exc_info:
        sanitize_url(secret_url)
    assert "TOP_SECRET_PASSWORD_123" not in str(exc_info.value)
    assert "steal_token" not in str(exc_info.value)


# ==============================================================================
# 17. Idempotency
# ==============================================================================
def test_sanitization_is_idempotent() -> None:
    urls = [
        "https://user:pass@example.com:8080/path?token=secret&lang=en#frag",
        "https://example.com/checkout?item=laptop&jwt=ey...&page=2",
        "http://[::1]:3000/api/v1/resource?sig=abc&user=bob",
        "http://münchen.de/path?auth=xyz&ref=partner",
        "https://example.com/path?",
        "https://example.com/path?a=1&&b=2",
    ]
    for u in urls:
        sanitized_once = sanitize_url(u)
        sanitized_twice = sanitize_url(sanitized_once)
        assert sanitized_once == sanitized_twice


# ==============================================================================
# 18. Deterministic Hashing & Cache Keys
# ==============================================================================
def test_deterministic_hashing() -> None:
    url = "https://example.com/login?token=secret123&lang=en#section"
    hash1 = hash_url(url)
    hash2 = hash_url(url)
    assert len(hash1) == 64
    assert hash1 == hash2

    key = url_cache_key(url)
    assert key == f"sitesentry:cache:url:v2:{hash1}"


def test_sensitive_vs_benign_values_hashing() -> None:
    # Different sensitive values produce IDENTICAL sanitized representation and hash
    url_sensitive_a = "https://example.com/login?token=TOKEN_A&session=SESS_1&lang=en"
    url_sensitive_b = "https://example.com/login?token=TOKEN_B&session=SESS_2&lang=en"

    sanitized_a = sanitize_url(url_sensitive_a)
    sanitized_b = sanitize_url(url_sensitive_b)
    assert sanitized_a == sanitized_b
    assert (
        sanitized_a
        == "https://example.com/login?token=[REDACTED]&session=[REDACTED]&lang=en"
    )
    assert hash_url(url_sensitive_a) == hash_url(url_sensitive_b)

    # Different benign values produce DIFFERENT hashes
    url_benign_c = "https://example.com/login?token=TOKEN_A&session=SESS_1&lang=fr"
    sanitized_c = sanitize_url(url_benign_c)
    assert sanitized_a != sanitized_c
    assert hash_url(url_sensitive_a) != hash_url(url_benign_c)


# ==============================================================================
# 19. is_valid_url Helper Function
# ==============================================================================
def test_is_valid_url_helper() -> None:
    assert is_valid_url("https://example.com") is True
    assert is_valid_url("http://localhost:8000/api") is True
    assert is_valid_url("ftp://example.com") is False
    assert is_valid_url("javascript:alert(1)") is False
    assert is_valid_url("not a url") is False
    assert is_valid_url("") is False


# ==============================================================================
# 20. Direct Low-Level Normalization Functions
# ==============================================================================
def test_direct_normalization_functions() -> None:
    assert normalize_scheme("http") == "http"
    assert normalize_scheme("HTTPS") == "https"
    with pytest.raises(NormalizationError):
        normalize_scheme("ftp")
    with pytest.raises(NormalizationError):
        normalize_scheme("")

    assert normalize_host("example.com") == "example.com"
    assert normalize_host("münchen.de") == "xn--mnchen-3ya.de"
    with pytest.raises(NormalizationError):
        normalize_host("")

    host, port = strip_authority_credentials("user:pass@host.org:8080")
    assert host == "host.org"
    assert port == ":8080"

    host_ipv6, port_ipv6 = strip_authority_credentials("admin:pass@[::1]:9000")
    assert host_ipv6 == "[::1]"
    assert port_ipv6 == ":9000"

    with pytest.raises(NormalizationError):
        strip_authority_credentials("")


# ==============================================================================
# 21. Direct Parameter and Query String Helpers
# ==============================================================================
def test_direct_parameter_and_query_helpers() -> None:
    assert is_sensitive_parameter("token") is True
    assert is_sensitive_parameter("TOKEN") is True
    assert is_sensitive_parameter("%74%6f%6b%65%6e") is True
    assert is_sensitive_parameter("lang") is False
    assert is_sensitive_parameter("") is False

    qs = "token=secret&lang=en&code=123"
    assert sanitize_query_string(qs) == "token=[REDACTED]&lang=en&code=[REDACTED]"
    assert sanitize_query_string("") == ""


# ==============================================================================
# 22. Target Correction 1: Preservation of Empty Query Components
# ==============================================================================
def test_preservation_of_empty_query_components() -> None:
    # '?a=1&&b=2'
    assert (
        sanitize_url("https://example.com/path?a=1&&b=2")
        == "https://example.com/path?a=1&&b=2"
    )
    # '?a=1&'
    assert (
        sanitize_url("https://example.com/path?a=1&") == "https://example.com/path?a=1&"
    )
    # '?&a=1'
    assert (
        sanitize_url("https://example.com/path?&a=1") == "https://example.com/path?&a=1"
    )
    # '?a=1&&'
    assert (
        sanitize_url("https://example.com/path?a=1&&")
        == "https://example.com/path?a=1&&"
    )
    # Redaction combined with empty query components
    assert (
        sanitize_url("https://example.com/path?token=secret&&b=2&auth=xyz&")
        == "https://example.com/path?token=[REDACTED]&&b=2&auth=[REDACTED]&"
    )
    # Direct query string sanitizer preservation
    assert sanitize_query_string("a=1&&b=2") == "a=1&&b=2"
    assert sanitize_query_string("a=1&") == "a=1&"
    assert sanitize_query_string("&a=1") == "&a=1"
    assert sanitize_query_string("a=1&&") == "a=1&&"


# ==============================================================================
# 23. Target Correction 2: Preservation of Explicitly Empty Query Delimiter ('?')
# ==============================================================================
def test_preservation_of_empty_query_delimiter() -> None:
    # URL without query delimiter
    assert sanitize_url("https://example.com/path") == "https://example.com/path"

    # URL with explicitly present but empty query delimiter '?'
    assert sanitize_url("https://example.com/path?") == "https://example.com/path?"
    assert sanitize_url("https://example.com/?") == "https://example.com/?"
    assert sanitize_url("https://example.com?") == "https://example.com?"

    # Fragment removal with explicit empty delimiter
    assert (
        sanitize_url("https://example.com/path?#access_token=secret")
        == "https://example.com/path?"
    )

    # Fragment removal without query delimiter
    assert (
        sanitize_url("https://example.com/path#access_token=secret")
        == "https://example.com/path"
    )

    # Verify idempotency for empty query delimiter
    assert (
        sanitize_url(sanitize_url("https://example.com/path?"))
        == "https://example.com/path?"
    )
    assert (
        sanitize_url(sanitize_url("https://example.com/path"))
        == "https://example.com/path"
    )


# ==============================================================================
# 24. Target Correction 3: Tightened Hostname Validation (No Silent Fallback)
# ==============================================================================
def test_tightened_hostname_validation() -> None:
    # Spaces in hostname
    with pytest.raises(InvalidURLError, match="Invalid character in URL hostname"):
        sanitize_url("http://exam ple.com/path")

    # Invalid characters in hostname
    invalid_host_chars = [
        "http://ex<am>ple.com/",
        "http://exam^ple.com/",
        "http://exam{ple}.com/",
        "http://exam|ple.com/",
        'http://exam"ple.com/',
    ]
    for url in invalid_host_chars:
        with pytest.raises(InvalidURLError, match="Invalid character in URL hostname"):
            sanitize_url(url)

    # Empty labels / double dots
    with pytest.raises(InvalidURLError, match="cannot contain empty labels"):
        sanitize_url("http://example..com/")

    # Label starting or ending with hyphen
    with pytest.raises(InvalidURLError, match="cannot start or end with a hyphen"):
        sanitize_url("http://-example.com/")

    with pytest.raises(InvalidURLError, match="cannot start or end with a hyphen"):
        sanitize_url("http://example-.com/")

    # Direct normalize_host unit tests
    with pytest.raises(NormalizationError):
        normalize_host("exam ple.com")

    with pytest.raises(NormalizationError):
        normalize_host("example..com")

    with pytest.raises(NormalizationError):
        normalize_host("-bad.com")

    with pytest.raises(NormalizationError):
        normalize_host("bad-.com")

    with pytest.raises(NormalizationError):
        normalize_host("exam<ple>.com")

    # Valid hostnames must succeed
    assert normalize_host("localhost") == "localhost"
    assert normalize_host("dev-server.local") == "dev-server.local"
    assert normalize_host("sub.example.co.uk") == "sub.example.co.uk"
    assert normalize_host("127.0.0.1") == "127.0.0.1"
    assert normalize_host("[::1]") == "[::1]"
    assert normalize_host("[2001:db8::1]") == "[2001:db8::1]"
    assert normalize_host("münchen.de") == "xn--mnchen-3ya.de"
    assert normalize_host("xn--mnchen-3ya.de") == "xn--mnchen-3ya.de"
    assert normalize_host("360.cn") == "360.cn"
    assert normalize_host("123.example.com") == "123.example.com"


# ==============================================================================
# 25. Target Correction 4: Reject Underscores in DNS Hostnames
# ==============================================================================
def test_hostname_underscores_rejected() -> None:
    # Directly test normalize_host rejects underscores
    with pytest.raises(
        NormalizationError, match="Hostname contains invalid characters"
    ):
        normalize_host("example_test.com")

    with pytest.raises(
        NormalizationError, match="Hostname contains invalid characters"
    ):
        normalize_host("sub_domain.example.com")

    with pytest.raises(
        NormalizationError, match="Hostname contains invalid characters"
    ):
        normalize_host("dev_server.local")

    # Verify through sanitize_url
    with pytest.raises(InvalidURLError, match="Hostname contains invalid characters"):
        sanitize_url("http://example_test.com/path")

    with pytest.raises(InvalidURLError, match="Hostname contains invalid characters"):
        sanitize_url("https://sub_domain.example.com/api")

    with pytest.raises(InvalidURLError, match="Hostname contains invalid characters"):
        sanitize_url("http://dev_server.local:8080/app")


# ==============================================================================
# 26. Target Correction 5: Trailing Dots Validation (FQDN vs Multiple Dots)
# ==============================================================================
def test_trailing_dots_validation() -> None:
    # Single trailing dot permitted for FQDN
    assert normalize_host("example.com.") == "example.com."
    assert normalize_host("sub.example.org.") == "sub.example.org."
    assert normalize_host("münchen.de.") == "xn--mnchen-3ya.de."
    assert sanitize_url("https://example.com./path") == "https://example.com./path"
    assert (
        sanitize_url("https://example.com.:8080/path")
        == "https://example.com.:8080/path"
    )

    # Multiple trailing dots rejected
    with pytest.raises(NormalizationError, match="cannot contain empty labels"):
        normalize_host("example.com..")

    with pytest.raises(NormalizationError, match="cannot contain empty labels"):
        normalize_host("example.com...")

    with pytest.raises(InvalidURLError, match="cannot contain empty labels"):
        sanitize_url("https://example.com../path")

    # Leading and consecutive dots rejected
    with pytest.raises(NormalizationError, match="cannot contain empty labels"):
        normalize_host(".example.com")

    with pytest.raises(NormalizationError, match="cannot contain empty labels"):
        normalize_host("..example.com")

    with pytest.raises(NormalizationError, match="cannot contain empty labels"):
        normalize_host(".")

    with pytest.raises(NormalizationError, match="cannot contain empty labels"):
        normalize_host("..")


# ==============================================================================
# 27. Target Correction 6: Malformed Numeric IPv4-Looking Hosts Rejected
# ==============================================================================
def test_malformed_numeric_ipv4_looking_hosts_rejected() -> None:
    # Malformed IPv4-looking hosts rejected instead of accepted as DNS names
    malformed_ipv4 = [
        "256.1.1.1",
        "1.2.3.4.5",
        "999.999.999.999",
        "127.0.0.1.",
        "300.0.0.1",
    ]
    for host in malformed_ipv4:
        with pytest.raises(NormalizationError, match="Malformed IPv4 address"):
            normalize_host(host)

        with pytest.raises(InvalidURLError, match="Malformed IPv4 address"):
            sanitize_url(f"http://{host}/path")

    # All-numeric TLDs rejected
    with pytest.raises(
        NormalizationError, match="Top-level domain cannot be all-numeric"
    ):
        normalize_host("example.123")

    with pytest.raises(InvalidURLError, match="Top-level domain cannot be all-numeric"):
        sanitize_url("http://example.123/path")

    # Valid IPv4 addresses must NOT be broken
    assert normalize_host("127.0.0.1") == "127.0.0.1"
    assert normalize_host("192.168.1.1") == "192.168.1.1"
    assert normalize_host("10.0.0.1") == "10.0.0.1"
    assert sanitize_url("http://127.0.0.1:8080/app") == "http://127.0.0.1:8080/app"

    # Valid domains with numbers must NOT be broken
    assert normalize_host("360.cn") == "360.cn"
    assert normalize_host("123.example.com") == "123.example.com"
    assert normalize_host("1.2.3.4.example.com") == "1.2.3.4.example.com"
    assert (
        sanitize_url("https://123.example.com/path") == "https://123.example.com/path"
    )


# ==============================================================================
# 28. Target Correction 7: Resolved Domain Cache Key Compatibility
# ==============================================================================
def test_domain_cache_key_behavior() -> None:
    # Domain cache key uses PLAINTEXT normalized domain (compatible with RedisCache._osint_key)
    key = domain_cache_key("example.com")
    assert key == "sitesentry:cache:osint:example.com"

    # Whitespace and uppercase are normalized
    key_normalized = domain_cache_key("  EXAMPLE.COM  ")
    assert key_normalized == "sitesentry:cache:osint:example.com"

    # IDN Unicode domains are converted to punycode plaintext in cache key
    key_idn = domain_cache_key("münchen.de")
    assert key_idn == "sitesentry:cache:osint:xn--mnchen-3ya.de"

    # Trailing dot preserved in cache key
    key_dot = domain_cache_key("example.com.")
    assert key_dot == "sitesentry:cache:osint:example.com."

    # Contrast with hash_domain: hash_domain returns a 64-char SHA-256 digest
    digest = hash_domain("example.com")
    assert len(digest) == 64
    assert digest == hash_domain("  EXAMPLE.COM  ")
    assert digest != "example.com"

    # IDN punycode equivalence in hash_domain
    assert hash_domain("münchen.de") == hash_domain("xn--mnchen-3ya.de")

    # Malformed domains are rejected in both functions
    with pytest.raises(NormalizationError):
        domain_cache_key("invalid domain space")

    with pytest.raises(NormalizationError):
        hash_domain("invalid domain space")


# ==============================================================================
# 29. Detailed Comparison: domain_cache_key vs Legacy RedisCache._osint_key
# ==============================================================================
def test_domain_cache_key_vs_redis_osint_key_comparison() -> None:
    """Compare domain_cache_key against legacy RedisCache._osint_key across 6 categories.

    Verifies exact parity for ASCII, uppercase, whitespace, punycode, and trailing-dot
    domains, while explicitly testing and documenting the intentional IDN canonicalization
    divergence for Unicode IDNs.
    """
    redis_cache = RedisCache()

    # 1. Ordinary ASCII domains: EXACT MATCH
    ascii_domain = "example.com"
    expected_ascii_key = "sitesentry:cache:osint:example.com"
    assert domain_cache_key(ascii_domain) == expected_ascii_key
    assert redis_cache._osint_key(ascii_domain) == expected_ascii_key
    assert domain_cache_key(ascii_domain) == redis_cache._osint_key(ascii_domain)

    # 2. Uppercase domains: EXACT MATCH
    upper_domain = "EXAMPLE.COM"
    assert domain_cache_key(upper_domain) == expected_ascii_key
    assert redis_cache._osint_key(upper_domain) == expected_ascii_key
    assert domain_cache_key(upper_domain) == redis_cache._osint_key(upper_domain)

    # 3. Whitespace-padded domains: EXACT MATCH
    padded_domain = "   example.com   "
    assert domain_cache_key(padded_domain) == expected_ascii_key
    assert redis_cache._osint_key(padded_domain) == expected_ascii_key
    assert domain_cache_key(padded_domain) == redis_cache._osint_key(padded_domain)

    # 4. Punycode domains: EXACT MATCH
    punycode_domain = "xn--mnchen-3ya.de"
    expected_punycode_key = "sitesentry:cache:osint:xn--mnchen-3ya.de"
    assert domain_cache_key(punycode_domain) == expected_punycode_key
    assert redis_cache._osint_key(punycode_domain) == expected_punycode_key
    assert domain_cache_key(punycode_domain) == redis_cache._osint_key(punycode_domain)

    # 5. Trailing-dot domains: EXACT MATCH
    trailing_dot_domain = "example.com."
    expected_dot_key = "sitesentry:cache:osint:example.com."
    assert domain_cache_key(trailing_dot_domain) == expected_dot_key
    assert redis_cache._osint_key(trailing_dot_domain) == expected_dot_key
    assert domain_cache_key(trailing_dot_domain) == redis_cache._osint_key(
        trailing_dot_domain
    )

    # 6. Unicode IDNs: INTENTIONAL CANONICALIZATION DIVERGENCE
    # Legacy RedisCache._osint_key leaves raw Unicode UTF-8 unencoded, producing a key
    # that misses when queried via punycode. domain_cache_key canonicalizes to ASCII punycode.
    unicode_domain = "münchen.de"
    legacy_key = redis_cache._osint_key(unicode_domain)
    canonical_key = domain_cache_key(unicode_domain)

    # Verify legacy behavior produces raw UTF-8 key
    assert legacy_key == "sitesentry:cache:osint:münchen.de"

    # Verify helper canonicalizes to punycode
    assert canonical_key == "sitesentry:cache:osint:xn--mnchen-3ya.de"

    # Demonstrate that helper and legacy diverge for raw Unicode IDNs
    assert canonical_key != legacy_key

    # Demonstrate that helper resolves both Unicode and Punycode to the SAME canonical key
    assert domain_cache_key(unicode_domain) == domain_cache_key(punycode_domain)

    # Demonstrate that helper's canonicalized key matches legacy key when queried by punycode
    assert domain_cache_key(unicode_domain) == redis_cache._osint_key(punycode_domain)
