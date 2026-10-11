from unittest.mock import AsyncMock, patch

import httpx
import pytest

from src.engines.decision.engine import DecisionEngine
from src.engines.security.engine import SecurityEngine
from src.engines.threat_intelligence.engine import ThreatIntelligenceEngine
from src.engines.threat_intelligence.schemas import UnifiedThreatObject
from src.integrations.exceptions import ThreatIntelUnavailableError
from src.integrations.safe_browsing.client import GoogleSafeBrowsingClient
from src.integrations.virustotal.client import VirusTotalClient
from src.schemas.analysis import PageAnalysisRequest, PageFeatures
from src.services.scan_service import ScanService


class MockGSBClient(GoogleSafeBrowsingClient):
    def __init__(self, findings: list[str]) -> None:
        super().__init__(api_key="mock_key")
        self.findings = findings

    async def lookup_url(self, url: str) -> list[str]:
        return self.findings


class MockVTClient(VirusTotalClient):
    def __init__(self, stats: dict) -> None:
        super().__init__(api_key="mock_key")
        self.stats = stats

    async def lookup_domain(self, domain: str) -> dict:
        return self.stats


class FailingGSBClient(GoogleSafeBrowsingClient):
    def __init__(self, error: Exception) -> None:
        super().__init__(api_key="mock_key")
        self.error = error

    async def lookup_url(self, url: str) -> list[str]:
        raise self.error


class FailingVTClient(VirusTotalClient):
    def __init__(self, error: Exception) -> None:
        super().__init__(api_key="mock_key")
        self.error = error

    async def lookup_domain(self, domain: str) -> dict:
        raise self.error


class MockOSINTCache:
    def __init__(self) -> None:
        self.store: dict[str, dict] = {}

    async def get_osint(self, domain: str) -> dict | None:
        return self.store.get(domain)

    async def set_osint(self, domain: str, data: dict, ttl: int = 86400) -> bool:
        self.store[domain] = data
        return True


# ---------------------------------------------------------------------------
# 1. Missing credentials tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gsb_client_missing_credentials_raises():
    client = GoogleSafeBrowsingClient(api_key=None)
    with pytest.raises(ThreatIntelUnavailableError) as exc_info:
        await client.lookup_url("https://example.com")
    assert "API key not configured" in str(exc_info.value)


@pytest.mark.asyncio
async def test_vt_client_missing_credentials_raises():
    client = VirusTotalClient(api_key=None)
    with pytest.raises(ThreatIntelUnavailableError) as exc_info:
        await client.lookup_domain("example.com")
    assert "API key not configured" in str(exc_info.value)


@pytest.mark.asyncio
async def test_threat_intelligence_engine_missing_credentials_unavailable():
    gsb = GoogleSafeBrowsingClient(api_key=None)
    vt = VirusTotalClient(api_key=None)
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt)

    report = await engine.lookup("https://example.com", "example.com")

    assert report.data_completeness is False
    assert len(report.sources) == 2

    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "unavailable"
    assert "API key not configured" in gsb_src.summary

    vt_src = next(s for s in report.sources if s.provider == "VirusTotal")
    assert vt_src.status == "unavailable"
    assert "API key not configured" in vt_src.summary


# ---------------------------------------------------------------------------
# 2. HTTP 401, 429, 500 error responses
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [401, 429, 500])
async def test_gsb_http_errors_raise_unavailable(status_code: int):
    client = GoogleSafeBrowsingClient(api_key="test_key")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=status_code,
            text=f"Error {status_code}",
            request=httpx.Request("POST", "https://example.com"),
        )
        with pytest.raises(ThreatIntelUnavailableError) as exc_info:
            await client.lookup_url("https://example.com")
        assert exc_info.value.status_code == status_code


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [401, 429, 500])
async def test_vt_http_errors_raise_unavailable(status_code: int):
    client = VirusTotalClient(api_key="test_key")
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = httpx.Response(
            status_code=status_code,
            text=f"Error {status_code}",
            request=httpx.Request("GET", "https://example.com"),
        )
        with pytest.raises(ThreatIntelUnavailableError) as exc_info:
            await client.lookup_domain("example.com")
        assert exc_info.value.status_code == status_code


# ---------------------------------------------------------------------------
# 3. Network timeout and connection failures
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gsb_timeout_raises_unavailable():
    client = GoogleSafeBrowsingClient(api_key="test_key")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.TimeoutException("Connection timed out")
        with pytest.raises(ThreatIntelUnavailableError) as exc_info:
            await client.lookup_url("https://example.com")
        assert "timed out" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_vt_connection_error_raises_unavailable():
    client = VirusTotalClient(api_key="test_key")
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.ConnectError("Failed to connect")
        with pytest.raises(ThreatIntelUnavailableError) as exc_info:
            await client.lookup_domain("example.com")
        assert "lookup failed" in str(exc_info.value).lower()


# ---------------------------------------------------------------------------
# 4. Successful clean response
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_threat_intelligence_clean_response():
    gsb = MockGSBClient(findings=[])
    vt = MockVTClient(
        stats={
            "malicious": 0,
            "suspicious": 0,
            "harmless": 50,
            "total_flags": 0,
            "categories": [],
        }
    )
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt)

    report = await engine.lookup("https://safe-site.com", "safe-site.com")

    assert report.data_completeness is True
    assert report.blacklists_triggered == []
    assert report.total_vendor_flags == 0

    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "clean"
    assert gsb_src.summary == "No threats found"

    vt_src = next(s for s in report.sources if s.provider == "VirusTotal")
    assert vt_src.status == "clean"
    assert vt_src.summary == "No security vendors flagged this domain"


# ---------------------------------------------------------------------------
# 5. Successful threat detection
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_threat_intelligence_engine_blacklisted():
    gsb = MockGSBClient(findings=["SOCIAL_ENGINEERING"])
    vt = MockVTClient(
        stats={
            "malicious": 4,
            "suspicious": 1,
            "total_flags": 5,
            "categories": ["phishing"],
        }
    )
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt)

    report = await engine.lookup("https://evil-phish.com", "evil-phish.com")

    assert report.data_completeness is True
    assert "Google Safe Browsing" in report.blacklists_triggered
    assert "VirusTotal" in report.blacklists_triggered
    assert "Phishing" in report.threat_categories
    assert report.total_vendor_flags == 5
    assert report.confidence >= 0.95

    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "detected"
    assert "Phishing" in gsb_src.categories

    vt_src = next(s for s in report.sources if s.provider == "VirusTotal")
    assert vt_src.status == "detected"


# ---------------------------------------------------------------------------
# 6. One provider failing while the other detects a threat
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_one_provider_failing_preserves_threat_detection_vt_detected():
    # GSB fails with 500 error, VT detects malware
    gsb = FailingGSBClient(
        ThreatIntelUnavailableError(
            "Service unavailable (HTTP 500)", status_code=500
        )
    )
    vt = MockVTClient(
        stats={
            "malicious": 4,
            "suspicious": 0,
            "total_flags": 4,
            "categories": ["malware"],
        }
    )
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt)

    report = await engine.lookup("https://dangerous.com", "dangerous.com")

    # Threat detection from VT is NOT erased
    assert "VirusTotal" in report.blacklists_triggered
    assert report.total_vendor_flags == 4
    assert "Malware" in report.threat_categories

    # Combined result is incomplete
    assert report.data_completeness is False

    # Provider statuses reflect individual reality
    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "unavailable"

    vt_src = next(s for s in report.sources if s.provider == "VirusTotal")
    assert vt_src.status == "detected"


@pytest.mark.asyncio
async def test_one_provider_failing_preserves_threat_detection_gsb_detected():
    # VT fails with 401 Unauthorized, GSB detects Phishing
    gsb = MockGSBClient(findings=["SOCIAL_ENGINEERING"])
    vt = FailingVTClient(
        ThreatIntelUnavailableError(
            "Service unavailable (HTTP 401)", status_code=401
        )
    )
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt)

    report = await engine.lookup("https://phish.com", "phish.com")

    # Threat detection from GSB is NOT erased
    assert "Google Safe Browsing" in report.blacklists_triggered
    assert "Phishing" in report.threat_categories

    # Combined result is incomplete
    assert report.data_completeness is False

    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "detected"

    vt_src = next(s for s in report.sources if s.provider == "VirusTotal")
    assert vt_src.status == "unavailable"


# ---------------------------------------------------------------------------
# 7. Redis caching behavior with complete vs incomplete results
# ---------------------------------------------------------------------------


class CountingMockGSBClient(GoogleSafeBrowsingClient):
    def __init__(self) -> None:
        super().__init__(api_key="mock_key")
        self.call_count = 0

    async def lookup_url(self, url: str) -> list[str]:
        self.call_count += 1
        return ["SOCIAL_ENGINEERING"]


@pytest.mark.asyncio
async def test_threat_intelligence_caching_complete():
    gsb = CountingMockGSBClient()
    vt = MockVTClient(
        stats={"malicious": 0, "suspicious": 0, "total_flags": 0, "categories": []}
    )
    cache = MockOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    # First lookup -> executes live query, populates cache
    report1 = await engine.lookup("https://cache-test.com", "cache-test.com")
    assert gsb.call_count == 1
    assert "Google Safe Browsing" in report1.blacklists_triggered
    assert report1.data_completeness is True
    assert "cache-test.com" in cache.store

    # Second lookup -> hits cache, avoids live query
    report2 = await engine.lookup("https://cache-test.com", "cache-test.com")
    assert gsb.call_count == 1  # did not increment!
    assert report2.blacklists_triggered == report1.blacklists_triggered


@pytest.mark.asyncio
async def test_unavailable_results_not_cached_in_redis():
    # Both providers fail or unconfigured
    gsb = FailingGSBClient(ThreatIntelUnavailableError("API key not configured"))
    vt = FailingVTClient(ThreatIntelUnavailableError("API key not configured"))
    cache = MockOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    report = await engine.lookup("https://nocache.com", "nocache.com")

    assert report.data_completeness is False
    # CRITICAL: Must NOT be stored in cache
    assert "nocache.com" not in cache.store


@pytest.mark.asyncio
async def test_existing_incomplete_cache_entry_ignored():
    # If cache has a legacy or corrupted incomplete record, engine should not return it
    cache = MockOSINTCache()
    incomplete_obj = UnifiedThreatObject(
        domain="stale.com",
        data_completeness=False,
    )
    cache.store["stale.com"] = incomplete_obj.model_dump(mode="json")

    gsb = CountingMockGSBClient()
    vt = MockVTClient(
        stats={"malicious": 0, "suspicious": 0, "total_flags": 0, "categories": []}
    )
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    report = await engine.lookup("https://stale.com", "stale.com")
    # Live query was executed because incomplete cache was bypassed
    assert gsb.call_count == 1
    assert report.data_completeness is True


# ---------------------------------------------------------------------------
# 8. ScanService integration test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scan_service_with_threat_intelligence():
    gsb = MockGSBClient(findings=["MALWARE"])
    vt = MockVTClient(
        stats={
            "malicious": 6,
            "suspicious": 0,
            "total_flags": 6,
            "categories": ["malware"],
        }
    )
    threat_intel_engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt)

    scan_service = ScanService(
        security_engine=SecurityEngine(),
        decision_engine=DecisionEngine(),
        threat_intel_engine=threat_intel_engine,
    )

    request = PageAnalysisRequest(
        url="https://malware-distributor.com",  # type: ignore[arg-type]
        title="Download Free Game",
        hostname="malware-distributor.com",
        features=PageFeatures(
            hasPasswordField=False,
            hasLoginForm=False,
            formCount=0,
            externalLinkCount=2,
            iframeCount=1,
            scriptCount=4,
            imageCount=2,
            suspiciousKeywords=[],
            pageTextLength=200,
            hasHttps=True,
            hostnameLength=23,
            subdomainCount=0,
        ),
    )

    response = await scan_service.analyze_page(request)

    assert response.score <= 10
    assert response.severity == "high"
    assert response.decision.action == "block"
    assert response.threat_category == "malware"

    assert response.threat_intelligence is not None
    sources = response.threat_intelligence.sources
    assert len(sources) == 2

    gsb_source = next(s for s in sources if s.provider == "Google Safe Browsing")
    assert gsb_source.status == "detected"
    assert "Malware" in gsb_source.categories

    vt_source = next(s for s in sources if s.provider == "VirusTotal")
    assert vt_source.status == "detected"
    assert "Malware" in vt_source.categories


# ---------------------------------------------------------------------------
# 9. VirusTotal HTTP 404 (unknown domain) handling
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_vt_client_404_raises_unavailable():
    client = VirusTotalClient(api_key="test_key")
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = httpx.Response(
            status_code=404,
            json={"error": {"code": "NotFoundError", "message": "Domain not found"}},
            request=httpx.Request("GET", "https://example.com"),
        )
        with pytest.raises(ThreatIntelUnavailableError) as exc_info:
            await client.lookup_domain("unknown-domain.com")
        assert exc_info.value.status_code == 404
        assert "not found" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_threat_intelligence_engine_vt_404_status_and_completeness():
    gsb = MockGSBClient(findings=[])
    vt = FailingVTClient(
        ThreatIntelUnavailableError(
            "Domain not found on VirusTotal (HTTP 404)", status_code=404
        )
    )
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt)

    report = await engine.lookup("https://unknown-domain.com", "unknown-domain.com")

    # Inconclusive/unavailable provider means combined result is incomplete
    assert report.data_completeness is False

    vt_src = next(s for s in report.sources if s.provider == "VirusTotal")
    assert vt_src.status == "unavailable"
    assert "404" in vt_src.summary or "not found" in vt_src.summary.lower()

    # GSB had clean findings, but overall is incomplete
    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "clean"


@pytest.mark.asyncio
async def test_threat_intelligence_engine_vt_404_with_gsb_detection_preserved():
    # VT returns 404, but GSB detects Social Engineering
    gsb = MockGSBClient(findings=["SOCIAL_ENGINEERING"])
    vt = FailingVTClient(
        ThreatIntelUnavailableError(
            "Domain not found on VirusTotal (HTTP 404)", status_code=404
        )
    )
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt)

    report = await engine.lookup("https://new-phish.com", "new-phish.com")

    # GSB detection is preserved
    assert "Google Safe Browsing" in report.blacklists_triggered
    assert "Phishing" in report.threat_categories

    # Combined result is incomplete
    assert report.data_completeness is False

    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "detected"

    vt_src = next(s for s in report.sources if s.provider == "VirusTotal")
    assert vt_src.status == "unavailable"


@pytest.mark.asyncio
async def test_vt_404_incomplete_result_not_cached_in_redis():
    gsb = MockGSBClient(findings=[])
    vt = FailingVTClient(
        ThreatIntelUnavailableError(
            "Domain not found on VirusTotal (HTTP 404)", status_code=404
        )
    )
    cache = MockOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    report = await engine.lookup("https://unknown-domain.com", "unknown-domain.com")

    assert report.data_completeness is False
    # Must NOT be stored in cache
    assert "unknown-domain.com" not in cache.store
