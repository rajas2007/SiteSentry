# 01. Product Requirements Document (PRD)

* **Product:** Site Sentry
* **Status:** Revised Baseline Specification
* **Canonical Path:** `dev/01_PRODUCT_REQUIREMENTS.md`

---

## 1. Product Overview

**Site Sentry** is a real-time browser security product that protects users from phishing, malware delivery, credential harvesting, and deceptive web infrastructure. It evaluates visited websites using authoritative global threat intelligence feeds paired with deterministic structural rules, delivering clear, evidence-based user warnings and actions (`allow`, `warn`, `block`), with incomplete analysis surfaced honestly as cautionary warnings.

The primary client interface is a lightweight Chrome / Chromium Browser Extension, backed by a FastAPI modular monolith, Redis caching layer, and PostgreSQL scan persistence.

---

## 2. Target Audience & User Personas

### 2.1. The Everyday Web User (Primary)
* **Profile:** Browses the web for shopping, banking, social media, and work; non-technical.
* **Pain Point:** Cannot distinguish sophisticated phishing sites, punycode spoofing, or fake login forms from legitimate brands. Overwhelmed by vague browser error codes.
* **Need:** Clear, non-technical warnings that explain *why* a site is unsafe (e.g. "This page mimics a bank login but posts credentials to an untrusted external server") with a single-click exit to safety.

### 2.2. The Security Analyst / Advanced User (Secondary)
* **Profile:** IT administrator, developer, or security-conscious user.
* **Pain Point:** Frustrated by black-box security tools that provide no technical telemetry or justification for blocks.
* **Need:** Accessible technical evidence in the extension popup and dashboard: threat intelligence provider breakdown (Google Safe Browsing, VirusTotal), extracted structural signals, and deterministic rule match logs.

### 2.3. Deferred Personas (Future Scope)
* **The Web3 Trader (Charlie):** Dedicated smart-contract and crypto-wallet drainer analysis is deferred per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
* **The Enterprise SOC Director (Diana):** Multi-tenant fleet management and enterprise SIEM streaming are deferred per [Future Scope](./23_FUTURE_SCOPE.md).

---

## 3. Core Epics & User Stories

### Epic 1: Real-Time Navigation Security
* **US-01:** As a user navigating to a webpage, I want Site Sentry to automatically verify the domain against authoritative threat feeds (Google Safe Browsing, VirusTotal) in under 500ms.
* **US-02:** As a user visiting a zero-minute website not yet in threat feeds, I want the Security Engine to inspect URL structure, hostname entropy, and DOM login forms for phishing indicators.
* **US-03:** As a user on a slow network, I want cached scan results to load in under 50ms from Redis.

### Epic 2: Evidence-Based Warnings & Decisions
* **US-04:** As a user encountering a confirmed threat, I want an unmissable, tamper-proof warning interstitial (`BLOCK`) that prevents credential entry.
* **US-05:** As a user encountering a suspicious site, I want an amber badge and an extension popup clearly explaining the risks (`WARN`).
* **US-06:** As a user, when threat intelligence APIs fail or time out, I want the system to honestly report an `inconclusive` threat category under a cautionary `warn` action rather than falsely assuring me the site is safe.

### Epic 3: Privacy & Data Minimization
* **US-07:** As a privacy-conscious user, I want absolute certainty that Site Sentry never captures, transmits, or logs passwords, form inputs, or session cookies (see [31. Data Privacy and Retention](./31_DATA_PRIVACY_AND_RETENTION.md)).
* **US-08:** As a user, I want the extension to automatically redact sensitive tokens (`token`, `auth`, `password`) from URLs before sending them to the backend.

---

## 4. Functional Requirements

### 4.1. Core Pipeline & API
* **REQ-PLT-01:** The backend must expose a canonical scan endpoint: `POST /api/v1/analyze`, accepting `PageAnalysisRequest` and returning `PageAnalysisResponse`.
* **REQ-PLT-02:** The pipeline must execute sequentially and deterministically: URL Cache Check $\to$ Concurrent Threat Intel Lookup $\to$ Privacy Analysis $\to$ Security Engine Analysis $\to$ Score Fusion $\to$ Decision Engine $\to$ Cache & Persist.
* **REQ-PLT-03:** Confirmed malicious threat intelligence findings must act as hard overrides, clamping the final score $\le 10$ and triggering an `action = "block"` per [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md).
* **REQ-PLT-04:** Provider timeouts, rate limits, or network errors must be flagged as `data_completeness = False` and result in `action = "warn"` with `threat_category = "inconclusive"` if no positive threats are detected per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md).

### 4.2. Browser Extension Client
* **REQ-EXT-01:** Content scripts must extract only minimal structural boolean flags and counts (e.g., `has_password_field`, `num_forms`, `external_form_action`), never raw HTML or input values.
* **REQ-EXT-02:** The extension must display security verdicts using trusted browser chrome surfaces (toolbar badge, extension popup, and dedicated `warning.html` interstitial) and must NEVER inject code into the page DOM to mutate or disable inputs per [ADR-005](./decisions/ADR-005-browser-warning-over-dom-tampering.md).
* **REQ-EXT-03:** The extension must persist recent tab scans across service-worker wake/sleep cycles using `chrome.storage.local`.

---

## 5. Non-Functional Requirements

* **Latency:** End-to-end scanning must complete in $< 500\text{ms}$ (cached lookups $< 50\text{ms}$). External provider lookups bounded by a 2.5-second hard timeout.
* **Architecture:** Modular monolith in FastAPI; no distributed microservices or message queues required for live scanning per [ADR-003](./decisions/ADR-003-modular-monolith-architecture.md).
* **Privacy:** Complete exclusion of form field values, session tokens, and raw DOM trees.
* **Availability:** High resilience against third-party API rate limits through Redis caching (24h domain OSINT cache, 1h URL analysis cache; differential 6h threat / 24h clean TTLs proposed for future review).
