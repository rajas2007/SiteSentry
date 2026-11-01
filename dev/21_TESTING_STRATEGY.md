# 21. Testing Strategy

* **Product:** Site Sentry
* **Canonical Path:** `dev/21_TESTING_STRATEGY.md`
* **Target Suites:** `services/api/tests/`, `apps/extension/`, `apps/dashboard/`
* **Evaluation Specification:** [29. Detection Evaluation Plan](./29_DETECTION_EVALUATION_PLAN.md)

---

## 1. Overview & Quality Mandate

Site Sentry is a browser security product where false negatives allow malware or credential theft, and false positives destroy user trust. Testing is organized across three rigorous tiers:
1. **Unit & Engine Tests:** Testing deterministic security rules, deduction calculations, score clamps, and decision mappings in isolation.
2. **Integration Tests:** Verifying API routing, asynchronous provider timeouts, Redis caching, and database persistence.
3. **End-to-End & Detection Benchmarks:** Testing the browser extension inside headless Chromium and executing offline detection evaluation suites against real-world corpora.

---

## 2. Backend Testing (`services/api/tests/`)

* **Frameworks:** `pytest`, `pytest-asyncio`, `pytest-mock`
* **Database Isolation:** Tests run against in-memory SQLite or isolated test PostgreSQL instances.
* **Core Test Categories:**
  * **Score Fusion Tests (`test_score_fusion.py`):**
    * Asserts base score initialization at 100.0.
    * Asserts VirusTotal deduction scaling ($-10.0$ per vendor), strictly capped at 50.0 points.
    * Asserts confirmed threat overrides clamp the final score to $\le 10.0$ and assign `high`/`critical` severity.
    * Asserts score clamping to the range $[0.0, 100.0]$.
  * **Provider Resilience Tests (`test_threat_intel.py`):**
    * Simulates provider timeouts (2.5s threshold) and verifies `is_complete = False`.
    * Simulates HTTP 429 rate-limiting responses and verifies graceful fallback to `INCONCLUSIVE`.
    * Verifies that provider failure never produces an `ALLOW` or `CLEAN` result per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md).
  * **API Endpoint Tests (`test_analyze_api.py`):**
    * Tests `POST /api/v1/analyze`, `GET /api/v1/history`, and `GET /api/v1/analytics/overview`.
    * Validates request and response Pydantic schemas.

---

## 3. Client & Extension Testing (`apps/extension/`, `apps/dashboard/`)

* **Extension Unit Tests:**
  * Tests DOM extraction script (`content.ts`) on sample HTML fixtures to verify extraction of `has_password_field`, `num_forms`, and `external_form_action`.
  * Verifies that sensitive URL parameters (`token`, `auth`, `password`) are scrubbed by the service worker prior to network dispatch.
  * Asserts service worker state persistence in `chrome.storage.local`.
* **Warning Flow Integration (Playwright):**
  * Launches headless Chromium with the unpacked extension loaded.
  * Navigates to a simulated phishing page.
  * Asserts that `BLOCK` decisions correctly redirect to `chrome-extension://.../pages/warning.html` and that no DOM inputs on the page are tampered with.
* **Dashboard Tests:**
  * Verifies rendering of live scan history records fetched from the backend.
  * Confirms that empty databases render honest empty states rather than synthetic mock records.

---

## 4. Detection Evaluation & Benchmarking (Phase 3)

* Machine learning unit and SHAP drift tests are **deferred** per [ADR-002](./decisions/ADR-002-defer-ml-training.md).
* Replaced by the comprehensive **Phase 3 Detection Evaluation Plan** ([29. Detection Evaluation Plan](./29_DETECTION_EVALUATION_PLAN.md)):
  * Benchmarks the deterministic pipeline against 10,000 top benign domains (Tranco) and 5,000 active phishing domains (PhishTank/OpenPhish).
  * Measures True Positive Rate (Recall), False Positive Rate (FPR), and provider failure degradation modes.
