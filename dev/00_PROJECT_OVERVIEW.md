# 00. Project Overview: Site Sentry

* **Canonical Product Name:** Site Sentry (formerly documented as TrustLens AI)
* **Tagline:** Deterministic, Evidence-Based Browser Security and Threat Protection
* **Current Baseline Repository HEAD:** `12e2cda`

---

## 1. Executive Summary

**Site Sentry** is a high-performance browser security system engineered to detect phishing, credential harvesting, malware distribution, and deceptive websites in real time.

Moving beyond black-box probabilistic scoring or opaque binary blacklists, Site Sentry pairs **authoritative global threat intelligence** (Google Safe Browsing, VirusTotal) with **deterministic structural analysis** (URL syntax, hostname entropy, punycode/homoglyphs, login form submission targets, and transport security). Findings are synthesized through a rigorous **Score Fusion Engine** and mapped by a **Decision Engine** into unambiguous browser protection actions (`allow`, `warn`, `block`). When threat intelligence is incomplete, the Decision Engine assigns `action = "warn"` with `threat_category = "inconclusive"` rather than issuing a false `allow`.

Site Sentry is implemented as:
1. **A Chrome / Chromium Browser Extension:** The primary client surface, capturing minimal structural metadata during navigation, querying the backend, and displaying tamper-proof warnings and evidence.
2. **A FastAPI Modular Monolith Backend:** The central scanning authority running in-process deterministic analysis engines, caching lookups in Redis, and persisting scan records in PostgreSQL/SQLite.
3. **A Next.js Management Dashboard:** A dedicated interface for inspecting scan history, viewing threat analytics, and reviewing security evidence.

---

## 2. Revised Product Direction & Core Priorities

The original project documentation described a broad ecosystem under the name *TrustLens AI*, including machine learning classifiers, SHAP explainability, Web3 wallet-drainer detectors, LLM privacy policy summarizers, and crowdsourced community reputation networks.

To maximize real-world security efficacy and eliminate false sense of security, the product direction is focused on:
1. **Pipeline Reliability First:** Absolute reliability of core threat intelligence lookups and deterministic rules over speculative scoring engines.
2. **Authoritative Evidence Precedence:** Confirmed malicious findings from authoritative feeds cannot be overridden or softened by heuristics or statistical predictions.
3. **Honest Uncertainty:** Timeouts, rate limits, or incomplete provider queries result in `action = "warn"` with `threat_category = "inconclusive"` — never masked as clean or safe.
4. **Explicit Browser Warnings Over DOM Tampering:** In-page DOM manipulation (e.g., disabling password fields) is rejected as an insecure anti-pattern. Site Sentry enforces protection through trusted extension-origin interstitials and dialogs.
5. **Deferred Probabilistic ML:** Machine learning model training and inference are removed from the production scan path and deferred to an empirical evaluation phase (Phase 5).

---

## 3. System Components: Active vs. Deferred Status

| Component | Status | Operational Role |
| :--- | :--- | :--- |
| **Browser Extension** | **Active (Core Client)** | Navigation monitoring, minimal DOM feature extraction, trusted warning interstitials. |
| **FastAPI Backend** | **Active (Modular Monolith)** | Centralized scan orchestration (`POST /api/v1/analyze`), caching, and persistence. |
| **Security Engine** | **Active (Prioritized)** | Deterministic evaluation of URL, hostname, SSL/TLS, and DOM structural signals. |
| **Threat Intelligence Engine** | **Active (Prioritized)** | Concurrent lookups across Google Safe Browsing and VirusTotal APIs with resilience guards. |
| **Rule Engine** | **Active (Prioritized)** | Deterministic finding emission and severity classification. |
| **Score Fusion Engine** | **Active (Core Pipeline)** | Combines structural deductions with threat intel overrides (VT deductions capped at 50 pts). |
| **Decision Engine** | **Active (Core Pipeline)** | Evaluates findings and completeness to assign browser actions (`allow`, `warn`, `block`) and classify threat categories. |
| **Explainability Engine** | **Active (Evidence-Based)** | Generates human-readable explanations mapped directly to observed security findings. |
| **Privacy Intelligence Engine** | **Active (Reduced Scope)** | Lightweight local cookie and third-party tracker detection; LLM policy analysis deferred. |
| **Next.js Dashboard** | **Active (Existing Baseline)** | Real-time scan history visualization and threat analytics. |
| **Machine Learning Engine** | **Deferred (Research Only)** | Schemas and contracts preserved; model training and inference excluded from live scanning. |
| **Web3 Engine** | **Deferred** | Smart-contract and crypto-wallet auditing deferred from immediate roadmap. |
| **Community Intelligence** | **Deferred** | Crowdsourced reputation voting deferred to prevent Sybil and poisoning attacks. |

---

## 4. Documentation Index & Single Source of Truth

### Architecture Decision Records (ADRs)
* [ADR-001: Prioritizing Deterministic Rules & Threat Intel](./decisions/ADR-001-deterministic-security-priority.md)
* [ADR-002: Deferring Machine Learning Model Training](./decisions/ADR-002-defer-ml-training.md)
* [ADR-003: Retaining FastAPI Modular Monolith Architecture](./decisions/ADR-003-modular-monolith-architecture.md)
* [ADR-004: Deferring Web3 & Community Intelligence](./decisions/ADR-004-defer-web3-community-intelligence.md)
* [ADR-005: Preferring Explicit Browser Warning Over DOM Tampering](./decisions/ADR-005-browser-warning-over-dom-tampering.md)

### Authoritative Contracts & Governance
* [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md)
* [28. Provider Resilience and Failure Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md)
* [29. Detection Evaluation Plan](./29_DETECTION_EVALUATION_PLAN.md)
* [30. Threat Model](./30_THREAT_MODEL.md)
* [31. Data Privacy and Retention Specification](./31_DATA_PRIVACY_AND_RETENTION.md)

### System Specifications & Architecture
* [01. Product Requirements](./01_PRODUCT_REQUIREMENTS.md)
* [02. Feature Specifications](./02_FEATURE_SPECIFICATIONS.md)
* [03. System Architecture](./03_SYSTEM_ARCHITECTURE.md)
* [04. Project Structure](./04_PROJECT_STRUCTURE.md)
* [05. Tech Stack](./05_TECH_STACK.md)
* [06. Backend Architecture](./06_BACKEND_ARCHITECTURE.md)
* [07. Extension Architecture](./07_EXTENSION_ARCHITECTURE.md)
* [08. Frontend Dashboard Architecture](./08_FRONTEND_ARCHITECTURE.md)
* [13. Database Design](./13_DATABASE_DESIGN.md)
* [14. API Design](./14_API_DESIGN.md)
* [15. Data Flow Pipeline](./15_DATA_FLOW.md)
* [19. Development Roadmap](./19_DEVELOPMENT_ROADMAP.md)
