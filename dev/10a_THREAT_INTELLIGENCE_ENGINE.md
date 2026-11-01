# 10a. Threat Intelligence Engine

* **Product:** Site Sentry
* **Status:** Active & Prioritized (Core Detection Layer)
* **Canonical Path:** `dev/10a_THREAT_INTELLIGENCE_ENGINE.md`
* **Implementation:** `services/api/src/engines/threat_intelligence/`
* **Authoritative Contract:** [28. Provider Resilience and Failure Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md)

---

## 1. Overview & Architectural Role

The **Threat Intelligence Engine** (`services/api/src/engines/threat_intelligence/`) manages outbound lookups against global authoritative threat databases. It serves as an abstraction and resilience layer, querying external security APIs asynchronously, enforcing bounded timeouts, caching lookups in Redis, and normalizing threat signals into structured results.

---

## 2. Active External Providers

Site Sentry integrates two primary authoritative providers:
1. **Google Safe Browsing API v4:**
   * Checks target URLs and domains against Google's global malware, phishing, and unwanted software threat lists.
   * High-confidence source: A confirmed match is treated as an authoritative threat.
2. **VirusTotal API v3:**
   * Queries domain reports to evaluate multi-vendor antivirus scanner consensus (80+ security engines).
   * Extracts malicious and suspicious detection counts, vendor lists, and reputation scores.

*Note on Additional Providers:* Feeds such as PhishTank, OpenPhish, and specialized WHOIS registrars remain optional future enhancements and are not required for the current baseline.

---

## 3. Strict Provider Outcome Semantics

To prevent network glitches or API outages from compromising user safety, the Threat Intelligence Engine maps every query into explicit operational states per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md):

| Outcome State | Operational Meaning | Pipeline Impact |
| :--- | :--- | :--- |
| **`SUCCESS_THREAT`** | Confirmed match against active malware/phishing feed (GSB match or VirusTotal $\ge 3$ detections). | Triggers hard threat override; clamps score $\le 10.0$; maps to `action = "block"`. |
| **`SUCCESS_SUSPICIOUS`** | Low vendor detection counts (VirusTotal 1–2 vendor flags). | Applies proportional deduction ($-10$ to $-20$ points, capped at 50); triggers `action = "warn"`. Does not trigger hard clamp. |
| **`SUCCESS_CLEAN`** | Provider successfully verified domain is absent from threat lists. | Normal analysis proceeds; 0 deduction. |
| **`TIMEOUT`** | Provider request exceeded bounded deadline (2.5 seconds). | Flagged as `data_completeness = False`. Contributes to `threat_category = "inconclusive"` under `action = "warn"`. |
| **`RATE_LIMITED`** | Provider returned HTTP 429 (quota exceeded). | Flagged as `data_completeness = False`. Initiates cooldown window. |
| **`ERROR`** | HTTP 5xx, DNS failure, network disconnect, or malformed JSON. | Flagged as `data_completeness = False`. Diagnostics logged. |

> [!CAUTION]
> **Core Safety Guarantee:** A failed, timed out, or rate-limited provider check must **NEVER** be represented as clean or safe. If threat intelligence is unreachable and structural rules detect no red flags, the API returns `action = "warn"` with `threat_category = "inconclusive"` (`data_completeness = False`), never an `"allow"`.

---

## 4. Latency Budget & Caching Architecture

* **Latency Expectations:**
  * **Normal-Case Target:** $< 500\text{ms}$ total response budget during normal network operations.
  * **Worst-Case Deadline:** Hard deadline of $2.5\text{s}$ per provider (`THREAT_INTEL_TIMEOUT_SECONDS` in `services/api/src/core/config.py`). If a provider hangs, it is aborted to avoid blocking browser navigation.
* **Two-Tier Redis Caching (Implemented vs. Proposed):**
  * **Implemented OSINT Cache:** Domain-level threat results are cached under `sitesentry:cache:osint:{domain}` with a 24-hour TTL (`86400s`), written strictly when `data_completeness == True`.
  * **Implemented URL Analysis Cache:** Full scan results are cached under `sitesentry:cache:url:{sha256(url)}` with a 1-hour TTL (`REDIS_CACHE_TTL_SECONDS = 3600s`).
  * **Proposed Policies (Under Review):** Differential 6-hour threat TTLs and 30–60s negative rate-limit caching are proposed enhancements per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md).

---

## 5. Normalized Output Schema (`ThreatIntelResult`)

```json
{
  "is_threat": false,
  "is_complete": true,
  "gsb_match": false,
  "vt_positives": 0,
  "vt_total": 72,
  "vt_malicious_count": 0,
  "threat_categories": [],
  "provider_statuses": {
    "google_safe_browsing": "SUCCESS_CLEAN",
    "virus_total": "SUCCESS_CLEAN"
  },
  "cached": true
}
```
