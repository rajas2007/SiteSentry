import pytest

from src.engines.decision.engine import DecisionEngine
from src.engines.security.engine import SecurityEngine
from src.engines.threat_intelligence.engine import ThreatIntelligenceEngine
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


@pytest.mark.asyncio
async def test_gsb_client_unconfigured_safe():
    client = GoogleSafeBrowsingClient(api_key=None)
    result = await client.lookup_url("https://example.com")
    assert result == []


@pytest.mark.asyncio
async def test_vt_client_unconfigured_safe():
    client = VirusTotalClient(api_key=None)
    result = await client.lookup_domain("example.com")
    assert result["total_flags"] == 0
    assert result["malicious"] == 0


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

    assert "Google Safe Browsing" in report.blacklists_triggered
    assert "VirusTotal" in report.blacklists_triggered
    assert "Phishing" in report.threat_categories
    assert report.total_vendor_flags == 5
    assert report.confidence >= 0.95


class MockOSINTCache:
    def __init__(self) -> None:
        self.store: dict[str, dict] = {}

    async def get_osint(self, domain: str) -> dict | None:
        return self.store.get(domain)

    async def set_osint(self, domain: str, data: dict, ttl: int = 86400) -> bool:
        self.store[domain] = data
        return True


class CountingMockGSBClient(GoogleSafeBrowsingClient):
    def __init__(self) -> None:
        super().__init__(api_key="mock_key")
        self.call_count = 0

    async def lookup_url(self, url: str) -> list[str]:
        self.call_count += 1
        return ["SOCIAL_ENGINEERING"]


@pytest.mark.asyncio
async def test_threat_intelligence_caching():
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

    # Second lookup -> hits cache, avoids live query
    report2 = await engine.lookup("https://cache-test.com", "cache-test.com")
    assert gsb.call_count == 1  # did not increment!
    assert report2.blacklists_triggered == report1.blacklists_triggered


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
