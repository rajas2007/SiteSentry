"""Unit tests for Phase B.2.3: Domain OSINT Cache Separation.

Verifies:
1. Two URLs on the same domain with different GSB results receive isolated, correct GSB data (no cross-URL contamination).
2. Domain cache hit reuses VT domain findings without querying VT again, while GSB is evaluated per URL.
3. Privacy skips on one URL do not contaminate other URLs on the same domain.
4. Clean GSB on one URL does not mask malicious GSB on another URL on the same domain (no false negatives).
5. Malicious GSB on one URL does not falsely flag clean URLs on the same domain (no false positives).
6. GSB results are never persisted in the domain OSINT cache.
7. VT failure leaves domain uncacheable, while GSB still executes.
8. GSB failure still allows complete VT domain findings to be cached.
9. Legacy cache entries containing Google Safe Browsing entries are ignored and self-healed.
10. Confidence score and data completeness are synthesized accurately from cached VT and fresh GSB findings.
"""

import pytest

from src.engines.threat_intelligence.engine import ThreatIntelligenceEngine
from src.engines.threat_intelligence.schemas import ProviderStatus, UnifiedThreatObject
from src.integrations.exceptions import ThreatIntelUnavailableError
from src.integrations.safe_browsing.client import GoogleSafeBrowsingClient
from src.integrations.virustotal.client import VirusTotalClient


class DynamicGSBClient(GoogleSafeBrowsingClient):
    """Mock GSB client mapping exact URL strings to threat findings and counting calls."""

    def __init__(self, mapping: dict[str, list[str]] | None = None) -> None:
        super().__init__(api_key="mock_key")
        self.mapping = mapping or {}
        self.call_count = 0
        self.queried_urls: list[str] = []

    async def lookup_url(self, url: str) -> list[str]:
        self.call_count += 1
        self.queried_urls.append(url)
        return self.mapping.get(url, [])


class CountingMockVTClient(VirusTotalClient):
    def __init__(self, stats: dict) -> None:
        super().__init__(api_key="mock_key")
        self.stats = stats
        self.call_count = 0
        self.queried_domains: list[str] = []

    async def lookup_domain(self, domain: str) -> dict:
        self.call_count += 1
        self.queried_domains.append(domain)
        return self.stats


class FailingGSBClient(GoogleSafeBrowsingClient):
    def __init__(self, error: Exception) -> None:
        super().__init__(api_key="mock_key")
        self.error = error
        self.call_count = 0

    async def lookup_url(self, url: str) -> list[str]:
        self.call_count += 1
        raise self.error


class FailingVTClient(VirusTotalClient):
    def __init__(self, error: Exception) -> None:
        super().__init__(api_key="mock_key")
        self.error = error
        self.call_count = 0

    async def lookup_domain(self, domain: str) -> dict:
        self.call_count += 1
        raise self.error


class InMemoryOSINTCache:
    def __init__(self) -> None:
        self.store: dict[str, dict] = {}

    async def get_osint(self, domain: str) -> dict | None:
        return self.store.get(domain)

    async def set_osint(self, domain: str, data: dict, ttl: int = 86400) -> bool:
        self.store[domain] = data
        return True


@pytest.mark.asyncio
async def test_no_cross_url_contamination_false_positive():
    """URL /login is phishing on GSB, but /about is clean.

    Verifies /about does not receive the phishing flag despite sharing the domain cache.
    """
    gsb = DynamicGSBClient(
        mapping={
            "https://example.com/login": ["SOCIAL_ENGINEERING"],
            "https://example.com/about": [],
        }
    )
    vt = CountingMockVTClient(
        stats={"malicious": 0, "suspicious": 0, "total_flags": 0, "categories": []}
    )
    cache = InMemoryOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    # First scan: /login (malicious)
    report_login = await engine.lookup("https://example.com/login", "example.com")
    assert "Google Safe Browsing" in report_login.blacklists_triggered
    assert "Phishing" in report_login.threat_categories
    assert gsb.call_count == 1
    assert vt.call_count == 1

    # Second scan: /about (clean) on same domain
    report_about = await engine.lookup("https://example.com/about", "example.com")
    assert vt.call_count == 1  # Domain cache hit for VT!
    assert gsb.call_count == 2  # GSB queried freshly for /about!

    # CRITICAL: /about must be clean, not contaminated by /login's phishing verdict
    assert "Google Safe Browsing" not in report_about.blacklists_triggered
    assert "Phishing" not in report_about.threat_categories
    gsb_src = next(
        s for s in report_about.sources if s.provider == "Google Safe Browsing"
    )
    assert gsb_src.status == "clean"


@pytest.mark.asyncio
async def test_no_cross_url_contamination_false_negative():
    """URL /about is clean on GSB, then /login is phishing.

    Verifies /login is properly detected as phishing even though domain was cached after /about.
    """
    gsb = DynamicGSBClient(
        mapping={
            "https://example.com/about": [],
            "https://example.com/login": ["SOCIAL_ENGINEERING"],
        }
    )
    vt = CountingMockVTClient(
        stats={"malicious": 0, "suspicious": 0, "total_flags": 0, "categories": []}
    )
    cache = InMemoryOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    # First scan: /about (clean)
    report_about = await engine.lookup("https://example.com/about", "example.com")
    assert "Google Safe Browsing" not in report_about.blacklists_triggered
    assert gsb.call_count == 1
    assert vt.call_count == 1

    # Second scan: /login (malicious) on same domain
    report_login = await engine.lookup("https://example.com/login", "example.com")
    assert vt.call_count == 1  # VT domain cache hit
    assert gsb.call_count == 2  # GSB queried freshly

    # CRITICAL: /login must NOT return clean; phishing must be detected
    assert "Google Safe Browsing" in report_login.blacklists_triggered
    assert "Phishing" in report_login.threat_categories
    gsb_src = next(
        s for s in report_login.sources if s.provider == "Google Safe Browsing"
    )
    assert gsb_src.status == "detected"


@pytest.mark.asyncio
async def test_privacy_skip_not_leaked_across_urls():
    """URL A has sensitive query parameters and skips GSB; URL B has no sensitive params.

    Verifies URL B does NOT inherit skipped_privacy from URL A's domain cache.
    """
    gsb = DynamicGSBClient(mapping={"https://example.com/public": []})
    vt = CountingMockVTClient(
        stats={"malicious": 0, "suspicious": 0, "total_flags": 0, "categories": []}
    )
    cache = InMemoryOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    # First scan: /reset?token=secret123 (GSB skipped for privacy)
    report_priv = await engine.lookup(
        "https://example.com/reset?token=secret123", "example.com"
    )
    gsb_src_priv = next(
        s for s in report_priv.sources if s.provider == "Google Safe Browsing"
    )
    assert gsb_src_priv.status == "skipped_privacy"
    assert gsb.call_count == 0  # skipped
    assert vt.call_count == 1

    # Second scan: /public (benign URL)
    report_public = await engine.lookup("https://example.com/public", "example.com")
    assert vt.call_count == 1  # Domain cache hit
    assert gsb.call_count == 1  # Live query executed for /public

    gsb_src_public = next(
        s for s in report_public.sources if s.provider == "Google Safe Browsing"
    )
    assert gsb_src_public.status == "clean"
    assert gsb_src_public.status != "skipped_privacy"


@pytest.mark.asyncio
async def test_domain_cache_excludes_gsb_data():
    """Verify stored object in domain cache contains only VirusTotal domain findings."""
    gsb = DynamicGSBClient(mapping={"https://example.com/danger": ["MALWARE"]})
    vt = CountingMockVTClient(
        stats={
            "malicious": 4,
            "suspicious": 1,
            "total_flags": 5,
            "categories": ["phishing"],
        }
    )
    cache = InMemoryOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    await engine.lookup("https://example.com/danger", "example.com")

    cached_entry = cache.store.get("example.com")
    assert cached_entry is not None

    # Inspect cached payload
    sources = cached_entry.get("sources", [])
    provider_names = [s.get("provider") for s in sources]
    assert "Google Safe Browsing" not in provider_names
    assert "VirusTotal" in provider_names

    # blacklists_triggered in cache should NOT contain Google Safe Browsing
    assert "Google Safe Browsing" not in cached_entry.get("blacklists_triggered", [])
    assert "VirusTotal" in cached_entry.get("blacklists_triggered", [])


@pytest.mark.asyncio
async def test_legacy_cache_entry_with_gsb_treated_as_miss():
    """Legacy contaminated cache entry containing GSB provider is treated as a miss."""
    cache = InMemoryOSINTCache()
    # Inject a contaminated legacy cache record containing GSB
    legacy_contaminated = UnifiedThreatObject(
        domain="legacy.com",
        blacklists_triggered=["Google Safe Browsing"],
        threat_categories=["Phishing"],
        data_completeness=True,
        sources=[
            ProviderStatus(
                provider="Google Safe Browsing",
                status="detected",
                categories=["Phishing"],
                summary="Flagged as dangerous",
            ),
            ProviderStatus(
                provider="VirusTotal",
                status="clean",
                summary="No security vendors flagged this domain",
            ),
        ],
    )
    cache.store["legacy.com"] = legacy_contaminated.model_dump(mode="json")

    gsb = DynamicGSBClient(mapping={"https://legacy.com/clean-path": []})
    vt = CountingMockVTClient(
        stats={"malicious": 0, "suspicious": 0, "total_flags": 0, "categories": []}
    )
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    # Query clean URL
    report = await engine.lookup("https://legacy.com/clean-path", "legacy.com")

    # Contaminated cache must be bypassed: both VT and GSB must be queried
    assert vt.call_count == 1
    assert gsb.call_count == 1

    # Overwritten cache must now be sanitized (no GSB in cache)
    cached_now = cache.store.get("legacy.com")
    assert cached_now is not None
    assert not any(
        s["provider"] == "Google Safe Browsing" for s in cached_now["sources"]
    )
    assert "Google Safe Browsing" not in cached_now["blacklists_triggered"]

    # Result for clean-path is clean
    assert "Google Safe Browsing" not in report.blacklists_triggered
    gsb_src = next(s for s in report.sources if s.provider == "Google Safe Browsing")
    assert gsb_src.status == "clean"


@pytest.mark.asyncio
async def test_vt_failure_leaves_domain_uncached_gsb_still_executes():
    """When VirusTotal fails, domain data is not cached, but GSB executes normally."""
    gsb = DynamicGSBClient(mapping={"https://vt-fail.com/path": ["SOCIAL_ENGINEERING"]})
    vt = FailingVTClient(ThreatIntelUnavailableError("VT rate limited"))
    cache = InMemoryOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    report = await engine.lookup("https://vt-fail.com/path", "vt-fail.com")

    assert gsb.call_count == 1
    assert vt.call_count == 1
    assert report.data_completeness is False
    assert "Google Safe Browsing" in report.blacklists_triggered

    # Must NOT cache an incomplete domain finding
    assert "vt-fail.com" not in cache.store


@pytest.mark.asyncio
async def test_gsb_failure_allows_vt_domain_to_be_cached():
    """When GSB fails, VirusTotal domain findings are still cached for subsequent requests."""
    gsb = FailingGSBClient(ThreatIntelUnavailableError("GSB connection error"))
    vt = CountingMockVTClient(
        stats={"malicious": 0, "suspicious": 0, "total_flags": 0, "categories": []}
    )
    cache = InMemoryOSINTCache()
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    report1 = await engine.lookup("https://gsb-fail.com/path1", "gsb-fail.com")
    assert report1.data_completeness is False
    assert gsb.call_count == 1
    assert vt.call_count == 1

    # Domain cache MUST store VT because VT was complete
    assert "gsb-fail.com" in cache.store

    # Second lookup: VT should be loaded from cache
    gsb_fixed = DynamicGSBClient(mapping={"https://gsb-fail.com/path2": []})
    engine2 = ThreatIntelligenceEngine(gsb_client=gsb_fixed, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    report2 = await engine2.lookup("https://gsb-fail.com/path2", "gsb-fail.com")
    assert vt.call_count == 1  # Did not query VT again!
    assert gsb_fixed.call_count == 1
    assert report2.data_completeness is True


@pytest.mark.asyncio
async def test_merging_of_categories_and_blacklists():
    """Verifies threat_categories and blacklists_triggered correctly fuse cached VT and live GSB."""
    cache = InMemoryOSINTCache()
    # Cache VT findings with malicious flags
    vt_record = UnifiedThreatObject(
        domain="fused-test.com",
        blacklists_triggered=["VirusTotal"],
        total_vendor_flags=5,
        threat_categories=["Malicious Domain"],
        confidence=0.85,
        data_completeness=True,
        sources=[
            ProviderStatus(
                provider="VirusTotal",
                status="detected",
                categories=["Malicious Domain"],
                summary="Flagged by 5 security vendors",
            )
        ],
    )
    cache.store["fused-test.com"] = vt_record.model_dump(mode="json")

    # Live GSB finds Malware
    gsb = DynamicGSBClient(mapping={"https://fused-test.com/payload": ["MALWARE"]})
    vt = CountingMockVTClient(stats={})
    engine = ThreatIntelligenceEngine(gsb_client=gsb, vt_client=vt, cache=cache)  # type: ignore[arg-type]

    report = await engine.lookup("https://fused-test.com/payload", "fused-test.com")

    # Blacklists from both providers present
    assert "VirusTotal" in report.blacklists_triggered
    assert "Google Safe Browsing" in report.blacklists_triggered

    # Categories from both present
    assert "Malicious Domain" in report.threat_categories
    assert "Malware" in report.threat_categories

    # Confidence calculation: blacklists_triggered present -> 0.95
    assert report.confidence == 0.95
    assert report.data_completeness is True
    assert len(report.sources) == 2
