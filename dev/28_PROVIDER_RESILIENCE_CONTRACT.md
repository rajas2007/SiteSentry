# 28. Provider Resilience and Failure Contract

* **Status:** Authoritative Contract & Implementation Mapping
* **Canonical Path:** `dev/28_PROVIDER_RESILIENCE_CONTRACT.md`
* **Related Engines:** `ThreatIntelligenceEngine`, `ScanService`, `DecisionEngine`
* **External Dependencies:** Google Safe Browsing API v4, VirusTotal API v3
* **Code Reference:** `services/api/src/engines/threat_intelligence/engine.py`, `services/api/src/core/redis.py`, `services/api/src/core/config.py`

---

## 1. Purpose & Core Axiom

Site Sentry integrates external threat intelligence providers (Google Safe Browsing and VirusTotal) to detect active phishing and malware campaigns. Because external networks and third-party APIs are susceptible to latency spikes, rate limits, and outages, this contract defines the exact failure-handling rules, timeouts, caching tiers, and reporting guarantees.

**Core Axiom:**
> A failed, timed-out, or rate-limited provider check must **NEVER** be represented or treated as a clean/safe result.

---

## 2. Latency Budget: Normal-Case Targets vs. Worst-Case Deadlines

To prevent user confusion, Site Sentry strictly distinguishes normal-case latency targets from worst-case timeout deadlines:

| Execution Path | Typical Operational Latency | Worst-Case Deadline | Behavior on Deadline Expiry |
| :--- | :--- | :--- | :--- |
| **Cache Hit (Redis)** | $10\text{ms} - 50\text{ms}$ | $100\text{ms}$ | Serves cached `PageAnalysisResponse` immediately. |
| **Normal Live Scan** | $200\text{ms} - 450\text{ms}$ | $500\text{ms}$ | Asynchronous lookups across GSB and VirusTotal complete within typical cloud network round-trips. |
| **Degraded Provider / High Latency** | $1000\text{ms} - 2400\text{ms}$ | **$2.5\text{s}$ per provider** (`THREAT_INTEL_TIMEOUT_SECONDS`) | Request aborted; provider marked `"unavailable"`; `data_completeness` set to `False`. |
| **Total Pipeline Deadline** | N/A | **$3.0\text{s}$ total budget** | `ScanService` completes in-memory scoring with available evidence. |

* **Normal-Case Target ($< 500\text{ms}$):** The design target for user navigation under healthy provider network conditions.
* **Worst-Case Deadline ($2.5\text{s} - 3.0\text{s}$):** The hard timeout ceiling enforced by `httpx.AsyncClient(timeout=2.5)` in `GoogleSafeBrowsingClient` and `VirusTotalClient`. If an external feed hangs, the connection is cancelled to prevent blocking browser navigation indefinitely.

---

## 3. Threat Intelligence Provider Outcome States

Every provider lookup resolves into one of five explicit operational states:

| Outcome State | Provider Response | Contribution to Threat Score | Affects Analysis Completeness? |
| :--- | :--- | :--- | :--- |
| **`SUCCESS_THREAT`** | Confirmed match against active malware/phishing threat list (GSB match or VirusTotal $\ge 3$ detections entering `blacklists_triggered`). | Sets `blacklists_triggered`; triggers hard score clamp $\le 10.0$ and `action = "block"`. | No (`data_completeness = True`). |
| **`SUCCESS_SUSPICIOUS`** | Provider returned low vendor detection signals (VirusTotal 1–2 detections). | Applies proportional deduction ($-10$ to $-20$ points, capped at 50); triggers `action = "warn"`. Does not trigger hard clamp. | No (`data_completeness = True`). |
| **`SUCCESS_CLEAN`** | Checked URL/domain; confirmed absent from threat database. | Zero score deduction (indicates absence of known blacklist entry). | No (`data_completeness = True`). |
| **`TIMEOUT`** | Exceeded the $2.5\text{s}$ hard deadline. | Zero score deduction (no threat confirmed). | **Yes (`data_completeness = False`).** |
| **`RATE_LIMITED`** | Returned HTTP 429 (Too Many Requests). | Zero score deduction. Provider marked unavailable. | **Yes (`data_completeness = False`).** |
| **`ERROR`** | HTTP 5xx, DNS failure, network disconnect, or malformed JSON. | Zero score deduction. Diagnostic logged. | **Yes (`data_completeness = False`).** |

---

## 4. Partial Availability Matrix & Decision Mapping

When multiple providers are queried, the combined outcome depends on the logical union of results:

| Google Safe Browsing | VirusTotal | Structural Security Rules | Combined Assessment | API Action (`decision.action`) | Threat Category |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SUCCESS_THREAT` | `TIMEOUT` | Clean | **Threat Confirmed** | `"block"` | `"phishing"` / `"malware"` |
| `TIMEOUT` | `SUCCESS_THREAT` ($\ge 3$) | Clean | **Threat Confirmed** | `"block"` | `"malicious_domain"` |
| `TIMEOUT` | `SUCCESS_SUSPICIOUS` (1–2) | Clean ($\text{Score} \ge 80$) | **Vendor Threat Signal** | `"warn"` | `"elevated_risk"` |
| `SUCCESS_CLEAN` | `SUCCESS_CLEAN` | Clean ($\text{Score} \ge 80$) | **Clean & Complete** | `"allow"` | `"safe"` |
| `SUCCESS_CLEAN` | `TIMEOUT` / `ERROR` | Clean ($\text{Score} \ge 80$) | **Incomplete Analysis** | `"warn"` | `"inconclusive"` |
| `TIMEOUT` / `ERROR` | `TIMEOUT` / `ERROR` | Clean ($\text{Score} \ge 80$) | **Incomplete Analysis** | `"warn"` | `"inconclusive"` |
| `TIMEOUT` / `ERROR` | `TIMEOUT` / `ERROR` | Isolated `insecure_login` ($-40$ pts, Score 60) | **Suspicious / Moderate Risk** | `"warn"` | `"credential_theft"` |
| `TIMEOUT` / `ERROR` | `TIMEOUT` / `ERROR` | Combined: `insecure_login` + `no_https` ($-70$ pts, Score 30 $< 50$) | **High-Risk Vulnerability** | `"block"` | `"credential_theft"` |

### Key Policy Rules
1. **Threat Authority:** If **any** provider returns a verified positive threat, the verdict immediately initiates a threat clamp, overriding timeouts from other providers.
2. **Never Allow on Incomplete Data:** If external threat intelligence is unavailable (`data_completeness == False`) and structural rules detect no red flags, the API returns `action = "warn"` with `threat_category = "inconclusive"`. The API **never** returns `"allow"` for an incomplete scan.

---

## 5. Two-Tier Redis Caching Architecture

Site Sentry implements two distinct Redis caching tiers in `services/api/src/core/redis.py`:

```
┌────────────────────────────────────────────────────────┐
│ Tier 1: OSINT Domain Threat Intelligence Cache         │
│ Key: sitesentry:cache:osint:{domain}                   │
│ Scope: Domain-wide external threat data                │
│ Implemented TTL: 86,400s (24 Hours)                    │
│ Condition: Cached ONLY when data_completeness == True  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Tier 2: Full Page-Analysis URL Cache                   │
│ Key: sitesentry:cache:url:{sha256(normalized_url)}     │
│ Scope: Specific URL page response (DOM + Threat Intel) │
│ Implemented TTL: REDIS_CACHE_TTL_SECONDS (1 Hour)      │
│ Condition: Cached ONLY when data_completeness == True  │
└────────────────────────────────────────────────────────┘
```

### 5.1. Cache Integrity Rules
1. **Page-Specific Structural Evidence:** Because DOM characteristics (e.g., login forms, password inputs, external form action targets) are specific to a page path rather than an entire domain, full analysis results are strictly keyed by the SHA-256 hash of the canonical URL (`sitesentry:cache:url:...`).
2. **Domain-Level OSINT:** Threat intelligence lookups from GSB and VirusTotal are domain-scoped and cached under `sitesentry:cache:osint:{domain}` to prevent repeated redundant third-party API queries across different pages of the same site.
3. **Incomplete Scans Are Not Cached Long-Term:** In the current implementation (`ScanService.analyze_page()`), results are written to Redis **only if `data_completeness` is `True`**. Timed-out or rate-limited scans are skipped to ensure immediate re-evaluation on subsequent visits.

### 5.2. Proposed Future Caching Enhancements (Under Review)
* Differential TTLs: 6-hour cache for confirmed threats vs. 24-hour cache for clean domains.
* Short-lived negative caching ($30\text{s} - 60\text{s}$) for rate-limited endpoints to prevent thundering herds.
*(Note: These enhancements are currently proposed requirements, not active in the current codebase).*
