# 30. Threat Model

* **Status:** Active Specification
* **Canonical Path:** `dev/30_THREAT_MODEL.md`
* **Target Systems:** Chrome/Edge Browser Extension, FastAPI Backend, Threat Feeds, Redis Cache

---

## 1. Overview & Trust Boundaries

Site Sentry operates in an inherently adversarial environment where untrusted web pages, malicious actors, and third-party network services interact. This threat model identifies critical security boundaries, attack vectors, and corresponding defensive mitigations.

```
┌────────────────────────────────────────────────────────────────────────┐
│ UNTRUSTED BROWSER CONTEXT (Untrusted Web Page DOM & Scripts)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ [Content Script - Limited Trust]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TRUSTED BROWSER EXTENSION RUNTIME (Background Service Worker / Popup) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Public Internet)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ SITE SENTRY BACKEND (FastAPI Monolith, Redis, PostgreSQL)             │
└──────────────┬──────────────────────────────────────────┬──────────────┘
               │                                          │
               ▼                                          ▼
 [Google Safe Browsing API]                        [VirusTotal API]
```

### Trust Boundaries
1. **Boundary A (Untrusted Page $\to$ Content Script):** The web page DOM and host JavaScript are completely untrusted and potentially hostile.
2. **Boundary B (Content Script $\to$ Background Worker):** Chrome extension message-passing channel (`chrome.runtime.sendMessage`).
3. **Boundary C (Extension Client $\to$ FastAPI Backend):** External HTTPS REST network boundary (`POST /api/v1/analyze`).
4. **Boundary D (Backend $\to$ Third-Party Threat Providers):** Outbound HTTPS calls to Google Safe Browsing and VirusTotal.
5. **Boundary E (Backend $\to$ Persistence/Cache):** Internal network communication with Redis and PostgreSQL.

---

## 2. Threat Analysis & Mitigations

### 2.1 Threat: Malicious Web Page Attacks on Content Script
* **Attack Vectors:** Hostile page scripts tampering with `window` prototypes, overriding DOM APIs (`document.querySelector`), installing `MutationObserver` traps, or detecting extension presence to alter page behavior during scanning.
* **Mitigations:**
  * Content scripts execute in Chrome's isolated JavaScript world (cannot be directly accessed or modified by page scripts).
  * Do NOT execute arbitrary script injection or evaluate unsanitized page strings.
  * Extract structural metadata using standard DOM properties and immediately pass serialized, clean objects to the background worker.

### 2.2 Threat: Spoofed Warning Interfaces & UI Redressing
* **Attack Vectors:** A phishing page styles its own HTML elements to mimic Site Sentry's security popup or badges, displaying a fake "Verified Safe by Site Sentry" green shield to deceive the user.
* **Mitigations:**
  * **No In-Page Trust Badges:** Site Sentry never renders floating "Safe" trust seals into the webpage DOM.
  * All authoritative security statuses are displayed in **trusted browser chrome**: the browser action toolbar badge and the isolated extension popup (`chrome-extension://...`).
  * Critical blocking warnings redirect the entire tab to an isolated extension interstitial (`warning.html`) that executes outside the page's origin.

### 2.3 Threat: Sensitive URL & PII Exposure
* **Attack Vectors:** Scanning full URLs transmits sensitive query parameters (e.g., OAuth tokens, password reset tokens, session IDs) to the backend or external providers.
* **Mitigations & Architecture:**
  * **Domain-Only for VirusTotal:** In the current implementation, VirusTotal queries receive strictly the domain name (`request.hostname`), ensuring query parameters are never transmitted to VirusTotal.
  * **Google Safe Browsing:** GSB evaluates target URLs; client-side token stripping of sensitive keys (`token`, `auth`, `password`, `key`, `code`) is specified as a requirement before network dispatch per [31. Data Privacy and Retention](./31_DATA_PRIVACY_AND_RETENTION.md).
  * **Zero Form Capture:** Passwords and input field values entered by users are **never collected, inspected, or transmitted under any circumstances**.

### 2.4 Threat: Backend API Abuse & Denial of Service
* **Attack Vectors:** Flooding the backend scan endpoint (`POST /api/v1/analyze`) with synthetic URLs to exhaust server resources or upstream API quotas.
* **Mitigations:**
  * Enforce strict request payload size limits on `POST /api/v1/analyze`.
  * URL length constraints: URLs exceeding 2,048 characters are rejected with HTTP 400.
  * In-process caching in Redis prevents duplicate outbound queries for previously verified domains.

### 2.5 Threat: Cache Poisoning & Stale Records
* **Attack Vectors:** An attacker crafts a clean landing page, scans it to seed a cache record in Site Sentry's Redis, and then alters the page content to host a credential-harvesting phishing kit.
* **Mitigations & Caching Design:**
  * **URL-Specific Cache:** Full page analysis is keyed strictly by the SHA-256 hash of the full URL (`sitesentry:cache:url:{sha256(url)}`), preventing a clean scan on one page from masking a phishing kit on a different path.
  * **TTL Limits:** Cached URL analysis expires after 1 hour (`REDIS_CACHE_TTL_SECONDS = 3600`), and domain OSINT expires after 24 hours (`86400s`).
  * **Incomplete Scans Not Cached:** Scans with provider failures (`data_completeness == False`) are not written to Redis, ensuring immediate re-evaluation on subsequent visits.
  * **Proposed Cache-Bypass Trigger:** A proposed `force_refresh: bool` parameter in `PageAnalysisRequest` is under review to allow client-initiated cache bypass when DOM mutations or significant page structural changes are observed (not currently active in the API schema).

### 2.6 Threat: Secret Leakage (API Keys)
* **Attack Vectors:** Embedding Google Safe Browsing or VirusTotal API keys inside browser extension files, committing them to source control, or exposing them in client-side responses.
* **Mitigations:**
  * **Strict Backend Proxying:** The browser extension **never holds external API keys**. All threat intelligence lookups are executed exclusively by the backend service.
  * API keys are loaded via environment variables (`.env`) and validated with `pydantic_settings`.
  * Backend responses returned to the client contain only normalized scores and evidence summaries, never raw provider credentials or sensitive authentication headers.

### 2.7 Threat: Upstream Provider Downtime / Poisoning
* **Attack Vectors:** Outage or malicious manipulation of external threat intelligence APIs leading to false negatives (sites wrongly marked safe) or false positives.
* **Mitigations:**
  * Provider failure contract (ADR-001, Document 28): Timeouts and errors result in `action = "warn"` with `threat_category = "inconclusive"`, never an `"allow"`.
  * Multi-provider correlation: Positive threat detections from VirusTotal require $\ge 3$ security vendor consensus before triggering automatic critical blocking.
