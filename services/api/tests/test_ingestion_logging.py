import logging
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.redis import RedisCache
from src.integrations.exceptions import ThreatIntelUnavailableError
from src.integrations.safe_browsing.client import GoogleSafeBrowsingClient
from src.main import app
from src.schemas.analysis import PageAnalysisRequest, PageFeatures
from src.services.scan_service import ScanService


@pytest.fixture
def sample_features() -> PageFeatures:
    return PageFeatures(
        hasPasswordField=False,
        hasLoginForm=False,
        formCount=1,
        externalLinkCount=2,
        iframeCount=0,
        scriptCount=3,
        imageCount=5,
        suspiciousKeywords=[],
        pageTextLength=1000,
        hasHttps=True,
        hostnameLength=15,
        subdomainCount=0,
    )


# ---------------------------------------------------------------------------
# 1. Pydantic Ingestion Sanitization Tests
# ---------------------------------------------------------------------------


def test_pydantic_ingestion_strips_authority_credentials(
    sample_features: PageFeatures,
) -> None:
    req = PageAnalysisRequest(
        url="https://admin:supersecret@example.com/login",
        title="Login",
        hostname="example.com",
        features=sample_features,
    )
    assert str(req.url) == "https://example.com/login"
    assert "admin" not in str(req.url)
    assert "supersecret" not in str(req.url)


def test_pydantic_ingestion_removes_fragment(sample_features: PageFeatures) -> None:
    req = PageAnalysisRequest(
        url="https://example.com/oauth/callback#access_token=jwt_secret_value&state=xyz",
        title="OAuth",
        hostname="example.com",
        features=sample_features,
    )
    assert str(req.url) == "https://example.com/oauth/callback"
    assert "#" not in str(req.url)
    assert "access_token" not in str(req.url)
    assert "jwt_secret_value" not in str(req.url)


def test_pydantic_ingestion_redacts_sensitive_parameters(
    sample_features: PageFeatures,
) -> None:
    req = PageAnalysisRequest(
        url="https://example.com/reset?token=my_secret_reset_token&page=1&lang=en",
        title="Reset Password",
        hostname="example.com",
        features=sample_features,
    )
    assert str(req.url) == "https://example.com/reset?token=[REDACTED]&page=1&lang=en"
    assert "my_secret_reset_token" not in str(req.url)


def test_pydantic_ingestion_preserves_benign_parameters_and_path_case(
    sample_features: PageFeatures,
) -> None:
    req = PageAnalysisRequest(
        url="https://example.com/UserProfile/Settings?category=shoes&category=shirts&page=2",
        title="Settings",
        hostname="example.com",
        features=sample_features,
    )
    assert (
        str(req.url)
        == "https://example.com/UserProfile/Settings?category=shoes&category=shirts&page=2"
    )


def test_pydantic_ingestion_preserves_explicit_empty_delimiter(
    sample_features: PageFeatures,
) -> None:
    req = PageAnalysisRequest(
        url="https://example.com/path?",
        title="Empty Delim",
        hostname="example.com",
        features=sample_features,
    )
    assert str(req.url) == "https://example.com/path?"


def test_pydantic_ingestion_preserves_punycode_hostnames(
    sample_features: PageFeatures,
) -> None:
    req = PageAnalysisRequest(
        url="https://xn--mnchen-3ya.de/info",
        title="Munich",
        hostname="xn--mnchen-3ya.de",
        features=sample_features,
    )
    assert str(req.url) == "https://xn--mnchen-3ya.de/info"


def test_pydantic_ingestion_rejects_crlf_and_invalid_schemes(
    sample_features: PageFeatures,
) -> None:
    with pytest.raises(ValidationError):
        PageAnalysisRequest(
            url="javascript:alert(1)",
            title="Bad Scheme",
            hostname="example.com",
            features=sample_features,
        )

    with pytest.raises(ValidationError):
        PageAnalysisRequest(
            url="https://example.com/path\r\nInjected: Header",
            title="CRLF",
            hostname="example.com",
            features=sample_features,
        )


# ---------------------------------------------------------------------------
# 2. Safe Validation Error Responses (HTTP 422)
# ---------------------------------------------------------------------------


def test_validation_error_malformed_url_with_credentials_does_not_leak_secrets() -> (
    None
):
    username = "admin_user_x"
    password = "super_secret_password_999"
    malformed_url = f"http://{username}:{password}@malformed..host/path"

    with TestClient(app) as client:
        res = client.post("/api/v1/analyze", json={"url": malformed_url})
        assert res.status_code == 422

        # Assert full response body contains none of the supplied secret credentials
        assert username not in res.text
        assert password not in res.text

        data = res.json()
        for err in data.get("detail", []):
            assert "input" not in err
            assert "ctx" not in err
            assert username not in err.get("msg", "")
            assert password not in err.get("msg", "")


def test_validation_error_invalid_url_with_sensitive_token_does_not_leak_secrets() -> (
    None
):
    secret_token = "ultra_sensitive_token_777"
    invalid_url = f"not-a-valid-scheme://example.com/path?token={secret_token}"

    with TestClient(app) as client:
        res = client.post("/api/v1/analyze", json={"url": invalid_url})
        assert res.status_code == 422

        # Assert full response body contains none of the supplied token secret
        assert secret_token not in res.text

        data = res.json()
        for err in data.get("detail", []):
            assert "input" not in err
            assert "ctx" not in err
            assert secret_token not in err.get("msg", "")


def test_validation_error_crlf_injection_does_not_leak_secrets_or_control_chars() -> (
    None
):
    secret_cookie = "secret_session_token_888"
    crlf_url = f"https://example.com/path\r\nSet-Cookie:{secret_cookie}"

    with TestClient(app) as client:
        res = client.post("/api/v1/analyze", json={"url": crlf_url})
        assert res.status_code == 422

        # Assert full response body contains neither the secret nor the injected control characters
        assert secret_cookie not in res.text
        assert "\r" not in res.text
        assert "\n" not in res.text

        data = res.json()
        for err in data.get("detail", []):
            assert "input" not in err
            assert "ctx" not in err
            assert secret_cookie not in err.get("msg", "")


# ---------------------------------------------------------------------------
# 3. Safe Logging and Exception Handling Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scan_service_cache_hit_logging_zero_url_leakage(
    caplog: pytest.LogCaptureFixture,
    sample_features: PageFeatures,
) -> None:
    class InMemoryAnalysisCache(RedisCache):
        def __init__(self) -> None:
            self.store: dict[str, dict] = {}

        def _resolve_key(self, request_or_url: Any) -> str:
            return str(getattr(request_or_url, "url", request_or_url))

        async def get_analysis(self, request_or_url: Any) -> dict | None:
            return self.store.get(self._resolve_key(request_or_url))

        async def set_analysis(
            self, request_or_url: Any, data: dict, ttl: int | None = None
        ) -> bool:
            self.store[self._resolve_key(request_or_url)] = data
            return True

    cache = InMemoryAnalysisCache()
    service = ScanService(cache=cache)

    raw_token_url = "https://example.com/account?token=super_secret_session_token_xyz"
    req = PageAnalysisRequest(
        url=raw_token_url,
        title="Account",
        hostname="example.com",
        features=sample_features,
    )

    # Pre-seed cache under the sanitized URL
    sanitized_url = str(req.url)
    assert "super_secret_session_token_xyz" not in sanitized_url
    await cache.set_analysis(
        sanitized_url,
        {
            "analysis_id": "test-cache-id",
            "score": 100,
            "severity": "low",
            "confidence": 0.90,
            "threat_category": "safe",
            "recommendations": ["Safe"],
            "factors": ["Safe"],
            "decision": {
                "action": "allow",
                "severity": "low",
                "ui": {"color": "emerald"},
            },
            "threat_intelligence": None,
        },
    )

    with caplog.at_level(logging.INFO):
        res = await service.analyze_page(req)
        assert res.score == 100

        # Assert no raw URL, query parameter, or token exists in logs
        assert "super_secret_session_token_xyz" not in caplog.text
        assert "[REDACTED]" not in caplog.text
        assert "?token=" not in caplog.text
        assert "hash=" not in caplog.text
        assert "Cache hit for analysis domain=example.com" in caplog.text


@pytest.mark.asyncio
async def test_safe_browsing_client_logging_zero_url_leakage(
    caplog: pytest.LogCaptureFixture,
) -> None:
    client = GoogleSafeBrowsingClient(api_key="mock_key", timeout=0.001)

    test_url = "https://example.com/test-endpoint?key=sensitive_api_key_value"
    with caplog.at_level(logging.WARNING):
        with pytest.raises(ThreatIntelUnavailableError) as exc_info:
            await client.lookup_url(test_url)

        # Confirm the exception message never embeds the target URL
        assert test_url not in str(exc_info.value)
        assert "sensitive_api_key_value" not in str(exc_info.value)

        # Confirm warning logs never embed the target URL
        assert test_url not in caplog.text
        assert "sensitive_api_key_value" not in caplog.text
        assert "?key=" not in caplog.text
