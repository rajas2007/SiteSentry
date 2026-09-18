from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_analyze_endpoint_valid():
    payload = {
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

    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 100
    assert data["severity"] == "low"
    assert data["decision"]["action"] == "allow"
    assert "analysis_id" in data


def test_analyze_endpoint_invalid_schema():
    payload = {
        "url": "not-a-url",
        # missing fields
    }
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 422
