# 27. Security Decision Contract

* **Status:** Authoritative Contract & Implementation Mapping
* **Canonical Path:** `dev/27_SECURITY_DECISION_CONTRACT.md`
* **Related Engines:** `SecurityEngine`, `ThreatIntelligenceEngine`, `ScoreFusionEngine`, `DecisionEngine`
* **Target Clients:** Browser Extension (`apps/extension`), Web Dashboard (`apps/dashboard`)
* **Code Reference:** `services/api/src/engines/score_fusion/engine.py`, `services/api/src/engines/decision/engine.py`, `services/api/src/schemas/analysis.py`

---

## 1. Purpose & Separation of Concerns

This contract defines the authoritative decision policy for Site Sentry. To eliminate ambiguity, the system strictly separates seven distinct concepts:

1. **Security Findings:** Individual observable signals or vendor verdicts emitted by analyzers (e.g., `insecure_login`, `no_https`, GSB threat match, VT detection count).
2. **Risk Score:** A normalized integer score from `0` to `100` calculated by `ScoreFusionEngine`.
3. **Severity:** An assessment level strictly constrained by the API schema to `Literal["low", "medium", "high"]`.
4. **Final Security Action:** The operational directive in the API response schema, strictly constrained to `Literal["allow", "warn", "block"]`.
5. **Analysis Completeness:** A boolean attribute (`data_completeness: bool`) indicating whether all external threat intelligence providers responded successfully.
6. **Operational Failure:** A client-side or transport-level failure state (network drop, HTTP 5xx, backend unreachable) where no valid scan response is received.
7. **UI Presentation:** The visual surfaces and indicators (badge color: `emerald`, `amber`, `rose`, `slate`; full-tab warning interstitial vs. popup drawer).

---

## 2. Decision State Mapping & Precedence Matrix

The following table reflects the verified logic implemented in `services/api/src/engines/decision/engine.py` and `services/api/src/engines/score_fusion/engine.py`:

| Assessment Category | Trigger Conditions | Fused Score | API Severity (`severity`) | API Action (`decision.action`) | Threat Category (`threat_category`) | UI Color (`ui.color`) | Client UI Presentation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Confirmed Threat** | Google Safe Browsing match, or VirusTotal malicious detections $\ge 3$ (`blacklists_triggered`), or category is `phishing`/`malware`. | $\le 10$ (Clamped) | `"high"` | `"block"` | `"phishing"` / `"malware"` / `"malicious_domain"` | `"rose"` | Full-tab warning interstitial (`warning.html`). Red toolbar badge. Navigation blocked. |
| **High-Risk Vulnerability** | Severe structural findings (e.g., `insecure_login` [$-40$ pts] + `no_https` [$-30$ pts]) resulting in score $< 50$. | $0 - 49$ | `"high"` | `"block"` | `"credential_theft"` | `"rose"` | Full-tab warning interstitial (`warning.html`). Red toolbar badge. Warns: *"Do not enter personal info."* |
| **Suspicious / Moderate Risk** | Low VirusTotal detections (1–2 flags), or structural deductions bringing score to $50 - 79$. | $50 - 79$ | `"medium"` | `"warn"` | `"elevated_risk"` / `"suspicious_content"` | `"amber"` | Amber toolbar badge. Extension popup displays itemized warnings. |
| **Incomplete Analysis** | Threat intelligence provider timed out, rate limited, or errored (`data_completeness = False`), while structural score is otherwise $\ge 80$. | $\ge 80$ | `"medium"` | `"warn"` | `"inconclusive"` | `"amber"` | Amber toolbar badge. Extension popup displays: *"Threat intelligence checks could not be completed; exercise caution."* |
| **Verified Clean** | Threat intelligence complete with 0 detections, no high-risk structural findings, score $\ge 80$. | $80 - 100$ | `"low"` | `"allow"` | `"safe"` | `"emerald"` | Green shield badge. Extension popup displays *"Safe to browse."* |
| **Operational Failure** | Backend unreachable, network disconnect, or HTTP 5xx error. | None | N/A (Client State) | N/A (Client State) | N/A (Client State) | `"slate"` | Grey offline badge. Popup displays network error banner with *"Retry Scan"* CTA. |

---

## 3. Precedence & Evaluation Rules

The Decision Engine evaluates inputs in a strict hierarchical order:

```
[Score & Findings Input]
         │
         ▼
1. Is Score < 50 OR Threat Category in {"phishing", "malware"}?
   ├──► YES ──► severity = "high", action = "block", color = "rose"
   │            (If category == "credential_theft" -> warn against personal info)
   ▼ NO
2. Is has_confirmed_threat == True? (e.g. VT 1-2 vendor flags / threat signal)
   ├──► YES ──► severity = "medium", action = "warn", color = "amber"
   ▼ NO
3. Is data_completeness == False AND Score >= 80?
   ├──► YES ──► severity = "medium", action = "warn", color = "amber", threat_category = "inconclusive"
   ▼ NO
4. Is Score >= 80?
   ├──► YES ──► severity = "low", action = "allow", color = "emerald"
   ▼ NO
5. Default Fallback (50 <= Score < 80)
   └──────────► severity = "medium", action = "warn", color = "amber"
```

### Key Precedence Principles
1. **Rule of Non-Dilution:** Confirmed threat intelligence matches (`blacklists_triggered`) force the score $\le 10$ and set `has_confirmed_threat = True`, making a `"block"` action unavoidable. High DOM cleanliness cannot soften this verdict.
2. **Structural Vulnerabilities vs. Confirmed Threats:** When severe combined structural deductions (e.g., `insecure_login` [$-40$ pts] + `no_https` [$-30$ pts] = score 30) bring a site below score 50, it receives `"block"`, with threat category `"credential_theft"` rather than a confirmed external malware feed match. An isolated `insecure_login` deduction ($-40$ pts from 100 baseline yields score 60) falls in the $50 - 79$ range and results in `"warn"`; a `"block"` requires cumulative deductions to push the score below 50. This distinction preserves evidentiary honesty in the user warning.
3. **Honest Uncertainty:** When threat feeds fail (`data_completeness = False`), an otherwise clean site is **prevented from receiving `"allow"`**. The engine sets `action = "warn"`, `severity = "medium"`, and `threat_category = "inconclusive"`.
4. **Schema Compliance:** The API schema for `Decision.action` is strictly `Literal["allow", "warn", "block"]`. Incomplete analysis is represented by setting `threat_category = "inconclusive"` within an `action = "warn"` envelope, rather than introducing an invalid or breaking action enum value.
5. **Vendor Threat Signals vs. Confirmed Threats:** Detections from 1–2 VirusTotal engines represent vendor threat signals rather than independently confirmed threats. While the codebase sets the boolean flag `has_confirmed_threat = True` for any non-zero vendor flags, the Decision Engine routes these cases to `"warn"` rather than `"block"`. Documenting this naming ambiguity resolves confusion without altering the underlying runtime contract.

---

## 4. UI Warning Presentation Contract

### 4.1. The `"block"` Action
* Triggered when `score < 50` or `threat_category in {"phishing", "malware"}`.
* Executed by the extension via tab redirection to `chrome-extension://.../pages/warning.html`.
* Renders an isolated interstitial presenting:
  * The specific threat category (`phishing`, `malware`, or `credential_theft`).
  * Itemized explanatory factors from `response.factors`.
  * Primary CTA: **"Take Me Back to Safety"** (navigates back or closes tab).

### 4.2. The `"warn"` Action (Suspicious or Inconclusive)
* Toolbar icon sets an amber badge.
* The user is not redirected. Opening the extension popup displays:
  * If `threat_category == "inconclusive"`: Clear disclosure that external threat checks timed out, advising vigilance.
  * If `threat_category != "inconclusive"`: Itemized risk factors (e.g., suspicious hostname, non-HTTPS transport).

### 4.3. The `"allow"` Action
* Toolbar icon displays an emerald green shield.
* Popup displays *"Safe to browse"* with verified provider statuses.

### 4.4. Operational Failure (Client-Side)
* When no HTTP response is received from the backend, the extension service worker handles the failure locally.
* It does not construct a mock `PageAnalysisResponse`. The popup displays an offline state with a manual retry button.
