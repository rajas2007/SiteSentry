# 04. Project Structure

* **Product:** Site Sentry
* **Repository Root:** Repository Base Directory (`./`)
* **Canonical Path:** `dev/04_PROJECT_STRUCTURE.md`

---

## 1. Actual Repository Monorepo Structure

Site Sentry is organized as a unified monorepo housing the browser extension, the management dashboard, and the FastAPI backend service.

```text
SiteSentry/
├── apps/                                  # Client applications
│   ├── dashboard/                         # Next.js 14 web dashboard (React 18, TailwindCSS)
│   │   ├── src/
│   │   │   ├── app/                       # Next.js App Router (pages & layouts)
│   │   │   ├── components/                # UI components (ScanHistory, Metrics, Navbar)
│   │   │   └── lib/                       # API client & data fetchers
│   │   ├── package.json
│   │   └── tailwind.config.js
│   │
│   └── extension/                         # Chrome Extension (Manifest V3)
│       ├── src/
│       │   ├── background/                # Background service worker (state, alarms)
│       │   ├── content/                   # Content scripts (structural DOM extraction)
│       │   ├── popup/                     # Extension popup UI (React / HTML / Tailwind)
│       │   └── pages/                     # Full-tab warning interstitial (warning.html)
│       └── manifest.json
│
├── services/                              # Backend services
│   └── api/                               # FastAPI Modular Monolith
│       ├── src/
│       │   ├── api/                       # REST endpoint routers (analyze.py, analytics.py)
│       │   ├── config.py                  # Pydantic settings & environment configuration
│       │   ├── database.py                # SQLAlchemy session & connection management
│       │   ├── main.py                    # FastAPI app initialization, middleware, routes
│       │   ├── models/                    # SQLAlchemy ORM models (ScanHistory, DomainReputation)
│       │   ├── schemas/                   # Pydantic schemas (PageAnalysisRequest, Response)
│       │   ├── services/                  # ScanService orchestration, cache service
│       │   └── engines/                   # Modular analysis engines (In-Process)
│       │       ├── security/              # SecurityEngine (structural URL & DOM heuristics)
│       │       ├── threat_intelligence/   # ThreatIntelligenceEngine (GSB & VirusTotal)
│       │       ├── score_fusion/          # ScoreFusionEngine (proportional deductions)
│       │       ├── decision/              # DecisionEngine (allow, warn, block actions)
│       │       ├── explainability/        # ExplainabilityEngine (evidence generation)
│       │       ├── privacy/               # PrivacyIntelligenceEngine (trackers & cookies)
│       │       ├── rules/                 # RuleEngine (deterministic YAML rule sets)
│       │       ├── trust/                 # TrustEngine (historical domain reputation)
│       │       ├── machine_learning/      # Schemas, dataset utilities, MODEL_CONTRACT.md (offline)
│       │       └── web3/                  # Web3Engine (deferred prototype)
│       ├── tests/                         # Pytest test suite (unit & integration tests)
│       ├── Dockerfile
│       └── pyproject.toml / requirements.txt
│
├── dev/                                   # Architecture & Development Documentation
│   ├── decisions/                         # Architecture Decision Records (ADR-001 to ADR-005)
│   ├── 00_PROJECT_OVERVIEW.md
│   ├── 27_SECURITY_DECISION_CONTRACT.md
│   ├── 28_PROVIDER_RESILIENCE_CONTRACT.md
│   ├── 29_DETECTION_EVALUATION_PLAN.md
│   ├── 30_THREAT_MODEL.md
│   ├── 31_DATA_PRIVACY_AND_RETENTION.md
│   └── ...                                # Full specification documents (00 through 31)
│
├── docker-compose.yml                     # Local composition (API, PostgreSQL, Redis)
└── README.md
```

---

## 2. Structural Conventions & Boundaries

1. **`services/api/src/engines/`:** Contains all analytical engines. Active engines execute in-process within `ScanService` without network hops per [ADR-003](./decisions/ADR-003-modular-monolith-architecture.md).
2. **`services/api/src/engines/machine_learning/`:** Preserved strictly as an offline utility repository (schemas, feature extractors, dataset splitters, and `MODEL_CONTRACT.md`). It is not invoked during live scans per [ADR-002](./decisions/ADR-002-defer-ml-training.md).
3. **`apps/extension/`:** Encapsulates Manifest V3 client logic. Content scripts extract only lightweight boolean flags and metrics, passing them to the background worker without modifying the page DOM per [ADR-005](./decisions/ADR-005-browser-warning-over-dom-tampering.md).
4. **`dev/decisions/`:** Formal Architecture Decision Records providing immutable historical context for all architectural choices.
