# ADR-003: Retaining FastAPI Modular Monolith Architecture

* **Status:** Proposed (Under Review)
* **Date:** 2026-10-19
* **Authors:** Site Sentry Core Engineering Team
* **Deciders:** System Architecture, DevOps, Backend Engineering

---

## 1. Context

The initial architectural documents for TrustLens AI envisioned a distributed microservice ecosystem where individual engines (Security Engine, Threat Intelligence, Rule Engine, AI Engine, Privacy Engine, Web3 Engine, Trust Engine) might run as standalone microservices communicating over asynchronous message brokers (e.g., Kafka, RabbitMQ, Celery workers) and deployed across Kubernetes clusters.

However, the primary consumer of Site Sentry's API is a browser extension performing real-time website analysis during user navigation. Browser navigation imposes stringent performance constraints:
* The user cannot wait seconds for an asynchronous job queue and polling cycle to determine whether a page is safe.
* Real-time protection requires a sub-500ms end-to-end response budget.
* The current backend codebase is organized as a clean, highly cohesive modular Python package (`services/api/src/engines/`) running under FastAPI with asynchronous I/O (`asyncio`, `httpx`), PostgreSQL (via SQLAlchemy) for scan history/reputation, and Redis for caching and rate limiting.

---

## 2. Decision

We **retain the FastAPI modular monolith** as the definitive backend architecture for Site Sentry:

1. **In-Process Modular Engines:** All active analysis engines (`SecurityEngine`, `ThreatIntelligenceEngine`, `PrivacyIntelligenceEngine`, `ScoreFusionEngine`, `DecisionEngine`) reside in `services/api/src/engines/` and are invoked in-process within `ScanService.analyze_page()`.
2. **Synchronous REST Contract:** The scan endpoint (`POST /api/v1/analyze`) executes asynchronously in-memory and returns the complete `PageAnalysisResponse` directly to the client.
3. **No Distributed Message Brokers:** We reject introducing Kafka, RabbitMQ, Celery, or gRPC microservices for core scan orchestration.
4. **Minimal Infrastructure Footprint:** The operational baseline is strictly limited to:
   * FastAPI application service (Uvicorn / Docker).
   * PostgreSQL database for scan records and domain reputation history.
   * Redis for URL scan caching and rate limiting.

---

## 3. Rationale

* **Latency Optimization:** In-memory function calls eliminate inter-service network serialization, TLS handshakes, network latency, and queue wait times.
* **Operational Simplicity:** A single Docker container or compose stack is trivial to build, test, deploy, and observe in CI/CD and production environments.
* **Code Cohesion & Refactoring Ease:** Clean Python package boundaries allow rapid refactoring, shared Pydantic schemas, and straightforward static type checking (`mypy`/`pyright`) across engines without schema registry synchronization.
* **Deterministic Concurrency:** Modern Python `asyncio` handles concurrent external threat intelligence lookups (Google Safe Browsing and VirusTotal via `httpx.AsyncClient`) cleanly within a single event loop without multi-service coordination overhead.

---

## 4. Alternatives Considered

* **Microservices per Engine (gRPC / HTTP):**
  * *Reason for Rejection:* Massive latency multiplication (each engine call adds network round-trips), severe operational complexity (service discovery, distributed tracing, circuit breakers), and negligible scalability benefits at current scale.
* **Asynchronous Queue with Polling (Celery / RabbitMQ / WebSockets):**
  * *Reason for Rejection:* Complex state management in the browser extension, high polling overhead, and degraded user experience during page navigation where immediate feedback is necessary.
* **Serverless Functions (AWS Lambda / Cloudflare Workers):**
  * *Reason for Rejection:* Cold start latencies (500ms–2000ms) violate the real-time navigation safety requirement, and persistent database connection pooling in serverless environments is problematic.

---

## 5. Consequences

### Positive
* Sub-500ms scan execution times (sub-50ms when cached in Redis).
* Frictionless developer onboarding: `docker-compose up` brings up the entire backend, database, and cache.
* Unified integration and unit test execution via standard `pytest`.

### Negative / Trade-offs
* If a CPU-bound engine (such as heavy deep learning inference) were added, it could contend with the web event loop. (However, this is mitigated by ADR-002 deferring ML training).
* Vertical scaling is primary, with horizontal scaling achieved by spinning up stateless FastAPI replicas behind a standard reverse proxy (Nginx / Caddy / Cloudflare).

---

## 6. Conditions for Revisit

This architecture will be revisited only if:
1. Production scan volume sustainably exceeds tens of thousands of requests per second, exceeding horizontal FastAPI replica capacity.
2. An asynchronous, long-running background deep-crawl capability (e.g., recursive link inspection taking >10 seconds) is introduced that must be decoupled from the real-time navigation API.
