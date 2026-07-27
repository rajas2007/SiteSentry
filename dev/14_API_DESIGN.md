# 14 API Design

## 1. Overview
The TrustLens AI Backend exposes a RESTful API built with FastAPI. It uses JSON for serialization and JWT (JSON Web Tokens) for authentication.

## 2. Base URL
`https://api.trustlens.ai/v1`

## 3. Authentication
All endpoints except `/auth/*` and public health checks require a Bearer token.
`Authorization: Bearer <token>`

## 4. Core Endpoints

### 4.1. Scan API
**`POST /scan/analyze`**
Triggers a real-time analysis of a URL.

**Request Body:**
```json
{
  "url": "https://example-phish.com/login",
  "dom_context": {
    "has_password_field": true,
    "hidden_iframes_count": 1,
    "third_party_scripts": ["https://evil-tracker.com/track.js"]
  },
  "force_refresh": false
}
```

**Response (200 OK):**
```json
{
  "scan_id": "uuid-1234",
  "status": "completed",
  "scores": {
    "security": 20,
    "privacy": 45,
    "trust": 15
  },
  "recommendation": "CRITICAL RISK: Do not enter credentials. Highly likely phishing.",
  "explanations": {
    "security": [
      "Domain registered 2 days ago.",
      "Contains password fields but no valid SSL.",
      "Flagged by 2 security vendors."
    ],
    "privacy": [
      "Detected 5 tracking scripts."
    ]
  },
  "is_partial": false
}
```
*Note: If `is_partial` is true, the LLM policy analysis is still running in the background.*

### 4.2. Dashboard Analytics APIs
**`GET /history`**
Retrieves the user's scan history.
- **Query Params:** `limit=50`, `offset=0`, `risk_level=high`

**`GET /analytics/summary`**
Retrieves aggregated stats for the dashboard.
- **Response:**
```json
{
  "total_scans": 1450,
  "threats_blocked": 12,
  "trackers_blocked": 450,
  "average_trust_score": 82
}
```

### 4.3. User & Settings
**`GET /users/me`** - Get current user profile.
**`PUT /users/me/settings`** - Update settings (strict mode, alerts).

## 5. WebSockets (Future Scope)
For truly real-time streaming of LLM privacy policy summarization or long-running OSINT scans, a WebSocket endpoint can be implemented:
**`WS /scan/stream`**

## 6. Error Handling
Standard HTTP status codes are used. Error responses follow RFC 7807 (Problem Details).
```json
{
  "detail": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60
}
```

## 7. OpenAPI Specification
FastAPI automatically generates a Swagger UI and OpenAPI JSON schema at `/docs` and `/openapi.json`. This schema is used to automatically generate TypeScript types for the extension and dashboard using `openapi-typescript-codegen`.
