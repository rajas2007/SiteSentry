# 05. Technology Stack Specification

* **Product:** Site Sentry
* **Status:** Revised Baseline Specification
* **Canonical Path:** `dev/05_TECH_STACK.md`

---

## 1. Overview

Site Sentry is built on a streamlined, modern technology stack chosen for low-latency network I/O, rigorous typing, and operational simplicity.

---

## 2. Browser Extension Client (`apps/extension`)

* **Platform Standard:** Manifest V3 (Chrome, Edge, Brave, Chromium)
* **Language & Framework:** TypeScript, React
* **Build System:** Vite (Optimized multi-target rollup build for service-worker, content scripts, popup, and warning page)
* **Styling:** Tailwind CSS (Strictly scoped within extension surfaces; zero style pollution onto host web pages)
* **Persistence & Messaging:**
  * Background Service Worker lifecycle management.
  * State caching via `chrome.storage.local`.
  * Message passing via `chrome.runtime.sendMessage` and `chrome.tabs`.
* **Warning Delivery:** Dedicated extension-origin warning interstitial (`pages/warning.html`) per [ADR-005](./decisions/ADR-005-browser-warning-over-dom-tampering.md).

---

## 3. Web Dashboard Client (`apps/dashboard`)

* **Framework:** Next.js 14 (App Router)
* **Library & Language:** React 18, TypeScript
* **Styling:** Tailwind CSS
* **Component Primitives:** Accessible component architecture with Lucide React icons
* **Data Fetching:** Native `fetch` with Next.js server components and client-side hooks
* **Core Views:** Live Scan History (`/history`), Threat Analytics Overview (`/analytics`), Scan Details (`/history/[id]`).

---

## 4. Backend Platform Core (`services/api`)

* **Framework:** FastAPI (Modular Monolith architecture per [ADR-003](./decisions/ADR-003-modular-monolith-architecture.md))
* **Language Runtime:** Python 3.11+
* **HTTP Client:** `httpx` (Asynchronous HTTP client for concurrent threat intelligence lookups with connection pooling)
* **Data Validation & Settings:** Pydantic v2 & `pydantic-settings`
* **Database & ORM:**
  * SQLAlchemy 2.0 (Declarative models with session lifecycle management)
  * PostgreSQL 15+ (Production persistence for `ScanHistory` and `DomainReputation`)
  * SQLite (In-memory testing and local standalone fallback)
* **Caching & Rate Limiting:** Redis (24h domain OSINT cache, 1h URL scan cache; token-bucket rate limiting; differential 6h threat / 24h clean TTLs proposed for future review)
* **Testing:** Pytest, `pytest-asyncio`, `pytest-mock`

---

## 5. Third-Party Integrations & External Feeds

* **Google Safe Browsing API v4:** Authoritative URL and threat list matching.
* **VirusTotal API v3:** Domain reports and multi-engine antivirus detection metrics.
* **Resilience Framework:** Bounded 2.5s timeouts, rate-limit cooling, and fallback to `action = "warn"` with `threat_category = "inconclusive"` per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md).

---

## 6. Deferred Technologies (Excluded from Production Path)

The following technologies from the original architectural plan are officially **deferred**:
* **Tabular ML & TreeSHAP (`lightgbm`, `xgboost`, `shap`):** Excluded from production scanning dependencies per [ADR-002](./decisions/ADR-002-defer-ml-training.md). Preserved only for offline research scripts.
* **Distributed Task Queues (Celery, RabbitMQ, Kafka):** Excluded; in-process `asyncio` handles all real-time concurrency per [ADR-003](./decisions/ADR-003-modular-monolith-architecture.md).
* **LLM APIs (OpenAI, Anthropic):** Privacy policy text summarization is deferred.
* **Web3 RPC Clients (`web3.py`, `ethers.js`):** Blockchain node querying and smart contract auditing are deferred per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
