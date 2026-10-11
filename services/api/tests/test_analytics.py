import asyncio
from datetime import datetime, time, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.core.database import get_db
from src.main import app
from src.models.base import Base
from src.models.scan import ScanHistory


@pytest.fixture
def isolated_db(tmp_path):
    """Provides a clean, isolated SQLite test database per test."""
    test_db_file = tmp_path / "test_analytics_isolated.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{test_db_file}", echo=False)

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

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db
    yield session_factory
    app.dependency_overrides.pop(get_db, None)
    asyncio.run(engine.dispose())


@pytest.fixture
def client():
    return TestClient(app)


def _create_scan(
    scan_id: str,
    domain: str = "example.com",
    score: int = 100,
    privacy_score: int | None = None,
    threat_category: str = "safe",
    verdict: str = "allow",
    severity: str = "low",
    scanned_at: datetime | None = None,
) -> ScanHistory:
    now = scanned_at or datetime.now(timezone.utc)
    return ScanHistory(
        id=scan_id,
        domain=domain,
        full_url=f"https://{domain}/page",
        final_security_score=score,
        final_privacy_score=privacy_score,
        final_trust_score=score,
        threat_category=threat_category,
        verdict=verdict,
        severity=severity,
        full_report={},
        scanned_at=now,
    )


def _seed_records(session_factory, records: list[ScanHistory]) -> None:
    async def _insert():
        async with session_factory() as session:
            session.add_all(records)
            await session.commit()

    asyncio.run(_insert())


def test_analytics_empty_database(isolated_db, client):
    """Verifies that an empty database returns a valid schema with zeroed counts and 0.0 average."""
    res = client.get("/api/v1/analytics/overview?days=30")
    assert res.status_code == 200
    data = res.json()

    assert data["period_days"] == 30
    assert data["total_scans"] == 0
    assert data["threats_blocked"] == 0
    assert data["average_trust_score"] == 0.0
    assert data["privacy_violations"] == 0
    assert data["risk_distribution"] == {"low": 0, "medium": 0, "high": 0}
    assert data["verdict_distribution"] == {"allow": 0, "warn": 0, "block": 0}
    assert data["threat_categories"] == []
    assert len(data["timeline"]) == 30

    for point in data["timeline"]:
        assert point["total"] == 0
        assert point["safe"] == 0
        assert point["blocked"] == 0


def test_analytics_mixed_distributions_and_averages(isolated_db, client):
    """Verifies metrics aggregation, average calculations, and risk/verdict distributions."""
    now = datetime.now(timezone.utc)
    _seed_records(isolated_db, [
        _create_scan("scan-1", score=100, verdict="allow", severity="low", threat_category="safe", scanned_at=now),
        _create_scan("scan-2", score=80, verdict="warn", severity="medium", threat_category="elevated_risk", scanned_at=now),
        _create_scan("scan-3", score=20, verdict="block", severity="high", threat_category="credential_theft", scanned_at=now),
    ])

    res = client.get("/api/v1/analytics/overview?days=7")
    assert res.status_code == 200
    data = res.json()

    assert data["period_days"] == 7
    assert data["total_scans"] == 3
    # (100 + 80 + 20) / 3 = 66.666 -> rounded to 66.7
    assert data["average_trust_score"] == 66.7
    assert data["threats_blocked"] == 1
    assert data["risk_distribution"]["low"] == 1
    assert data["risk_distribution"]["medium"] == 1
    assert data["risk_distribution"]["high"] == 1
    assert data["verdict_distribution"]["allow"] == 1
    assert data["verdict_distribution"]["warn"] == 1
    assert data["verdict_distribution"]["block"] == 1

    cats = {c["category"]: c for c in data["threat_categories"]}
    assert len(cats) == 3
    assert cats["safe"]["count"] == 1
    assert cats["safe"]["percentage"] == 33.3
    assert cats["elevated_risk"]["count"] == 1
    assert cats["credential_theft"]["count"] == 1


def test_analytics_blocked_count_deduplication(isolated_db, client):
    """
    Verifies rule: verdict == 'block' OR severity == 'high'.
    Records satisfying both conditions must count once.
    """
    now = datetime.now(timezone.utc)
    _seed_records(isolated_db, [
        # 1. Matches both verdict='block' and severity='high' -> 1 threat blocked
        _create_scan("scan-both", verdict="block", severity="high", scanned_at=now),
        # 2. Matches verdict='block' only -> 1 threat blocked
        _create_scan("scan-verdict-only", verdict="block", severity="medium", scanned_at=now),
        # 3. Matches severity='high' only -> 1 threat blocked
        _create_scan("scan-severity-only", verdict="warn", severity="high", scanned_at=now),
        # 4. Matches neither -> 0
        _create_scan("scan-clean", verdict="allow", severity="low", scanned_at=now),
    ])

    res = client.get("/api/v1/analytics/overview?days=7")
    assert res.status_code == 200
    data = res.json()

    assert data["total_scans"] == 4
    # Ensure deduplicated count is 3, not 4
    assert data["threats_blocked"] == 3


def test_analytics_privacy_violations(isolated_db, client):
    """Verifies that privacy_violations accurately counts records with threat_category == 'privacy_abuse'."""
    now = datetime.now(timezone.utc)
    _seed_records(isolated_db, [
        _create_scan("scan-priv-1", threat_category="privacy_abuse", scanned_at=now),
        _create_scan("scan-priv-2", threat_category="privacy_abuse", scanned_at=now),
        _create_scan("scan-clean", threat_category="safe", scanned_at=now),
    ])

    res = client.get("/api/v1/analytics/overview?days=14")
    assert res.status_code == 200
    data = res.json()

    assert data["privacy_violations"] == 2


def test_analytics_date_filtering_and_window(isolated_db, client):
    """Verifies that only records within the requested N calendar days are counted."""
    now = datetime.now(timezone.utc)
    _seed_records(isolated_db, [
        # Inside 7-day window (today)
        _create_scan("scan-today", scanned_at=now),
        # Inside 7-day window (3 days ago)
        _create_scan("scan-3d", scanned_at=now - timedelta(days=3)),
        # Inside 7-day window (6 days ago)
        _create_scan("scan-6d", scanned_at=now - timedelta(days=6)),
        # OUTSIDE 7-day window (8 days ago)
        _create_scan("scan-8d", scanned_at=now - timedelta(days=8)),
        # OUTSIDE 7-day window (20 days ago)
        _create_scan("scan-20d", scanned_at=now - timedelta(days=20)),
    ])

    res = client.get("/api/v1/analytics/overview?days=7")
    assert res.status_code == 200
    data = res.json()

    assert data["period_days"] == 7
    # Only 3 scans are within the 7-day window
    assert data["total_scans"] == 3
    assert len(data["timeline"]) == 7


def test_analytics_continuous_timeline_with_zero_days(isolated_db, client):
    """Verifies continuous chronological daily buckets including zero-count days."""
    now = datetime.now(timezone.utc)
    today = now.date()
    four_days_ago = datetime.combine(today - timedelta(days=4), time(12, 0)).replace(tzinfo=timezone.utc)

    _seed_records(isolated_db, [
        _create_scan("scan-today", verdict="allow", severity="low", scanned_at=now),
        _create_scan("scan-4d", verdict="block", severity="high", scanned_at=four_days_ago),
    ])

    res = client.get("/api/v1/analytics/overview?days=5")
    assert res.status_code == 200
    data = res.json()

    timeline = data["timeline"]
    assert len(timeline) == 5

    # Check continuity of dates
    for i in range(5):
        expected_date = (today - timedelta(days=4 - i)).strftime("%Y-%m-%d")
        assert timeline[i]["date"] == expected_date

    # First point (4 days ago) has the blocked scan
    assert timeline[0]["total"] == 1
    assert timeline[0]["safe"] == 0
    assert timeline[0]["blocked"] == 1

    # Middle points (3, 2, 1 days ago) have zero scans
    for i in [1, 2, 3]:
        assert timeline[i]["total"] == 0
        assert timeline[i]["safe"] == 0
        assert timeline[i]["blocked"] == 0

    # Last point (today) has the allowed safe scan
    assert timeline[4]["total"] == 1
    assert timeline[4]["safe"] == 1
    assert timeline[4]["blocked"] == 0


def test_analytics_preserves_unknown_categories_and_severities(isolated_db, client):
    """Verifies that unknown severities/categories are preserved and not silently reclassified."""
    now = datetime.now(timezone.utc)
    _seed_records(isolated_db, [
        _create_scan(
            "scan-unknown",
            verdict="quarantine",
            severity="critical",
            threat_category="zero_day_exploit",
            scanned_at=now,
        )
    ])

    res = client.get("/api/v1/analytics/overview?days=7")
    assert res.status_code == 200
    data = res.json()

    assert data["risk_distribution"]["critical"] == 1
    assert data["risk_distribution"]["low"] == 0
    assert data["verdict_distribution"]["quarantine"] == 1
    assert data["verdict_distribution"]["allow"] == 0

    cats = [c["category"] for c in data["threat_categories"]]
    assert "zero_day_exploit" in cats


def test_analytics_handles_null_final_privacy_score(isolated_db, client):
    """Verifies that scans with final_privacy_score=None (standard in legacy records) compute smoothly."""
    now = datetime.now(timezone.utc)
    _seed_records(isolated_db, [
        _create_scan("scan-null-priv", privacy_score=None, scanned_at=now)
    ])

    res = client.get("/api/v1/analytics/overview?days=7")
    assert res.status_code == 200
    data = res.json()
    assert data["total_scans"] == 1


def test_analytics_invalid_days_parameter(client):
    """Verifies validation constraints: days must be between 1 and 365."""
    res_zero = client.get("/api/v1/analytics/overview?days=0")
    assert res_zero.status_code == 422

    res_negative = client.get("/api/v1/analytics/overview?days=-10")
    assert res_negative.status_code == 422

    res_exceeded = client.get("/api/v1/analytics/overview?days=366")
    assert res_exceeded.status_code == 422

    res_string = client.get("/api/v1/analytics/overview?days=invalid")
    assert res_string.status_code == 422
