# 12. Trust Engine & Domain Reputation

* **Product:** Site Sentry
* **Status:** Simplified / Independent Scoring Layer Deferred (Section 3.10)
* **Canonical Path:** `dev/12_TRUST_ENGINE.md`
* **Implementation:** `services/api/src/engines/trust/`
* **Database Model:** `DomainReputation` (`services/api/src/models/scan.py`)
* **Related Specification:** [16. Score Fusion Engine](./16_SCORING_ENGINE.md)

---

## 1. Overview & Architectural Simplification

In the original TrustLens AI architecture, the **Trust Engine** was proposed as an independent, secondary scoring layer that took the output of the Score Fusion Engine and applied a second layer of penalties based on historical corporate entity verification, crowdsourced reports, and domain age.

Under Site Sentry's revised architecture (Section 3.10), **the Trust Engine's role as an independent live scoring layer is deferred and simplified**:
1. **Separation of Evidence and History:** Current observable scan evidence (URL syntax, DOM inputs, threat feeds) and historical domain telemetry are kept conceptually distinct.
2. **Missing History is Not Malice:** The absence of historical scan records for a newly observed domain represents **uncertainty**, not proof of malicious intent. Newly encountered sites must not receive arbitrary reputation penalties without documented, validated justification.
3. **Excluded from Critical Scan Loop:** `ScanService.analyze_page()` relies on the **Score Fusion Engine** and **Decision Engine** for authoritative verdicts. It does not invoke an opaque second scoring pass.

---

## 2. Historical Domain Reputation Baseline (`DomainReputation`)

While independent trust scoring is deferred, historical domain telemetry is actively recorded in PostgreSQL via the `DomainReputation` model:
* **Tracked Metrics:**
  * `domain`: The canonical fully qualified domain name (or eTLD+1).
  * `total_scans`: Cumulative number of times users have scanned this domain.
  * `threat_count`: Number of confirmed threat scans recorded for this domain.
  * `average_score`: Rolling average security score across all scans.
  * `last_scanned_at`: Timestamp of most recent scan.
* **Purpose:** Provides historical telemetry for dashboard reporting and offline security analysis. It does **not** dynamically penalize or override real-time scan findings.

---

## 3. Principles for Any Future Trust Scoring

If the engineering team evaluates an active trust-scoring layer in future phases, it must adhere to four strict principles:
1. **Mathematical Transparency:** Any trust formula must be fully documented, deterministic, and bounded.
2. **No False Penalties on New Sites:** A clean blog or personal portfolio hosted on a new domain must not be pushed into `SUSPICIOUS` or `WARN` simply due to lack of historical tenure.
3. **No Unverified Community Weighting:** Unverified user feedback must never degrade domain reputation per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
4. **Subservience to Threat Intel:** Historical domain tenure cannot override or soften an active positive threat from Google Safe Browsing or VirusTotal.
