# 15. Data Flow Pipeline

* **Product:** Site Sentry
* **Pipeline Type:** Synchronous In-Process Execution with Bounded Async I/O
* **Canonical Path:** `dev/15_DATA_FLOW.md`
* **Related Architecture:** [03. System Architecture](./03_SYSTEM_ARCHITECTURE.md)
* **Related ADR:** [ADR-003: Retaining FastAPI Modular Monolith Architecture](./decisions/ADR-003-modular-monolith-architecture.md)

---

## 1. Overview & Pipeline Scope

The Site Sentry scan pipeline executes sequentially and synchronously within `ScanService.analyze_page()`.

To maintain sub-500ms navigation scan latencies, the pipeline executes active deterministic engines in-process and avoids distributed microservices or message queues. Deferred modules (ML model training, Web3, LLM policy analysis) are excluded from the real-time scan path per [ADR-002](./decisions/ADR-002-defer-ml-training.md) and [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).

---

## 2. End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Ext as Browser Extension (Client)
    participant API as FastAPI Router (/api/v1/analyze)
    participant Redis as Redis Cache
    participant Threat as Threat Intelligence Engine
    participant GSB as Google Safe Browsing
    participant VT as VirusTotal API
    participant Priv as Privacy Intelligence Engine
    participant Sec as Security Engine (Rules)
    participant Fusion as Score Fusion Engine
    participant Dec as Decision Engine
    participant Expl as Explainability Engine
    participant DB as PostgreSQL (ScanHistory)

    User->>Ext: Navigates to target website
    Ext->>Ext: Redact sensitive URL query parameters
    Ext->>Ext: Extract minimal DOM flags (has_password, num_forms)
    Ext->>API: POST /api/v1/analyze (PageAnalysisRequest)

    API->>Redis: Check URL Cache
    alt Cache Hit (Clean or Threat)
        Redis-->>API: Return Cached PageAnalysisResponse
        API-->>Ext: Return Scan Result (< 50ms)
    else Cache Miss
        par Concurrent Threat Intelligence Query
            API->>Threat: Query GSB & VT concurrently
            Threat->>GSB: Bounded HTTP Lookup (2.5s)
            Threat->>VT: Bounded HTTP Lookup (2.5s)
            GSB-->>Threat: GSB Verdict
            VT-->>Threat: VT Vendor Counters
            Threat-->>API: ThreatIntelResult (is_threat, is_complete)
        and Local Privacy Analysis
            API->>Priv: Analyze Trackers & Cookie Counts
            Priv-->>API: PrivacyResult
        and Local Structural Security Analysis
            API->>Sec: Analyze URL Syntax, Punycode, Hostname Entropy & DOM Forms
            Sec-->>API: SecurityResult (Findings, Base Structural Score)
        end

        API->>Fusion: Fuse Structural Findings + Threat Intel Results
        Fusion->>Fusion: Cap VT Deductions (max 50), Apply Hard Threat Overrides (score <= 10)
        Fusion-->>API: Final Fused Score & Severity

        API->>Dec: Evaluate Action & Completeness
        Dec->>Dec: Assign allow / warn / block (inconclusive category if provider failed)
        Dec->>Expl: Format Human-Readable Evidence Findings
        Expl-->>Dec: Formatted Evidence Payload
        Dec-->>API: PageAnalysisResponse

        par Persistence & Cache Write
            API->>Redis: Cache Result (1h URL cache, 24h OSINT cache if complete)
            API->>DB: Persist ScanHistory & Update DomainReputation
        end

        API-->>Ext: Return PageAnalysisResponse (Normal target < 500ms; Max timeout 2.5s)
    end

    alt Action is block
        Ext->>User: Redirect Tab to Warning Interstitial (warning.html)
    else Action is warn
        Ext->>User: Set Amber Badge & Populate Popup Evidence Drawer (Warn / Caution)
    else Action is allow
        Ext->>User: Set Green Shield Badge
    end
```

---

## 3. Detailed Responsibilities by Pipeline Stage

1. **Browser Extension Client:** Detects navigation, scrubs sensitive query tokens, extracts lightweight DOM counts without tampering with the page DOM, and dispatches to the backend.
2. **API Gateway (`services/api/src/api/analyze.py`):** Validates request schemas via Pydantic v2, enforces client rate limits, and invokes `ScanService`.
3. **Redis Cache Check:** Evaluates whether a valid cached response exists for the canonical URL, immediately short-circuiting expensive external API lookups.
4. **Threat Intelligence Engine:** Concurrently queries Google Safe Browsing and VirusTotal with bounded 2.5s deadlines, guaranteeing honest failure states per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md).
5. **Privacy Intelligence Engine:** Analyzes local tracker domain counts and cookie metrics.
6. **Security Engine:** Deterministically analyzes lexical URL patterns, punycode homoglyphs, hostname entropy, and DOM credential-harvesting form targets.
7. **Score Fusion Engine:** Merges findings, applying proportional VT deductions capped at 50 points, and enforcing hard overrides for confirmed threats per [16. Score Fusion Engine](./16_SCORING_ENGINE.md).
8. **Decision Engine & Explainability:** Evaluates evidence completeness and risk scores to assign user-facing actions (`allow`, `warn`, `block`) and threat categories (including `inconclusive` when threat feeds fail), pairing each action with structured, plain-English evidence.
9. **Persistence & Cache Layer:** Writes telemetry to PostgreSQL (`ScanHistory`, `DomainReputation`) and updates Redis cache TTLs.
10. **Client Display:** The extension updates toolbar badges and renders popups or redirects to `warning.html` without mutating host page inputs.
