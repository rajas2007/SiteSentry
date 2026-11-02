# Site Sentry

> **Explainable AI for Intelligent Website Security, Privacy & Trust Analysis**

Site Sentry is a privacy-first web security platform consisting of an **MV3 Chrome Browser Extension**, a **FastAPI Analysis Engine**, and a **Next.js Real-Time Security Operations Dashboard**.

---

## 1. System Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │               Chrome Browser                 │
                    │                                              │
                    │   ┌────────────────┐   ┌─────────────────┐   │
                    │   │ Content Script │   │ Extension Popup │   │
                    │   └───────┬────────┘   └────────┬────────┘   │
                    │           │ (Sanitized URL,     │            │
                    │           │  DOM Features)      │            │
                    │           ▼                     ▼            │
                    │   ┌──────────────────────────────────────┐   │
                    │   │      Background Service Worker       │   │
                    │   │  (ADR-005 Warnings, Session Storage) │   │
                    │   └──────────────────┬───────────────────┘   │
                    └──────────────────────┼───────────────────────┘
                                           │ POST /api/v1/analyze
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           Site Sentry API                                │
│                                                                          │
│  ┌────────────────────┐   ┌────────────────────┐   ┌──────────────────┐  │
│  │ Ingestion & URL    │──▶│ Threat Intel       │──▶│ Score Fusion &   │  │
│  │ Sanitization Layer │   │ (GSB & VirusTotal) │   │ Decision Engine  │  │
│  └────────────────────┘   └────────────────────┘   └────────┬─────────┘  │
│                                                             │            │
│     ┌───────────────────────────────────────────────────────┼────────┐   │
│     │ Caching & Persistence                                 │        │   │
│     │   ├── Redis: Keyed HMAC-SHA-256 analysis cache        ▼        │   │
│     │   └── PostgreSQL: PersistedURL audit records   [Verdict Output]│   │
│     └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────┬───────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Next.js Operations Console                        │
│                                                                          │
│   • Live Scanner (Pre-dispatch Client URL Sanitization)                  │
│   • Threat Audit Ledger (DisplayURL Defense-in-Depth, CSV DDE Defense)   │
│   • Real-Time Threat Intelligence & Analytics Breakdown                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Repository Structure

```
.
├── apps/
│   ├── dashboard/              # Next.js 14 operations dashboard & console
│   └── extension/              # Chrome Extension (Manifest V3, Vite + React)
├── services/
│   └── api/                    # FastAPI backend (threat intelligence, ML, fusion)
├── packages/
│   └── shared-types/           # Shared TypeScript interfaces and contracts
├── docker-compose.yml          # Production-grade multi-service orchestration
└── docker-compose.dev.yml      # Local development compose configuration
```

---

## 3. Security & Privacy Invariants

The platform adheres to strict privacy and data-protection invariants established in Phases B.1–B.5:

1. **Authority Credentials**: Usernames and passwords (`user:pass@`) are stripped at the Content Script, Backend Ingestion, Database Persistence, History APIs, and Dashboard. Credentials never enter logs or cache keys.
2. **URL Fragments**: URL fragments (`#...`) are removed per RFC 7230 §5.1 at all boundaries. Tokens in fragments (`#access_token=...`) are never transmitted or stored.
3. **Sensitive Query Parameters**: Parameter names matching sensitive tokens (including casing variants, iterative percent-encoding like `%74oken`, and bracket notation `filter[token]`) are stripped from persistence and exports.
4. **Analysis Cache Keying**: Redis analysis cache uses HMAC-SHA-256 with a domain-separated derived secret key. Requests with sensitive query parameters bypass caching automatically (`bypass_reason="sensitive_query_parameters"`).
5. **Freshness on Cache Hits**: Cache hits generate fresh `analysis_id` values and timestamps without mutating cached records.
6. **ADR-005 Compliance**: Safe (`allow`), cautionary (`warn`), and inconclusive verdicts **never** inject overlays into the webpage DOM. High-risk verdicts (`block`) redirect the tab to an isolated warning interstitial (`chrome-extension://<id>/pages/warning.html?id=<opaque-uuid>`).
7. **CSV Injection Defense**: Dashboard exports sanitize cell values starting with `=, +, -, @, \t, \r` via `escapeCsvCell()` to prevent Dynamic Data Exchange (DDE) formula execution in Excel/Sheets.

---

## 4. Environment Configuration

### Backend (`services/api/.env`)

| Variable | Description | Default | Required in Production |
| :--- | :--- | :--- | :---: |
| `API_ENV` | Application environment (`development` or `production`) | `development` | Yes |
| `API_HOST` | Host address to bind the API server | `127.0.0.1` | No |
| `API_PORT` | Port number to bind the API server | `8000` | No |
| `DATABASE_URL` | Async database URL (`postgresql+asyncpg://...` or `sqlite+aiosqlite:///...`) | SQLite default | Yes (PostgreSQL) |
| `REDIS_URL` | Redis connection URL for caching and rate limiting | `redis://localhost:6379/0` | Yes |
| `REDIS_CACHE_TTL_SECONDS` | TTL for cached URL analysis results in seconds | `3600` | No |
| `SECRET_KEY` | High-entropy secret (>= 32 chars) for HMAC cache derivation | `default_development_secret` | **Yes (Enforced)** |
| `CORS_ORIGINS` | Comma-separated allowed origins (e.g. `https://dash.domain.com,chrome-extension://<id>`) | `*` | **Yes** |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Optional API key for Google Safe Browsing v4 | `None` | No |
| `VIRUSTOTAL_API_KEY` | Optional API key for VirusTotal v3 API | `None` | No |
| `THREAT_INTEL_TIMEOUT_SECONDS` | Timeout in seconds for external threat intelligence calls | `2.5` | No |

> [!IMPORTANT]
> When `API_ENV=production`, the server will refuse to start if `SECRET_KEY` is missing, default, or less than 32 characters.

### Dashboard (`apps/dashboard/.env.local`)

| Variable | Description | Default | Required in Production |
| :--- | :--- | :--- | :---: |
| `NEXT_PUBLIC_API_URL` | Public URL of the Site Sentry Backend API | `http://localhost:8000` | Yes |

### Chrome Extension (`apps/extension/.env`)

| Variable | Description | Default | Required in Production |
| :--- | :--- | :--- | :---: |
| `VITE_API_BASE_URL` | Backend API URL used during the Vite production build | `http://localhost:8000` | Yes |

---

## 5. Local Development Setup

### Option A: Native Development

#### 1. Backend
```bash
# Navigate to backend directory
cd services/api

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies in editable mode
pip install -e .

# Run tests
pytest tests

# Start API development server
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

#### 2. Dashboard
```bash
# Navigate to dashboard directory
cd apps/dashboard

# Install dependencies
npm install

# Run tests & typecheck
npm test
npm run typecheck

# Start Next.js development server
npm run dev
# Dashboard available at http://localhost:3000
```

#### 3. Extension
```bash
# Navigate to extension directory
cd apps/extension

# Install dependencies
npm install

# Run tests & build
npm test
npm run build
# Built extension files generated in apps/extension/dist/
```

### Option B: Docker Compose

```bash
# Copy template environment file
cp .env.example .env

# Start all services (PostgreSQL, Redis, API, Dashboard)
docker-compose up -d

# Verify service health
docker-compose ps
```

---

## 6. Production Deployment Instructions

### A. Backend API Deployment

1. **Configure Environment**:
   Ensure `API_ENV=production`, configure a high-entropy `SECRET_KEY` (minimum 32 characters), set `DATABASE_URL` to your PostgreSQL instance, set `REDIS_URL`, and specify your `CORS_ORIGINS`.
2. **Container Build**:
   ```bash
   docker build -t sitesentry-api:latest services/api
   ```
3. **Run Container**:
   ```bash
   docker run -d \
     --name sitesentry-api \
     -p 8000:8000 \
     --env-file services/api/.env \
     sitesentry-api:latest
   ```
4. **Health Check Verification**:
   ```bash
   curl -f http://localhost:8000/health
   # Expected response: {"status": "healthy"}
   ```

### B. Dashboard Deployment

1. **Configure Environment**:
   Set `NEXT_PUBLIC_API_URL` to the public HTTPS URL of your deployed Backend API.
2. **Build and Start**:
   ```bash
   cd apps/dashboard
   npm install --production=false
   npm run build
   npm start
   ```
3. **Container Deployment**:
   ```bash
   docker build -t sitesentry-dashboard:latest apps/dashboard
   docker run -d \
     --name sitesentry-dashboard \
     -p 3000:3000 \
     -e NEXT_PUBLIC_API_URL="https://api.yourdomain.com" \
     sitesentry-dashboard:latest
   ```

### C. Chrome Extension Packaging & Installation

1. **Configure Target API**:
   In `apps/extension/.env`, set `VITE_API_BASE_URL` to your production API URL (e.g. `https://api.yourdomain.com`).
2. **Update Manifest Host Permissions**:
   In `apps/extension/public/manifest.json`, ensure `host_permissions` permits your production API domain:
   ```json
   "host_permissions": [
     "https://api.yourdomain.com/*"
   ]
   ```
3. **Build Extension**:
   ```bash
   cd apps/extension
   npm run build
   ```
4. **Install in Google Chrome**:
   * Open Chrome and navigate to `chrome://extensions/`.
   * Enable **Developer mode** (toggle in upper right).
   * Click **Load unpacked**.
   * Select the `apps/extension/dist/` directory.

---

## 7. Pre-Deployment Gating Requirements

Before promoting to production, the following gating steps must be completed:

* [x] **Backend Static Checks**: Ruff linter, formatting checks, and Mypy passed with 0 errors.
* [x] **Backend Unit Tests**: All 242 pytest test cases passed.
* [x] **Extension Unit Tests**: All 67 Vitest test cases passed.
* [x] **Dashboard Unit Tests**: All 45 Vitest test cases passed.
* [x] **Production Builds**: Backend container, extension Vite build, and dashboard Next.js build compiled with 0 errors.
* [ ] **Live Manual Chrome Validation**: Live browser testing in Chrome must be executed per the Phase B.6 Manual Testing Checklist.

---

## 8. Known Boundaries & Limitations

1. **Safe Browsing Skip Transparency**: When a URL contains sensitive parameters (e.g. authentication tokens), Google Safe Browsing is skipped completely to protect user privacy. Detection falls back to heuristic DOM analysis, ML inference, and VirusTotal domain reputation.
2. **Browser Local History**: When the browser navigates to an untrusted URL, Chrome records the top-level URL in its internal browser history before the extension can issue a tab redirect to the warning page.
