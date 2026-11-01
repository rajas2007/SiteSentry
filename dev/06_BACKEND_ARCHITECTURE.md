# 06. Backend Architecture

* **Product:** Site Sentry
* **Framework:** FastAPI Modular Monolith (Python 3.11+)
* **Canonical Path:** `dev/06_BACKEND_ARCHITECTURE.md`
* **Related ADR:** [ADR-003: Retaining FastAPI Modular Monolith Architecture](./decisions/ADR-003-modular-monolith-architecture.md)

---

## 1. Overview

The Site Sentry backend is engineered as a high-performance **FastAPI Modular Monolith** located in `services/api/`. It provides centralized scan orchestration, external threat intelligence aggregation, deterministic security analysis, caching, and persistence.

In-process execution minimizes inter-service serialization and latency, achieving sub-500ms synchronous response times during real-time web browsing.

---

## 2. Core Architectural Components

### 2.1. API Routing Layer (`services/api/src/api/`)
* **`POST /api/v1/analyze`:** Canonical scan endpoint. Accepts `PageAnalysisRequest` (URL and extracted structural features) and returns a complete `PageAnalysisResponse` (scores, findings, provider results, decision action).
* **`GET /api/v1/history` & `GET /api/v1/history/{id}`:** Retrieves paginated scan histories and detailed audit records from PostgreSQL.
* **`GET /api/v1/analytics/overview`:** Provides aggregate metrics on scan volumes, threat distributions, and provider health.
* **`GET /health`:** Health check endpoint reporting database, Redis, and service status.

### 2.2. Scan Orchestrator (`services/api/src/services/scan.py`)
The central orchestrator is `ScanService.analyze_page()`. It coordinates in-process engine calls in a deterministic sequence:
1. **Cache Verification:** Queries Redis for an active cached verdict (`URL` key).
2. **Concurrent Threat Lookups:** Executes asynchronous HTTP queries to Google Safe Browsing and VirusTotal using `httpx.AsyncClient` with bounded timeouts per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md).
3. **Privacy Analysis:** Runs local tracker and cookie heuristics via `PrivacyIntelligenceEngine`.
4. **Deterministic Security Analysis:** Evaluates URL syntax, hostname entropy, punycode/homoglyphs, and DOM form targets via `SecurityEngine`.
5. **Score Fusion:** Fuses findings, applying capped VirusTotal deductions (maximum 50 points) and enforcing hard threat overrides (score $\le 10.0$ for confirmed threats) via `ScoreFusionEngine`.
6. **Decision Generation:** Evaluates score and completeness to produce `action` (`allow`, `warn`, `block`) via `DecisionEngine` (setting `threat_category = "inconclusive"` within `action = "warn"` when threat feeds are incomplete).
7. **Persistence & Caching:** Saves scan records to `ScanHistory` and `DomainReputation`, and populates the Redis cache.

---

## 3. Threat Intelligence Concurrency & Fault Tolerance

Outbound threat intelligence calls to Google Safe Browsing and VirusTotal are the only external network dependencies in the critical path:
* **Bounded Concurrency:** Managed via `asyncio.gather(..., return_exceptions=True)`.
* **Timeout Limits:** 2.5 seconds per provider; 3.0 seconds maximum total budget.
* **Honest Degradation:** If a provider times out or fails (HTTP 429/500), the result is recorded as `data_completeness = False`. If remaining evidence is clean, the final verdict degrades to `action = "warn"` with `threat_category = "inconclusive"`, never a false `"allow"` per [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md).

---

## 4. Deferred Modules & Inactive Subsystems

* **Machine Learning Engine (`services/api/src/engines/machine_learning/`):** Model training and runtime inference are **deferred** per [ADR-002](./decisions/ADR-002-defer-ml-training.md). The feature schemas (`FEATURE_ORDER`), dataset splitter, and `MODEL_CONTRACT.md` are preserved for offline research and benchmarking.
* **Web3 Engine (`services/api/src/engines/web3/`):** Smart-contract analysis is **deferred** per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md) and excluded from `ScanService`.
* **Task Queues (Celery/RabbitMQ):** Rejected; asynchronous I/O within FastAPI handles all concurrent operations without message broker infrastructure.
