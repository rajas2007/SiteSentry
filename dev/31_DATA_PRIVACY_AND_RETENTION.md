# 31. Data Privacy and Retention Specification

* **Status:** Proposed Specification & Implementation Mapping
* **Canonical Path:** `dev/31_DATA_PRIVACY_AND_RETENTION.md`
* **Target Components:** Browser Extension, FastAPI Backend, Database Persistence, Redis Cache
* **Governance Notice:** This document establishes engineering privacy guidelines and technical retention specifications. It does not constitute formal legal compliance certification (e.g., GDPR, CCPA).

---

## 1. Core Principles

Site Sentry is a security tool whose efficacy depends on inspecting website metadata during browsing. Because web navigation histories represent highly sensitive personal information, Site Sentry adheres to the principle of **strict data minimization**:
1. **Security-Relevant Metadata Only:** Collect and process only signals strictly required to assess security and phishing threats.
2. **Zero Form Data Capture:** Under no circumstances shall user-typed passwords, form field contents, credit card numbers, or session cookies be captured, stored, or transmitted.
3. **Separation of Implemented vs. Proposed Controls:** Transparently distinguish controls that exist in source code from proposed lifecycle and deletion requirements.

---

## 2. Handling of Sensitive URL Parameters Across Boundaries

Web URLs can inadvertently contain confidential secrets in query strings:
* Authentication / OAuth codes: `?code=auth_code_xyz`
* Password reset tokens: `?token=reset_token_abc`
* Magic login links: `?magic_link=...`
* Session identifiers: `?sid=...`

To protect user confidentiality, sensitive query parameters must be managed across five distinct data boundaries:

| Data Boundary | Handling Specification | Current Codebase Status |
| :--- | :--- | :--- |
| **1. Extension to Backend** (`POST /api/v1/analyze`) | High-risk query parameter keys (`token`, `auth`, `password`, `key`, `code`, `access_token`, `reset`, `sig`) must be stripped or replaced with `[REDACTED]` prior to dispatch. Hostname and path are preserved for structural evaluation. | **Proposed Requirement:** Client-side query redaction is specified; currently, raw URLs passed in `PageAnalysisRequest` must be validated. |
| **2. Backend to Threat Intelligence Providers** | **Google Safe Browsing:** Evaluates sanitized URL.<br>**VirusTotal:** Evaluates **domain name only** (`domain=request.hostname`), completely excluding URL paths and query strings from VirusTotal calls. | **Implemented in Code:** `VirusTotalClient.lookup_domain(domain)` takes hostname only; query strings are never sent to VirusTotal. |
| **3. Application Logs & Diagnostics** | Uvicorn and Python logger statements must mask or truncate query strings. Raw request URLs containing query parameters must not be dumped at `INFO` log levels. | **Proposed Requirement:** Loggers print `url_str`; full token masking in log formatters is targeted for Phase 2 hardening. |
| **4. Redis Cache Storage** | Cache keys for URLs use a SHA-256 hash (`sitesentry:cache:url:{sha256(normalized_url)}`). Query strings are not exposed in plaintext Redis key lists. | **Implemented in Code:** `RedisCache._hash_url()` hashes the full normalized URL string. |
| **5. Persistent Scan History** (`scan_history`) | `full_url` column in PostgreSQL stores the sanitized URL string. User passwords, form inputs, and authorization headers are strictly excluded from the schema. | **Implemented in Code:** Schema in `services/api/src/models/scan.py` contains only URL and analysis JSON, with zero input capture fields. |

---

## 3. Data Retention: Implemented Baseline vs. Proposed Controls

### 3.1. Implemented Retention Controls (Active in Codebase)
* **Redis Key Expiry:**
  * Domain OSINT cache keys (`sitesentry:cache:osint:{domain}`) expire automatically after **24 hours** (`86400s`).
  * Full URL analysis cache keys (`sitesentry:cache:url:{hash}`) expire automatically based on `REDIS_CACHE_TTL_SECONDS` (default: **1 hour / 3600s** in `services/api/src/core/config.py`).
  * Incomplete scans (`data_completeness == False`) are not written to Redis, preventing stale failures from persisting.
* **Persistent History Timestamps:**
  * All `ScanHistory` and `DomainReputation` records are persisted with UTC timestamps (`scanned_at`, `last_scanned`).
* **Extension Local Storage:**
  * Ephemeral tab state cached in `chrome.storage.local` is bound to browser session lifecycles and user-managed cache clearing.

### 3.2. Proposed Retention & Deletion Requirements (Under Review / Future Scope)
* **Automated History Pruning:** A proposed scheduled maintenance task to prune `ScanHistory` records older than **30 days**. *(Not currently implemented in source code; no automated cron or celery pruning job exists).*
* **User History Deletion Endpoint:** A proposed `DELETE /api/v1/history` endpoint to allow users to clear their scan history on demand. *(Not currently implemented in `src/api/analyze.py`).*
* **Rolling Domain Aggregation:** A proposed 90-day aggregation cleanup for `DomainReputation`. *(Not currently implemented).*

---

## 4. Privacy & Anti-Surveillance Guarantees

1. **No User Identity Tracking:** In the current baseline, `ScanService.analyze_page()` does not require user authentication or persistent profile association. Scans are identified by ephemeral `analysis_id` UUIDs.
2. **No Raw DOM Capture:** The extension content script extracts only numeric counts (`formCount`, `scriptCount`, `imageCount`) and boolean flags (`hasPasswordField`, `hasLoginForm`, `hasHttps`), never capturing or transmitting raw page source HTML.
