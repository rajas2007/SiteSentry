from unittest.mock import patch

import pytest

from src.engines.machine_learning.engine import MLFeatureExtractor
from src.engines.score_fusion.engine import ScoreFusionEngine
from src.engines.threat_intelligence.engine import ThreatIntelligenceEngine
from src.engines.threat_intelligence.schemas import ProviderStatus, UnifiedThreatObject
from src.integrations.exceptions import ThreatIntelUnavailableError
from src.integrations.safe_browsing.client import GoogleSafeBrowsingClient
from src.integrations.virustotal.client import VirusTotalClient
from src.schemas.analysis import PageAnalysisRequest, PageFeatures
from src.services.scan_service import ScanService
from src.utils.url import (
    DEFAULT_SENSITIVE_PARAMS,
    has_sensitive_parameters,
    prepare_url_for_provider,
)


class MockGSBClient(GoogleSafeBrowsingClient):
    def __init__(self, findings: list[str] | None = None) -> None:
        super().__init__(api_key="mock_key")
        self.findings = findings if findings is not None else []
        self.call_count = 0
        self.last_url: str | None = None

    async def lookup_url(self, url: str) -> list[str]:
        self.call_count += 1
        self.last_url = url
        return self.findings


class MockVTClient(VirusTotalClient):
    def __init__(self, stats: dict | None = None) -> None:
        super().__init__(api_key="mock_key")
        self.stats = (
            stats
            if stats is not None
            else {
                "malicious": 0,
                "suspicious": 0,
                "harmless": 70,
                "total_flags": 0,
                "categories": [],
            }
        )
        self.call_count = 0
        self.last_domain: str | None = None

    async def lookup_domain(self, domain: str) -> dict:
        self.call_count += 1
        self.last_domain = domain
        return self.stats


# ---------------------------------------------------------------------------
# 1. Sensitive Parameter Detection Tests
# ---------------------------------------------------------------------------


def test_has_sensitive_parameters_plain_keys():
    for param in DEFAULT_SENSITIVE_PARAMS:
        url = f"https://example.com/path?{param}=supersecret"
        assert has_sensitive_parameters(url) is True, f"Failed to detect {param}"


def test_has_sensitive_parameters_encoded_keys():
    # %74%6f%6b%65%6e == "token"
    assert (
        has_sensitive_parameters("https://example.com/api?%74%6f%6b%65%6e=123") is True
    )
    # Double-encoded: %2574%256f%256b%2565%256e
    assert (
        has_sensitive_parameters(
            "https://example.com/api?%2574%256f%256b%2565%256e=123"
        )
        is True
    )


def test_has_sensitive_parameters_bracketed_keys():
    assert (
        has_sensitive_parameters("https://example.com/auth?user[password]=secret")
        is True
    )
    assert (
        has_sensitive_parameters("https://example.com/auth?auth[token]=secret") is True
    )
    assert (
        has_sensitive_parameters(
            "https://example.com/auth?oauth%5Baccess_token%5D=secret"
        )
        is True
    )


def test_has_sensitive_parameters_valueless():
    assert has_sensitive_parameters("https://example.com/login?token") is True
    assert has_sensitive_parameters("https://example.com/login?auth&debug=1") is True


def test_has_sensitive_parameters_benign():
    assert (
        has_sensitive_parameters("https://example.com/search?q=shoes&page=2&limit=50")
        is False
    )
    assert has_sensitive_parameters("https://example.com/article/123") is False
    assert has_sensitive_parameters("https://example.com/") is False
    assert has_sensitive_parameters("") is False


# ---------------------------------------------------------------------------
# 2. prepare_url_for_provider Tests
# ---------------------------------------------------------------------------


def test_prepare_url_for_provider_returns_none_for_sensitive_params():
    assert prepare_url_for_provider("https://example.com/login?token=abc") is None
    assert (
        prepare_url_for_provider("https://example.com/api?api_key=secret&id=1") is None
    )
    assert (
        prepare_url_for_provider("https://example.com/auth?auth[token]=secret") is None
    )
    assert (
        prepare_url_for_provider("https://example.com/api?%74%6f%6b%65%6e=abc") is None
    )


def test_prepare_url_for_provider_returns_none_for_redacted_urls():
    # Redacted URLs must NEVER be dispatched to GSB
    assert (
        prepare_url_for_provider("https://example.com/login?token=[REDACTED]") is None
    )
    assert (
        prepare_url_for_provider("https://example.com/checkout?user=[REDACTED]&item=5")
        is None
    )


def test_prepare_url_for_provider_strips_credentials_and_fragments():
    url = "https://user:pass@example.com/search?q=laptops#reviews"
    prepared = prepare_url_for_provider(url)
    assert prepared == "https://example.com/search?q=laptops"
    assert "user" not in prepared
    assert "pass" not in prepared
    assert "#reviews" not in prepared


def test_prepare_url_for_provider_preserves_path_case_and_query_semantics():
    url = "https://example.com/Api/V2/Search?category=Books&tag=Fiction&category=Audio"
    prepared = prepare_url_for_provider(url)
    # Path case strictly preserved
    assert "/Api/V2/Search" in prepared
    # Query ordering and duplicate keys strictly preserved
    assert "category=Books&tag=Fiction&category=Audio" in prepared


# ---------------------------------------------------------------------------
# 3. ThreatIntelligenceEngine GSB Privacy Skip Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_threat_intel_skips_gsb_when_sensitive_query_present():
    gsb = MockGSBClient(findings=["SOCIAL_ENGINEERING"])
    vt = MockVTClient()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=None)

    report = await engine.lookup(
        url="https://example.com/reset?token=secret123",
        domain="example.com",
    )

    # GSB client must not have been queried
    assert gsb.call_count == 0
    # VT client was queried with domain
    assert vt.call_count == 1
    assert vt.last_domain == "example.com"

    # Provider status checks
    assert len(report.sources) == 2
    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "skipped_privacy"
    assert gsb_src.summary == "Lookup skipped for privacy protection"
    assert gsb_src.categories == []

    # Completeness is preserved because skip was an intentional policy decision and VT succeeded
    assert report.data_completeness is True
    assert report.confidence == 0.90


@pytest.mark.asyncio
async def test_threat_intel_queries_gsb_when_no_sensitive_query():
    gsb = MockGSBClient(findings=[])
    vt = MockVTClient()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=None)

    report = await engine.lookup(
        url="https://user:pass@example.com/products?id=123#spec",
        domain="example.com",
    )

    # GSB client was queried with sanitized URL (credentials/fragment stripped)
    assert gsb.call_count == 1
    assert gsb.last_url == "https://example.com/products?id=123"

    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "clean"
    assert gsb_src.summary == "No threats found"
    assert report.data_completeness is True


@pytest.mark.asyncio
async def test_threat_intel_distinguishes_privacy_skip_from_outage():
    # When GSB is skipped for privacy and VT fails: data_completeness is False due to VT outage
    gsb = MockGSBClient()
    vt = MockVTClient()
    with patch.object(
        vt,
        "lookup_domain",
        side_effect=ThreatIntelUnavailableError("Connection failed"),
    ):
        engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=None)
        report = await engine.lookup(
            url="https://example.com/login?token=abc",
            domain="example.com",
        )

        assert gsb.call_count == 0
        gsb_src = next(
            s for s in report.sources if s.provider == "Google Safe Browsing"
        )
        assert gsb_src.status == "skipped_privacy"

        vt_src = next(s for s in report.sources if s.provider == "VirusTotal")
        assert vt_src.status == "unavailable"
        assert report.data_completeness is False


@pytest.mark.asyncio
async def test_provider_exception_summaries_are_cleanly_sanitized():
    gsb = MockGSBClient()
    vt = MockVTClient()

    # Test that exception summary mapping never leaks sensitive details or raw URLs
    with patch.object(
        gsb,
        "lookup_url",
        side_effect=ThreatIntelUnavailableError(
            "HTTP error 500 requesting https://example.com/secret?key=123"
        ),
    ):
        engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=None)
        report = await engine.lookup("https://example.com/test", "example.com")
        gsb_src = next(
            s for s in report.sources if s.provider == "Google Safe Browsing"
        )
        assert gsb_src.status == "unavailable"
        assert "secret" not in gsb_src.summary
        assert "key=123" not in gsb_src.summary
        assert gsb_src.summary == "Service unavailable"


# ---------------------------------------------------------------------------
# 4. Score Fusion Integration with skipped_privacy
# ---------------------------------------------------------------------------


def test_score_fusion_with_skipped_privacy_does_not_penalize_score():
    fusion_engine = ScoreFusionEngine()

    threat_intel = UnifiedThreatObject(
        domain="example.com",
        data_completeness=True,
        confidence=0.90,
        sources=[
            ProviderStatus(
                provider="Google Safe Browsing",
                status="skipped_privacy",
                categories=[],
                summary="Lookup skipped for privacy protection",
            ),
            ProviderStatus(
                provider="VirusTotal",
                status="clean",
                categories=[],
                summary="No security vendors flagged this domain",
            ),
        ],
    )

    result = fusion_engine.fuse(
        security_signals=[
            {
                "id": "https_enabled",
                "description": "Connection is encrypted using HTTPS",
            }
        ],
        threat_intel=threat_intel,
    )

    assert result["score"] == 100
    assert (
        "Google Safe Browsing lookup skipped for privacy protection"
        in result["factors"]
    )
    assert (
        "Threat intelligence data is incomplete or unavailable" not in result["factors"]
    )
    assert result["data_completeness"] is True


# ---------------------------------------------------------------------------
# 5. Machine Learning Feature Extractor with skipped_privacy
# ---------------------------------------------------------------------------


def test_ml_feature_extractor_handles_skipped_privacy():
    extractor = MLFeatureExtractor()
    req = PageAnalysisRequest(
        url="https://example.com/account?token=secret123",
        hostname="example.com",
        title="Account",
        features=PageFeatures(
            hasHttps=True,
            hostnameLength=11,
            urlLength=44,
            subdomainCount=0,
            hasPasswordField=False,
            hasLoginForm=False,
            formCount=0,
            externalLinkCount=0,
            iframeCount=0,
            scriptCount=0,
            imageCount=0,
            suspiciousKeywords=[],
            pageTextLength=100,
        ),
    )

    threat_intel = UnifiedThreatObject(
        domain="example.com",
        sources=[
            ProviderStatus(
                provider="Google Safe Browsing",
                status="skipped_privacy",
                summary="Lookup skipped for privacy protection",
            ),
            ProviderStatus(
                provider="VirusTotal",
                status="clean",
                summary="Clean",
            ),
        ],
    )

    vector = extractor.extract(req, security_signals=[], threat_intel=threat_intel)
    assert vector.gsb_available == 0
    assert vector.gsb_detected == 0
    assert vector.vt_available == 1


# ---------------------------------------------------------------------------
# 6. End-to-End ScanService with Sensitive Ingestion & GSB Privacy Skip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scan_service_end_to_end_privacy_skip():
    gsb = MockGSBClient()
    vt = MockVTClient()
    ti_engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=None)
    scan_service = ScanService(threat_intel_engine=ti_engine)

    # Ingestion receives raw URL with sensitive query parameter
    req = PageAnalysisRequest(
        url="https://example.com/reset?token=supersecret123&cart=42",
        hostname="example.com",
        title="Password Reset",
        features=PageFeatures(
            hasHttps=True,
            hostnameLength=11,
            urlLength=56,
            subdomainCount=0,
            hasPasswordField=True,
            hasLoginForm=True,
            formCount=1,
            externalLinkCount=0,
            iframeCount=0,
            scriptCount=1,
            imageCount=0,
            suspiciousKeywords=[],
            pageTextLength=100,
        ),
    )

    # Ingestion validator replaced sensitive parameter with [REDACTED]
    assert "[REDACTED]" in str(req.url)
    assert "supersecret123" not in str(req.url)

    # Execute scan analysis
    response = await scan_service.analyze_page(req)

    # GSB was skipped for privacy
    assert gsb.call_count == 0
    assert response.threat_intelligence is not None
    assert response.threat_intelligence.sources is not None
    gsb_src = next(
        s
        for s in response.threat_intelligence.sources
        if s.provider == "Google Safe Browsing"
    )
    assert gsb_src.status == "skipped_privacy"
    assert gsb_src.summary == "Lookup skipped for privacy protection"

    # Score fusion explanatory factor was appended
    assert (
        "Google Safe Browsing lookup skipped for privacy protection" in response.factors
    )
