"""Comprehensive tests for Site Sentry Phase B.3: Database Persistence and History API Privacy.

Covers:
- PersistedURL sanitization (credentials, fragments, sensitive params stripped, benign preserved, no [REDACTED]).
- Malformed/invalid URL persistence rejection.
- DisplayURL read-time sanitization for legacy contaminated database records.
- Safe fallback for unparseable legacy records.
- HistoryService.get_history and HistoryService.get_scan_by_id privacy guarantees.
- Cache-hit persistence with fresh analysis_id and retrieval.
- Database error handling and safe logging (no credentials or tokens logged).
"""

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.models.base import Base
from src.models.domain_reputation import DomainReputation
from src.models.scan import ScanHistory
from src.schemas.analysis import (
    Decision,
    DecisionUI,
    PageAnalysisRequest,
    PageAnalysisResponse,
    PageFeatures,
    ProviderStatusResponse,
    ThreatIntelligenceResponse,
)
from src.services.history_service import HistoryService
from src.services.scan_service import ScanService
from src.utils.url import (
    REDACTION_TOKEN,
    prepare_url_for_display,
    prepare_url_for_persistence,
)

# ==============================================================================
# Fixtures
# ==============================================================================


@pytest.fixture
def test_session_factory():
    """Provides a fresh SQLite in-memory database per test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async def _init_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init_tables())

    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    yield session_factory
    asyncio.run(engine.dispose())


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


def make_mock_response(
    analysis_id: str | None = None,
    score: int = 85,
    severity: str = "low",
    verdict: str = "allow",
) -> PageAnalysisResponse:
    """Helper to construct a valid PageAnalysisResponse."""
    return PageAnalysisResponse(
        analysis_id=analysis_id or str(uuid.uuid4()),
        score=score,
        severity=severity,  # type: ignore[arg-type]
        confidence=0.95,
        threat_category="none",
        recommendations=["Site appears legitimate."],
        factors=["Valid SSL certificate", "No phishing indicators"],
        decision=Decision(
            action=verdict,  # type: ignore[arg-type]
            severity=severity,  # type: ignore[arg-type]
            ui=DecisionUI(color="emerald"),
        ),
        threat_intelligence=ThreatIntelligenceResponse(
            sources=[
                ProviderStatusResponse(
                    provider="GoogleSafeBrowsing",
                    status="clean",
                    categories=[],
                    summary="No threats detected",
                )
            ]
        ),
    )


# ==============================================================================
# 1. PersistedURL Unit Tests
# ==============================================================================


class TestPersistedURL:
    """Test suite for prepare_url_for_persistence."""

    def test_strips_authority_credentials(self):
        url = "https://user:password123@example.com/path"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/path"
        assert "user" not in persisted
        assert "password123" not in persisted

    def test_strips_fragments(self):
        url = "https://example.com/docs/page#section-token"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/docs/page"
        assert "#" not in persisted

    def test_strips_sensitive_parameters(self):
        url = "https://example.com/login?token=secret123&session=xyz&id=42"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/login?id=42"
        assert "secret123" not in persisted
        assert "xyz" not in persisted
        assert REDACTION_TOKEN not in persisted

    def test_strips_bracket_notation_sensitive_parameters(self):
        url = "https://example.com/api?filter[token]=secret_val&user[id]=10"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/api?user[id]=10"
        assert "secret_val" not in persisted
        assert "filter[token]" not in persisted

    def test_strips_percent_encoded_sensitive_parameters(self):
        # %74%6f%6b%65%6e is "token"
        url = "https://example.com/auth?%74%6f%6b%65%6e=encoded_secret&status=ok"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/auth?status=ok"
        assert "encoded_secret" not in persisted

    def test_strips_case_insensitive_sensitive_parameters(self):
        url = "https://example.com/pay?API_KEY=ABCXYZ&item=book"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/pay?item=book"
        assert "ABCXYZ" not in persisted

    def test_preserves_benign_query_parameters_and_ordering(self):
        url = "https://example.com/search?category=books&page=2&sort=asc"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/search?category=books&page=2&sort=asc"

    def test_preserves_duplicate_benign_parameters(self):
        url = "https://example.com/filter?tag=news&tag=tech&tag=ai"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/filter?tag=news&tag=tech&tag=ai"

    def test_preserves_path_case_and_slashes(self):
        url = "https://example.com/Deep/Path/To/Resource/?q=test"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/Deep/Path/To/Resource/?q=test"

    def test_never_contains_redacted_token_when_sensitive_present(self):
        url = "https://example.com/sso?token=secret&apikey=12345"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/sso"
        assert REDACTION_TOKEN not in persisted

    def test_strips_preexisting_redacted_token_in_value(self):
        url = "https://example.com/search?q=[REDACTED]&category=news"
        persisted = prepare_url_for_persistence(url)
        assert persisted == "https://example.com/search?category=news"
        assert REDACTION_TOKEN not in persisted

    def test_rejects_malformed_url_returns_none(self):
        assert prepare_url_for_persistence("not_a_valid_url") is None
        assert prepare_url_for_persistence("ftp://invalid-scheme.com") is None
        assert prepare_url_for_persistence("https://") is None
        assert prepare_url_for_persistence("https://bad\r\nhost.com") is None
        assert prepare_url_for_persistence("") is None


# ==============================================================================
# 2. DisplayURL Unit Tests
# ==============================================================================


class TestDisplayURL:
    """Test suite for prepare_url_for_display."""

    def test_sanitizes_legacy_credentials(self):
        legacy = "https://admin:supersecret@legacy.example.com/dashboard"
        display = prepare_url_for_display(legacy)
        assert display == "https://legacy.example.com/dashboard"
        assert "admin" not in display
        assert "supersecret" not in display

    def test_sanitizes_legacy_fragments(self):
        legacy = "https://legacy.example.com/app#sensitive_jwt_token"
        display = prepare_url_for_display(legacy)
        assert display == "https://legacy.example.com/app"
        assert "sensitive_jwt_token" not in display

    def test_sanitizes_legacy_sensitive_parameters(self):
        legacy = "https://legacy.example.com/view?token=raw_secret&id=123"
        display = prepare_url_for_display(legacy)
        assert display == "https://legacy.example.com/view?id=123"
        assert "raw_secret" not in display

    def test_sanitizes_legacy_redacted_tokens(self):
        legacy = "https://legacy.example.com/view?token=[REDACTED]&page=1"
        display = prepare_url_for_display(legacy)
        assert display == "https://legacy.example.com/view?page=1"
        assert REDACTION_TOKEN not in display

    def test_fallback_on_unparseable_legacy_url(self):
        # A malformed string with credentials or injection characters
        legacy_broken = "https://user:pass@broken-host.com/path\x00extra"
        display = prepare_url_for_display(legacy_broken)
        # Must return safe fallback origin without user:pass
        assert "user:pass" not in display
        assert "\x00" not in display
        assert display.startswith("https://")

    def test_empty_and_none_handling(self):
        assert prepare_url_for_display("") == ""
        assert prepare_url_for_display(None) == ""  # type: ignore


# ==============================================================================
# 3. HistoryService Integration Tests
# ==============================================================================


class TestHistoryServicePrivacy:
    """Integration tests verifying HistoryService read-time sanitization."""

    @pytest.mark.asyncio
    async def test_get_history_sanitizes_legacy_records(self, test_session_factory):
        now = datetime.now(UTC)
        async with test_session_factory() as test_session:
            # Insert raw legacy records with credentials and sensitive query params
            scan1 = ScanHistory(
                id=str(uuid.uuid4()),
                domain="legacy-one.com",
                full_url="https://admin:pass@legacy-one.com/admin?token=secret999&page=1",
                final_security_score=80,
                final_privacy_score=80,
                final_trust_score=80,
                threat_category="none",
                verdict="allow",
                severity="low",
                full_report={"recommendations": [], "factors": []},
                scanned_at=now,
            )
            scan2 = ScanHistory(
                id=str(uuid.uuid4()),
                domain="legacy-two.com",
                full_url="https://legacy-two.com/profile#session_anchor",
                final_security_score=90,
                final_privacy_score=90,
                final_trust_score=90,
                threat_category="none",
                verdict="allow",
                severity="low",
                full_report={"recommendations": [], "factors": []},
                scanned_at=now,
            )
            test_session.add_all([scan1, scan2])
            await test_session.commit()

            # Query history
            result = await HistoryService.get_history(
                db=test_session, limit=10, offset=0
            )
            assert result.total == 2
            urls = [item.url for item in result.items]

            # Verify no credentials, fragments, or secrets exposed in list items
            for url in urls:
                assert "admin:pass" not in url
                assert "token=" not in url
                assert "secret999" not in url
                assert "#session_anchor" not in url
                assert REDACTION_TOKEN not in url

            assert "https://legacy-one.com/admin?page=1" in urls
            assert "https://legacy-two.com/profile" in urls

    @pytest.mark.asyncio
    async def test_get_scan_by_id_sanitizes_legacy_record(self, test_session_factory):
        scan_id = str(uuid.uuid4())
        async with test_session_factory() as test_session:
            scan = ScanHistory(
                id=scan_id,
                domain="legacy-detail.com",
                full_url="https://user:secret@legacy-detail.com/checkout?token=tok123&cart=5#done",
                final_security_score=75,
                final_privacy_score=75,
                final_trust_score=75,
                threat_category="none",
                verdict="allow",
                severity="low",
                full_report={
                    "recommendations": ["Safe"],
                    "factors": ["Good history"],
                    "confidence": 0.9,
                },
                scanned_at=datetime.now(UTC),
            )
            test_session.add(scan)
            await test_session.commit()

            detail = await HistoryService.get_scan_by_id(
                db=test_session, scan_id=scan_id
            )
            assert detail is not None
            assert detail.id == scan_id
            assert detail.url == "https://legacy-detail.com/checkout?cart=5"
            assert "user:secret" not in detail.url
            assert "tok123" not in detail.url
            assert "#done" not in detail.url
            assert REDACTION_TOKEN not in detail.url


# ==============================================================================
# 4. ScanService Persistence & Cache Hit Tests
# ==============================================================================


class TestScanServicePersistence:
    """Test suite for ScanService persistence and cache hit behavior."""

    @pytest.mark.asyncio
    async def test_fresh_scan_persists_sanitized_url(self, test_session_factory):
        """Verify normal scan persists clean PersistedURL without credentials or secrets."""
        cache_mock = AsyncMock()
        cache_mock.get_analysis.return_value = None  # Cache miss

        scan_service = ScanService(cache=cache_mock)
        scan_service.threat_intel_engine.lookup = AsyncMock(return_value=None)  # type: ignore[method-assign]
        scan_service.privacy_engine.analyze = AsyncMock(return_value={})  # type: ignore[method-assign]

        request = _make_request(
            url="https://user:pass@example.com/dashboard?token=xyz123&tab=overview#section",
        )

        async with test_session_factory() as test_session:
            response = await scan_service.analyze_page(request, db=test_session)
            assert response.analysis_id is not None

            # Verify persisted record
            persisted = await test_session.get(ScanHistory, response.analysis_id)
            assert persisted is not None
            assert persisted.full_url == "https://example.com/dashboard?tab=overview"
            assert "user:pass" not in persisted.full_url
            assert "xyz123" not in persisted.full_url
            assert "#section" not in persisted.full_url
            assert REDACTION_TOKEN not in persisted.full_url

            # Verify domain reputation updated
            dom_rep = await test_session.get(DomainReputation, "example.com")
            assert dom_rep is not None
            assert dom_rep.domain == "example.com"

    @pytest.mark.asyncio
    async def test_cache_hit_persists_fresh_analysis_id_and_can_be_retrieved(
        self, test_session_factory
    ):
        """Verify cache hit persists a new scan row with fresh analysis_id and can be retrieved."""
        cached_data = make_mock_response(
            analysis_id="original-stale-id",
            score=92,
            severity="low",
            verdict="allow",
        ).model_dump(mode="json")

        cache_mock = AsyncMock()
        cache_mock.get_analysis.return_value = cached_data

        scan_service = ScanService(cache=cache_mock)

        request = _make_request(
            url="https://example.com/cached-page?token=token_secret&ref=google",
        )

        async with test_session_factory() as test_session:
            # Execute scan with db session provided
            response = await scan_service.analyze_page(request, db=test_session)

            # Fresh analysis_id requirement
            assert response.analysis_id != "original-stale-id"
            fresh_id = response.analysis_id

            # Cached dictionary must not be mutated
            assert cached_data["analysis_id"] == "original-stale-id"

            # Verify scan record was persisted with fresh_id
            persisted = await test_session.get(ScanHistory, fresh_id)
            assert persisted is not None
            assert persisted.id == fresh_id
            assert persisted.full_url == "https://example.com/cached-page?ref=google"
            assert "token_secret" not in persisted.full_url
            assert REDACTION_TOKEN not in persisted.full_url
            assert persisted.final_security_score == 92
            assert persisted.verdict == "allow"

            # Verify retrieval via HistoryService succeeds
            history_item = await HistoryService.get_scan_by_id(
                db=test_session, scan_id=fresh_id
            )
            assert history_item is not None
            assert history_item.id == fresh_id
            assert history_item.url == "https://example.com/cached-page?ref=google"

    @pytest.mark.asyncio
    async def test_malformed_url_rejected_from_persistence_gracefully(
        self, test_session_factory, caplog: pytest.LogCaptureFixture
    ):
        """Verify malformed URL is safely rejected from persistence without failing scan."""
        cache_mock = AsyncMock()
        cache_mock.get_analysis.return_value = None

        scan_service = ScanService(cache=cache_mock)
        scan_service.threat_intel_engine.lookup = AsyncMock(return_value=None)  # type: ignore[method-assign]
        scan_service.privacy_engine.analyze = AsyncMock(return_value={})  # type: ignore[method-assign]

        mock_req = MagicMock(spec=PageAnalysisRequest)
        mock_req.url = "javascript:alert(1)"
        mock_req.hostname = "unknown"
        mock_req.privacy_policy_text = None
        mock_req.third_party_cookie_count = 0
        mock_req.features = {}

        mock_resp = make_mock_response()

        async with test_session_factory() as test_session:
            with caplog.at_level(logging.WARNING):
                await scan_service._persist_scan(test_session, mock_req, mock_resp)

            # Record should not be persisted
            result = await test_session.execute(select(ScanHistory))
            assert len(result.scalars().all()) == 0

        # Warning logged safely without URL
        assert any(
            "Unsafe or malformed URL rejected from persistence" in record.message
            for record in caplog.records
        )
        assert not any("javascript" in record.message for record in caplog.records)

    @pytest.mark.asyncio
    async def test_db_persistence_error_logs_safe_metadata_only(
        self, caplog: pytest.LogCaptureFixture
    ):
        """Verify DB errors during persistence log only safe metadata (analysis_id, domain, error_type)."""
        db_mock = AsyncMock(spec=AsyncSession)
        db_mock.add.side_effect = OperationalError(
            "DB connection failed", None, Exception()
        )

        scan_service = ScanService()
        req = _make_request(
            url="https://user:super_secret_token@example.com/api?token=private_key",
        )
        resp = make_mock_response()

        with caplog.at_level(logging.ERROR):
            await scan_service._persist_scan(db_mock, req, resp)

        db_mock.rollback.assert_awaited_once()

        # Check logs
        error_logs = [r for r in caplog.records if r.levelno == logging.ERROR]
        assert len(error_logs) == 1
        log_msg = error_logs[0].message

        # Must log safe metadata
        assert resp.analysis_id in log_msg
        assert "example.com" in log_msg
        assert "OperationalError" in log_msg

        # Must NEVER contain sensitive tokens, credentials, or raw URL
        assert "super_secret_token" not in log_msg
        assert "private_key" not in log_msg
        assert "user:" not in log_msg
