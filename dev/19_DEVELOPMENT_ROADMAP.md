# 19. Development Roadmap

* **Product:** Site Sentry
* **Status:** Authoritative 5-Phase Product Roadmap
* **Canonical Path:** `dev/19_DEVELOPMENT_ROADMAP.md`
* **Related ADRs:**
  * [ADR-001: Prioritizing Deterministic Rules & Threat Intel](./decisions/ADR-001-deterministic-security-priority.md)
  * [ADR-002: Deferring Machine Learning Model Training](./decisions/ADR-002-defer-ml-training.md)
  * [ADR-003: Retaining FastAPI Modular Monolith Architecture](./decisions/ADR-003-modular-monolith-architecture.md)
  * [ADR-004: Deferring Web3 & Community Intelligence](./decisions/ADR-004-defer-web3-community-intelligence.md)
  * [ADR-005: Preferring Explicit Browser Warning Over DOM Tampering](./decisions/ADR-005-browser-warning-over-dom-tampering.md)

---

## Strategic Roadmap Overview

Site Sentry follows a disciplined, evidence-driven development sequence. Rather than adding complex, unvalidated machine learning models or speculative features, the roadmap prioritizes stabilizing and benchmarking the deterministic security baseline before any machine learning model is trained.

```
┌─────────────────────────────────┐
│ Phase 1: Audit & Documentation  │ (Current)
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Phase 2: Pipeline Reliability   │ (Threat Intel & Structural Rules)
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Phase 3: Detection Evaluation   │ (Empirical Precision, Recall, FPR)
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Phase 4: Targeted Improvements  │ (Evidence-Driven Rule Optimization)
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Phase 5: Reassess ML Decision   │ (Empirical ML Proposal if Justified)
└─────────────────────────────────┘
```

---

## Phase 1: Documentation Audit & Alignment (Complete / Under Review)
**Goal:** Align architectural documentation with real codebase state, establish binding contracts, and resolve contradictions across all 32 specifications.
*(Note: Phase 1 represents completed documentation work. It does not certify that all described system behaviors are verified or fully covered by automated tests.)*
* [x] Audit working tree and preserve untracked contracts (`MODEL_CONTRACT.md`).
* [x] Establish canonical product naming (**Site Sentry**) across all documentation.
* [x] Author core Architecture Decision Records (ADR-001 through ADR-005) as `Proposed (Under Review)`.
* [x] Reconcile conflicting VirusTotal policies (superseding older zeroing rule with code-verified $\ge 3$ blacklist clamp and 1–2 vendor capped deduction).
* [x] Standardize canonical scan endpoint (`POST /api/v1/analyze`) and dashboard endpoints (`GET /api/v1/history`, `GET /api/v1/analytics/overview`).
* [x] Establish binding contracts:
  * [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md)
  * [28. Provider Resilience and Failure Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md)
  * [29. Detection Evaluation Plan](./29_DETECTION_EVALUATION_PLAN.md)
  * [30. Threat Model](./30_THREAT_MODEL.md)
  * [31. Data Privacy and Retention Specification](./31_DATA_PRIVACY_AND_RETENTION.md)
* [x] Formally document deferred status of ML model training, Web3 auditing, and crowdsourced community intelligence.

---

## Phase 2: Security Pipeline Reliability & Code Verification (Next Milestone)
**Goal:** Empirically verify and harden the deterministic detection pipeline, test suites, and provider resilience against the specifications authored in Phase 1.
*(Note: These are planned milestone engineering tasks, not claims that implementation verification is complete.)*
* [ ] **Threat Intelligence Validation:** Verify Google Safe Browsing and VirusTotal integration handling under edge conditions (network drops, rate limits, malformed payloads).
* [ ] **Deterministic Scoring Semantics:** Verify that `ScoreFusionEngine` consistently caps VirusTotal deductions at 50.0 points and clamps scores $\le 10.0$ on confirmed threats across all test suites.
* [ ] **Provider Failure Semantics:** Ensure timed out or failed threat lookups strictly yield `data_completeness = False` and result in `action = "warn"` with `threat_category = "inconclusive"` rather than `action = "allow"`.
* [ ] **Evidence-Based Explanations:** Validate that all `SecurityEngine` structural findings output clean, user-friendly plain-English descriptions in extension popups.
* [ ] **Warning Integrity:** Verify that `block` decisions reliably redirect to `chrome-extension://.../pages/warning.html` without executing in-page DOM mutations.
* [ ] **Regression Test Coverage:** Expand integration test suites covering concurrent threat lookups, cache state transitions, and edge-case payload validation.

---

## Phase 3: Detection Evaluation
**Goal:** Quantitatively measure the real-world accuracy of the deterministic pipeline per [29. Detection Evaluation Plan](./29_DETECTION_EVALUATION_PLAN.md).
* [ ] **Evaluation Datasets:** Assemble a controlled test corpus (10,000 top benign domains from Tranco; 5,000 active verified malicious phishing samples from PhishTank/OpenPhish/CompPhish).
* [ ] **Benchmarking Run:** Execute the offline evaluation harness against the deterministic pipeline in an isolated sandbox.
* [ ] **Metrics Measurement:** Calculate True Positive Rate (Recall), False Positive Rate (FPR), and precision. Evaluate against target objective standard of FPR $< 0.1\%$ on top benign domains.
* [ ] **Failure Taxonomy:** Investigate top false negatives (attacks missed) and false positives (benign sites flagged).
* [ ] **Publication:** Publish the Baseline Detection Report to guide Phase 4 priorities.

---

## Phase 4: Targeted Improvements
**Goal:** Implement high-leverage detection improvements justified by Phase 3 empirical evaluation findings.
*Possible focus areas (to be selected based strictly on evaluation data):*
* [ ] **Structural Security Rules:** Introduce new targeted heuristics for specific evasion techniques uncovered in Phase 3.
* [ ] **Feature Extraction Parity:** Refine DOM structural feature extraction in the browser extension to improve fidelity on single-page applications.
* [ ] **Threat Intelligence Optimization:** Optimize Redis cache key hashing and TTL strategies.
* [ ] **Privacy-Safe Data Handling:** Refine client-side URL parameter redaction before transmission.

---

## Phase 5: Reassess ML Decision Gate
**Goal:** Re-evaluate whether training a machine learning model is justified based on empirical detection gaps.
* Model training will **only** be undertaken if Phase 3 benchmarking demonstrates:
  1. A quantifiable, high-risk detection gap that deterministic rules cannot resolve.
  2. A candidate dataset with verified raw DOM trees and clean licensing is available.
  3. A candidate model achieves higher recall without degrading false-positive rates on benign domains.
* If justified, author a formal ML Proposal covering dataset provenance, feature compatibility, training methodology, inference latency, and operational maintenance costs.
* Otherwise, keep machine learning deferred and maintain the high-performance deterministic engine.

---

## Officially Deferred Future Capabilities

The following capabilities are officially **deferred** from immediate development:
* **ML Model Training & SHAP Integration:** Deferred per [ADR-002](./decisions/ADR-002-defer-ml-training.md).
* **Full Privacy Policy Legal AI Analysis:** Deferred per [11. Privacy Intelligence Engine](./11_PRIVACY_ENGINE.md).
* **Web3 & Smart Contract Auditing:** Deferred per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
* **Crowdsourced Community Reputation & Staking:** Deferred per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
* **Enterprise Multi-Tenant Fleet Administration:** Deferred per [23. Future Scope](./23_FUTURE_SCOPE.md).
* **Visual Phishing Detection (Computer Vision / Screenshot OCR):** Deferred per [23. Future Scope](./23_FUTURE_SCOPE.md).
* **Mobile Applications (iOS / Android):** Deferred per [23. Future Scope](./23_FUTURE_SCOPE.md).
* **Distributed Microservices / Broker Infrastructure:** Deferred per [ADR-003](./decisions/ADR-003-modular-monolith-architecture.md).
