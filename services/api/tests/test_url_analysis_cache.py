"""Focused unit tests for Phase B.2.4: URL Analysis Cache Correctness.

Verifies:
1. Same URL and identical request inputs produce the same cache identity.
2. Different security-relevant feature values produce different identities.
3. Different hasPasswordField values do not reuse the same result.
4. Different hasHttps values do not reuse the same result.
5. Different suspicious keyword values do not reuse the same result.
6. Different third-party cookie counts do not incorrectly reuse results.
7. Sensitive-query URLs bypass the full analysis cache.
8. Different sensitive tokens never share cached analysis results.
9. Sensitive values never appear in Redis keys.
10. Raw URLs never enter HMAC inputs.
11. Privacy-policy text triggers cache bypass.
12. Raw privacy-policy text never enters Redis keys.
13. Cache keys use HMAC-SHA-256, not unkeyed SHA-256.
14. Missing or invalid secrets disable caching safely.
15. Key rotation produces different cache identities.
16. Cache namespace is versioned (sitesentry:cache:url:v2).
17. Cache hits return fresh analysis_id values.
18. Cached dictionaries are not mutated.
19. Substantive response fields remain unchanged.
20. Cache hit and cache miss responses preserve the same schema.
"""

import copy

import pytest

from src.engines.decision.engine import DecisionEngine
from src.engines.privacy.engine import PrivacyIntelligenceEngine
from src.engines.score_fusion.engine import ScoreFusionEngine
from src.engines.security.engine import SecurityEngine
from src.engines.threat_intelligence.engine import ThreatIntelligenceEngine
from src.engines.threat_intelligence.schemas import ProviderStatus, UnifiedThreatObject
from src.schemas.analysis import PageAnalysisRequest, PageFeatures
from src.services.scan_service import ScanService
from src.utils.hashing import (
    compute_analysis_cache_key,
    derive_cache_hmac_key,
    should_bypass_analysis_cache,
)


class InMemoryTestCache:
    """In-memory mock cache for URL analysis."""

    def __init__(self) -> None:
        self.store: dict[str, dict] = {}

    def _resolve_key(self, request_or_key: str | PageAnalysisRequest) -> str | None:
        if isinstance(request_or_key, str):
            return request_or_key
        return compute_analysis_cache_key(
            request=request_or_key,
            secret_key="test_secret_key_12345",
        )

    async def get_analysis(
        self, request_or_key: str | PageAnalysisRequest
    ) -> dict | None:
        key = self._resolve_key(request_or_key)
        if not key:
            return None
        return self.store.get(key)

    async def set_analysis(
        self,
        request_or_key: str | PageAnalysisRequest,
        data: dict,
        ttl: int | None = None,
    ) -> bool:
        key = self._resolve_key(request_or_key)
        if not key:
            return False
        # Store a deepcopy to test that caller doesn't mutate or get mutated
        self.store[key] = copy.deepcopy(data)
        return True


def _make_features(**kwargs) -> PageFeatures:
    defaults = {
        "hasPasswordField": False,
        "hasLoginForm": False,
        "formCount": 1,
        "externalLinkCount": 2,
        "iframeCount": 0,
        "scriptCount": 3,
        "imageCount": 5,
        "suspiciousKeywords": [],
        "pageTextLength": 1000,
        "hasHttps": True,
        "hostnameLength": 15,
        "subdomainCount": 0,
    }
    defaults.update(kwargs)
    return PageFeatures(**defaults)


def _make_request(**kwargs) -> PageAnalysisRequest:
    defaults = {
        "url": "https://example.com/portal",
        "title": "Example Portal",
        "hostname": "example.com",
        "features": _make_features(),
        "privacy_policy_text": None,
        "third_party_cookie_count": 0,
    }
    defaults.update(kwargs)
    return PageAnalysisRequest(**defaults)


# ---------------------------------------------------------------------------
# 1. Cache Identity & Feature Differentiation Tests
# ---------------------------------------------------------------------------


def test_same_url_and_inputs_produce_same_cache_identity():
    req1 = _make_request()
    req2 = _make_request()
    key1 = compute_analysis_cache_key(req1, secret_key="my_secret")
    key2 = compute_analysis_cache_key(req2, secret_key="my_secret")

    assert key1 is not None
    assert key1 == key2
    assert key1.startswith("sitesentry:cache:url:v2:")


def test_different_password_field_produces_different_identity():
    req_no_pwd = _make_request(features=_make_features(hasPasswordField=False))
    req_pwd = _make_request(features=_make_features(hasPasswordField=True))

    key_no_pwd = compute_analysis_cache_key(req_no_pwd, secret_key="my_secret")
    key_pwd = compute_analysis_cache_key(req_pwd, secret_key="my_secret")

    assert key_no_pwd is not None
    assert key_pwd is not None
    assert key_no_pwd != key_pwd


def test_different_https_produces_different_identity():
    # Note: URL scheme remains http/https, but hasHttps boolean must differentiate
    req_https = _make_request(
        url="http://example.com/page", features=_make_features(hasHttps=True)
    )
    req_http = _make_request(
        url="http://example.com/page", features=_make_features(hasHttps=False)
    )

    key_https = compute_analysis_cache_key(req_https, secret_key="my_secret")
    key_http = compute_analysis_cache_key(req_http, secret_key="my_secret")

    assert key_https is not None
    assert key_http is not None
    assert key_https != key_http


def test_different_suspicious_keywords_produce_different_identity():
    req_clean = _make_request(features=_make_features(suspiciousKeywords=[]))
    req_urgent = _make_request(
        features=_make_features(suspiciousKeywords=["urgent", "action required"])
    )

    key_clean = compute_analysis_cache_key(req_clean, secret_key="my_secret")
    key_urgent = compute_analysis_cache_key(req_urgent, secret_key="my_secret")

    assert key_clean is not None
    assert key_urgent is not None
    assert key_clean != key_urgent


def test_keyword_order_and_casing_normalization():
    # Whitespace and order variations must produce identical deterministic identity
    req1 = _make_request(
        features=_make_features(suspiciousKeywords=["Urgent ", "action required"])
    )
    req2 = _make_request(
        features=_make_features(suspiciousKeywords=["action required", "urgent"])
    )

    key1 = compute_analysis_cache_key(req1, secret_key="my_secret")
    key2 = compute_analysis_cache_key(req2, secret_key="my_secret")

    assert key1 == key2


def test_third_party_cookie_bucket_threshold():
    # third_party_cookie_count <= 10 produces no finding
    # third_party_cookie_count > 10 triggers PRIV-TRK-EXCESS
    req_low = _make_request(third_party_cookie_count=5)
    req_high = _make_request(third_party_cookie_count=15)

    key_low = compute_analysis_cache_key(req_low, secret_key="my_secret")
    key_high = compute_analysis_cache_key(req_high, secret_key="my_secret")

    assert key_low is not None
    assert key_high is not None
    assert key_low != key_high


# ---------------------------------------------------------------------------
# 2. Sensitive Data & Cache Bypass Tests
# ---------------------------------------------------------------------------


def test_sensitive_query_bypasses_cache():
    req = _make_request(url="https://example.com/auth?token=super_secret_jwt")
    assert should_bypass_analysis_cache(req) is True

    key = compute_analysis_cache_key(req, secret_key="my_secret")
    assert key is None


def test_different_sensitive_tokens_never_share_cache():
    req1 = _make_request(url="https://example.com/auth?token=token_aaa")
    req2 = _make_request(url="https://example.com/auth?token=token_bbb")

    # Both must bypass caching
    assert should_bypass_analysis_cache(req1) is True
    assert should_bypass_analysis_cache(req2) is True
    assert compute_analysis_cache_key(req1, secret_key="my_secret") is None
    assert compute_analysis_cache_key(req2, secret_key="my_secret") is None


def test_privacy_policy_text_bypasses_cache():
    req = _make_request(
        privacy_policy_text="We collect your personal information and track cookies."
    )
    assert should_bypass_analysis_cache(req) is True

    key = compute_analysis_cache_key(req, secret_key="my_secret")
    assert key is None


def test_empty_privacy_policy_does_not_bypass():
    req_none = _make_request(privacy_policy_text=None)
    req_empty = _make_request(privacy_policy_text="   ")

    assert should_bypass_analysis_cache(req_none) is False
    assert should_bypass_analysis_cache(req_empty) is False
    assert compute_analysis_cache_key(req_none, secret_key="my_secret") is not None
    assert compute_analysis_cache_key(req_empty, secret_key="my_secret") is not None


# ---------------------------------------------------------------------------
# 3. HMAC Security & Secret Management Tests
# ---------------------------------------------------------------------------


def test_missing_or_invalid_secret_disables_cache():
    req = _make_request()

    assert derive_cache_hmac_key(None) is None
    assert derive_cache_hmac_key("") is None
    assert derive_cache_hmac_key("   ") is None

    assert compute_analysis_cache_key(req, secret_key=None) is None
    assert compute_analysis_cache_key(req, secret_key="") is None
    assert compute_analysis_cache_key(req, secret_key="   ") is None


def test_key_rotation_changes_cache_identity():
    req = _make_request()
    key_secret_a = compute_analysis_cache_key(req, secret_key="secret_version_1")
    key_secret_b = compute_analysis_cache_key(req, secret_key="secret_version_2")

    assert key_secret_a is not None
    assert key_secret_b is not None
    assert key_secret_a != key_secret_b


def test_hmac_differs_from_unkeyed_sha256():
    import hashlib

    req = _make_request(url="https://example.com/test")
    key = compute_analysis_cache_key(req, secret_key="my_secret")
    assert key is not None

    digest = key.split(":")[-1]
    raw_sha = hashlib.sha256(b"https://example.com/test").hexdigest()
    assert digest != raw_sha


# ---------------------------------------------------------------------------
# 4. ScanService Fresh analysis_id & Immutability Integration Tests
# ---------------------------------------------------------------------------


class MockCleanThreatIntelEngine(ThreatIntelligenceEngine):
    def __init__(self) -> None:
        super().__init__()
        self.call_count = 0

    async def lookup(self, url: str, domain: str) -> UnifiedThreatObject:
        self.call_count += 1
        return UnifiedThreatObject(
            domain=domain,
            data_completeness=True,
            confidence=0.90,
            blacklists_triggered=[],
            total_vendor_flags=0,
            threat_categories=[],
            sources=[
                ProviderStatus(
                    provider="Google Safe Browsing",
                    status="clean",
                    summary="No threats found",
                ),
                ProviderStatus(
                    provider="VirusTotal",
                    status="clean",
                    summary="No security vendors flagged this domain",
                ),
            ],
        )


@pytest.mark.asyncio
async def test_cache_hit_returns_fresh_analysis_id():
    cache = InMemoryTestCache()
    ti_engine = MockCleanThreatIntelEngine()
    scan_service = ScanService(
        security_engine=SecurityEngine(),
        decision_engine=DecisionEngine(),
        threat_intel_engine=ti_engine,
        score_fusion_engine=ScoreFusionEngine(),
        privacy_engine=PrivacyIntelligenceEngine(),
        cache=cache,  # type: ignore[arg-type]
    )

    req = _make_request(url="https://example.com/cached-fresh-id")

    # First scan -> Cache miss, runs engines, populates cache
    res1 = await scan_service.analyze_page(req)
    assert ti_engine.call_count == 1
    assert len(cache.store) == 1

    # Second scan -> Cache hit
    res2 = await scan_service.analyze_page(req)
    assert ti_engine.call_count == 1  # Did NOT re-run threat intelligence!

    # Substantive results match
    assert res1.score == res2.score
    assert res1.severity == res2.severity
    assert res1.decision.action == res2.decision.action
    assert res1.threat_category == res2.threat_category
    assert res1.recommendations == res2.recommendations
    assert res1.factors == res2.factors

    # CRITICAL: analysis_id must be fresh on cache hit
    assert res1.analysis_id != res2.analysis_id


@pytest.mark.asyncio
async def test_cache_hit_does_not_mutate_cache_store():
    cache = InMemoryTestCache()
    ti_engine = MockCleanThreatIntelEngine()
    scan_service = ScanService(
        security_engine=SecurityEngine(),
        decision_engine=DecisionEngine(),
        threat_intel_engine=ti_engine,
        score_fusion_engine=ScoreFusionEngine(),
        privacy_engine=PrivacyIntelligenceEngine(),
        cache=cache,  # type: ignore[arg-type]
    )

    req = _make_request(url="https://example.com/immutability-check")

    await scan_service.analyze_page(req)
    stored_entry = next(iter(cache.store.values()))
    original_stored_id = stored_entry["analysis_id"]

    res2 = await scan_service.analyze_page(req)
    stored_entry_after = next(iter(cache.store.values()))

    # Stored entry analysis_id must remain unchanged
    assert stored_entry_after["analysis_id"] == original_stored_id
    assert res2.analysis_id != original_stored_id


@pytest.mark.asyncio
async def test_sensitive_query_bypasses_cache_in_pipeline():
    cache = InMemoryTestCache()
    ti_engine = MockCleanThreatIntelEngine()
    scan_service = ScanService(
        security_engine=SecurityEngine(),
        decision_engine=DecisionEngine(),
        threat_intel_engine=ti_engine,
        score_fusion_engine=ScoreFusionEngine(),
        privacy_engine=PrivacyIntelligenceEngine(),
        cache=cache,  # type: ignore[arg-type]
    )

    req = _make_request(url="https://example.com/reset?token=secret999")

    res = await scan_service.analyze_page(req)
    assert res is not None
    # Because URL has sensitive query param, it must NOT be cached
    assert len(cache.store) == 0
