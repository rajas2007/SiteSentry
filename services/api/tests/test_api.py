import pytest
from fastapi.testclient import TestClient

from src.core.database import init_db
from src.main import app


class InMemoryCache:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get_analysis(self, url: str):
        import hashlib
        import json

        norm = url.strip().lower()
        key = hashlib.sha256(norm.encode("utf-8")).hexdigest()
        raw = self.store.get(key)
        return json.loads(raw) if raw else None

    async def set_analysis(self, url: str, data: dict, ttl: int = 3600) -> bool:
        import hashlib
        import json

        norm = url.strip().lower()
        key = hashlib.sha256(norm.encode("utf-8")).hexdigest()
        self.store[key] = json.dumps(data)
        return True

    async def close(self) -> None:
        self.store.clear()


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    import asyncio

    # Ensure tables are created in SQLite
    asyncio.run(init_db())


client = TestClient(app)

SAMPLE_PAYLOAD = {
    "url": "https://secure-site.com",
    "title": "Secure Site",
    "hostname": "secure-site.com",
    "features": {
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
    },
}


def test_health_check():
    with TestClient(app) as test_client:
        response = test_client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


def test_analyze_endpoint_valid():
    with TestClient(app) as test_client:
        response = test_client.post("/api/v1/analyze", json=SAMPLE_PAYLOAD)
        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 100
        assert data["severity"] == "low"
        assert data["decision"]["action"] == "allow"
        assert "analysis_id" in data


def test_analyze_endpoint_invalid_schema():
    with TestClient(app) as test_client:
        payload = {"url": "not-a-url"}
        response = test_client.post("/api/v1/analyze", json=payload)
        assert response.status_code == 422


def test_analyze_caching():
    from src.api.analyze import scan_service

    # Wire in-memory test cache
    original_cache = scan_service.cache
    test_cache = InMemoryCache()
    scan_service.cache = test_cache  # type: ignore

    try:
        with TestClient(app) as test_client:
            payload = {
                **SAMPLE_PAYLOAD,
                "url": "https://cached-example.com",
                "hostname": "cached-example.com",
            }

            # First scan -> cache miss, runs engines & stores in cache
            res1 = test_client.post("/api/v1/analyze", json=payload)
            assert res1.status_code == 200
            data1 = res1.json()

            # Second scan -> cache hit, returns identical analysis_id and score
            res2 = test_client.post("/api/v1/analyze", json=payload)
            assert res2.status_code == 200
            data2 = res2.json()

            assert data1["analysis_id"] == data2["analysis_id"]
            assert data1["score"] == data2["score"]
    finally:
        scan_service.cache = original_cache


def test_scan_history_endpoint():
    with TestClient(app) as test_client:
        # Trigger an analysis to ensure DB record exists
        test_client.post("/api/v1/analyze", json=SAMPLE_PAYLOAD)

        # Retrieve history
        response = test_client.get("/api/v1/history?limit=10&offset=0")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

        first_item = data["items"][0]
        assert "id" in first_item
        assert "url" in first_item
        assert "score" in first_item
        assert "severity" in first_item


def test_scan_history_domain_filter():
    with TestClient(app) as test_client:
        response = test_client.get(
            "/api/v1/history?domain=nonexistent-domain-12345.xyz"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert len(data["items"]) == 0


def test_analyze_endpoint_privacy_fields():
    # Because LLM is mocked or returns unavailable without API key,
    # the tracker logic will still fire and deduct points for tracking cookies.
    with TestClient(app) as test_client:
        payload = {
            **SAMPLE_PAYLOAD,
            "url": "https://privacy-test.com",
            "hostname": "privacy-test.com",
            "privacy_policy_text": "We sell data",
            "third_party_cookie_count": 15,
        }
        response = test_client.post("/api/v1/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()

        # 15 third-party cookies -> High Privacy Risk -> -20 penalty -> score=80 (from 100)
        # However, threat_category might change to "privacy_abuse" if the engine does that
        assert data["score"] <= 80
        assert "High Privacy Risk: Tracking" in data["factors"]

@pytest.mark.asyncio
async def test_get_scan_detail_success(setup_database):
    from src.core.database import get_session_factory
    from src.models.scan import ScanHistory

    # Retrieve a scan from the history first
    history_res = client.get("/api/v1/history?limit=1")
    assert history_res.status_code == 200
    history_data = history_res.json()
    if history_data["items"]:
        scan_id = history_data["items"][0]["id"]

        detail_res = client.get(f"/api/v1/history/{scan_id}")
        assert detail_res.status_code == 200
        detail_data = detail_res.json()

        assert detail_data["id"] == scan_id

        # Verify against the actual stored database record
        session_factory = get_session_factory()
        async with session_factory() as session:
            db_scan = await session.get(ScanHistory, scan_id)
            assert db_scan is not None

            report = db_scan.full_report or {}

            assert detail_data.get("confidence") == report.get("confidence", 0.0)
            assert detail_data.get("factors") == report.get("factors", [])
            assert detail_data.get("recommendations") == report.get("recommendations", [])

            expected_decision = report.get("decision", {
                "action": db_scan.verdict,
                "severity": db_scan.severity,
                "ui": {"color": "slate"}
            })
            assert detail_data.get("decision") == expected_decision
            assert detail_data.get("threat_intelligence") == report.get("threat_intelligence")

def test_get_scan_detail_not_found(setup_database):
    res = client.get("/api/v1/history/non_existent_id")
    assert res.status_code == 404
