# 14. API Design & Endpoint Contracts

* **Product:** Site Sentry
* **API Style:** REST over HTTPS (FastAPI)
* **Canonical Path:** `dev/14_API_DESIGN.md`
* **Implementation:** `services/api/src/api/analyze.py`, `services/api/src/api/analytics.py`
* **Pydantic Schemas:** `services/api/src/schemas/analysis.py`, `services/api/src/schemas/scan.py`

---

## 1. Overview & Authoritative Base URL

The Site Sentry backend exposes a RESTful API built on FastAPI with Pydantic v2 validation.

* **Base URL:** `/api/v1`
* **OpenAPI Documentation:** `/docs` (Swagger UI) and `/openapi.json`
* **Health Check:** `GET /health`

> [!IMPORTANT]
> **Endpoint Reconciliation Note:**
> Historical design drafts referenced `/scan/analyze` or `/scan`.
> As verified directly against `services/api/src/api/analyze.py`, the authoritative canonical scan endpoint is **`POST /api/v1/analyze`**.

---

## 2. Core API Endpoints

### 2.1. Page Scan & Analysis: `POST /api/v1/analyze`
Executes real-time, deterministic website analysis. Consumed by the browser extension during page navigation.

#### Request Schema: `PageAnalysisRequest` (`services/api/src/schemas/analysis.py`)
```json
{
  "url": "https://example-phish.com/login",
  "title": "Example Phish Login",
  "hostname": "example-phish.com",
  "features": {
    "hasPasswordField": true,
    "hasLoginForm": true,
    "formCount": 1,
    "externalLinkCount": 8,
    "iframeCount": 0,
    "scriptCount": 3,
    "imageCount": 4,
    "suspiciousKeywords": ["verify", "banking", "secure"],
    "pageTextLength": 450,
    "hasHttps": false,
    "hostnameLength": 18,
    "subdomainCount": 1
  },
  "privacy_policy_text": null,
  "third_party_cookie_count": 2
}
```

* **Constraints:**
  * `url`: Valid `HttpUrl` string (max length 2048).
  * `features`: `PageFeatures` model with camelCase DOM properties extracted by the content script.
  * Sensitive URL query tokens (`token`, `auth`, `password`) should be sanitized prior to transmission per [31. Data Privacy and Retention](./31_DATA_PRIVACY_AND_RETENTION.md).
  * `force_refresh`: Unsupported in active schema; cache-bypass functionality is a proposed future capability under review.

#### Response Schema: `PageAnalysisResponse` (`services/api/src/schemas/analysis.py`)
```json
{
  "analysis_id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  "score": 10,
  "severity": "high",
  "confidence": 0.95,
  "threat_category": "phishing",
  "recommendations": [
    "Leave site immediately."
  ],
  "factors": [
    "Domain is actively blacklisted by: Google Safe Browsing",
    "Missing HTTPS on sensitive page"
  ],
  "decision": {
    "action": "block",
    "severity": "high",
    "ui": {
      "color": "rose"
    }
  },
  "threat_intelligence": {
    "sources": [
      {
        "provider": "Google Safe Browsing",
        "status": "detected",
        "categories": ["Phishing"],
        "summary": "Flagged as dangerous"
      },
      {
        "provider": "VirusTotal",
        "status": "clean",
        "categories": [],
        "summary": "No security vendors flagged this domain"
      }
    ]
  }
}
```

* **Field Specifications:**
  * `analysis_id` (`str`): Unique UUIDv4 string identifier for the scan.
  * `score` (`int`): Normalized fused integer score ($0 - 100$).
  * `severity` (`Literal["low", "medium", "high"]`): Risk severity.
  * `confidence` (`float`): Assessment confidence metric ($0.0 - 1.0$).
  * `threat_category` (`str`): Categorization (`"phishing"`, `"malware"`, `"credential_theft"`, `"elevated_risk"`, `"inconclusive"`, `"safe"`).
  * `decision.action` (`Literal["allow", "warn", "block"]`): Operational directive for client extension.
  * `decision.ui.color` (`Literal["emerald", "amber", "rose", "slate"]`): Client UI presentation color.
  * `threat_intelligence.sources`: Provider status list (`status: Literal["clean", "detected", "unavailable"]`).

---

### 2.2. Scan History: `GET /api/v1/history`
Returns paginated recent scans recorded in the database. Consumed by the Next.js Dashboard.

* **Query Parameters:**
  * `limit` (int, default: 20, max: 100): Page size.
  * `offset` (int, default: 0): Pagination offset.
  * `domain` (optional string): Filter scans by domain name.
* **Response Schema: `ScanHistoryResponse` (`services/api/src/schemas/scan.py`)**
```json
{
  "items": [
    {
      "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      "url": "https://example-phish.com/login",
      "domain": "example-phish.com",
      "score": 10,
      "severity": "high",
      "verdict": "block",
      "threat_category": "phishing",
      "scanned_at": "2026-10-19T18:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### 2.3. Scan Detail Inspection: `GET /api/v1/history/{analysis_id}`
Retrieves full factors, recommendations, and provider responses for a specific scan.

* **Path Parameter:** `analysis_id` (`str`): UUID string.
* **Response Schema: `DetailedScanHistoryResponse` (`services/api/src/schemas/scan.py`)**
  Inherits all fields from `ScanHistoryItem`, adding:
  * `confidence` (`float`)
  * `recommendations` (`list[str]`)
  * `factors` (`list[str]`)
  * `decision` (`dict[str, Any]`)
  * `threat_intelligence` (`dict[str, Any] | None`)

---

### 2.4. Analytics Overview: `GET /api/v1/analytics/overview`
Provides real-time aggregate statistics for the dashboard metrics cards.

* **Response Schema: `AnalyticsOverview` (`services/api/src/schemas/analytics.py`)**
```json
{
  "total_scans": 12480,
  "threats_blocked": 342,
  "suspicious_warned": 819,
  "clean_scans": 11319,
  "inconclusive_scans": 74,
  "provider_availability": {
    "google_safe_browsing": 0.998,
    "virus_total": 0.985
  }
}
```

---

## 3. Implemented vs. Proposed Endpoints

* **Implemented:**
  * `POST /api/v1/analyze`
  * `GET /api/v1/history`
  * `GET /api/v1/history/{analysis_id}`
  * `GET /api/v1/analytics/overview`
  * `GET /health`
* **Proposed / Future Scope (Not Implemented):**
  * `DELETE /api/v1/history`: User-requested scan history deletion per [31. Data Privacy and Retention](./31_DATA_PRIVACY_AND_RETENTION.md).
  * `WS /scan/stream`: WebSocket streaming for async scanning.

---

## 4. Error Handling & Status Codes

* **`400 Bad Request`:** Invalid URL structure or malformed parameters.
* **`404 Not Found`:** Requested scan record does not exist in history.
* **`422 Unprocessable Entity`:** Payload schema validation failure (auto-handled by Pydantic).
* **`429 Too Many Requests`:** Client exceeded rate limits.
* **`500 Internal Server Error`:** Unhandled exception; client enters operational offline state.
