# 16a. Decision Engine

* **Product:** Site Sentry
* **Status:** Authoritative Decision Logic & Schema Mapping
* **Canonical Path:** `dev/16a_DECISION_ENGINE.md`
* **Implementation:** `services/api/src/engines/decision/engine.py`
* **API Schema:** `services/api/src/schemas/analysis.py` (`Decision`, `DecisionUI`)
* **Authoritative Contract:** [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md)
* **Related ADR:** [ADR-005: Preferring Explicit Browser Warning Over DOM Tampering](./decisions/ADR-005-browser-warning-over-dom-tampering.md)

---

## 1. Overview & Architectural Role

The **Decision Engine** (`services/api/src/engines/decision/`) is the final analytical authority in the Site Sentry scanning pipeline. It evaluates the fused risk score, the presence of confirmed threats, and the **completeness of the analysis** to emit the final operational decision object:

```python
class Decision(BaseModel):
    action: Literal["allow", "warn", "block"]
    severity: Literal["low", "medium", "high"]
    ui: DecisionUI  # color: Literal["emerald", "amber", "rose", "slate"]
```

---

## 2. Decision Matrix & Thresholds

The following matrix reflects the exact thresholds implemented in `services/api/src/engines/decision/engine.py`:

| Evaluation Stage | Score & Conditions | Severity | Action (`decision.action`) | Threat Category | UI Color | User Recommendation & UI State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Confirmed Threat or Critical Vulnerability** | $\text{Score} < 50$ OR category in `{"phishing", "malware"}` | `"high"` | `"block"` | `"phishing"` / `"malware"` / `"credential_theft"` | `"rose"` | **"Leave site immediately."** Full-tab interstitial redirect (`warning.html`). Red toolbar badge. |
| **Vendor Threat Signal (Low Detection)** | $\text{Score} \ge 50$ AND `has_confirmed_threat == True` (e.g., VT 1–2 vendor flags) | `"medium"` | `"warn"` | Preserved category | `"amber"` | **"Security vendors flagged potential threats on this domain; review carefully."** Amber badge. |
| **Incomplete Analysis** | $\text{Score} \ge 80$ AND `data_completeness == False` (Provider failed / timed out) | `"medium"` | `"warn"` | `"inconclusive"` | `"amber"` | **"Threat intelligence checks could not be completed; exercise caution on this site."** Amber question badge. |
| **Verified Clean** | $\text{Score} \ge 80$ AND `data_completeness == True` | `"low"` | `"allow"` | `"safe"` | `"emerald"` | **"Safe to browse."** Green toolbar badge. |
| **Elevated Risk / Suspicious** | $50 \le \text{Score} < 80$ (No confirmed threat) | `"medium"` | `"warn"` | `"elevated_risk"` / `"suspicious_content"` | `"amber"` | **"Review the site carefully before proceeding."** Amber badge. |
| **Operational Failure (Client-Side)** | Backend unreachable, network timeout, HTTP 5xx | N/A | N/A | N/A | `"slate"` | **"Site Sentry backend unavailable."** Grey badge. Popup displays retry button. |

> *(Note on implementation terminology: In the current code (`score_fusion/engine.py`), the flag name `has_confirmed_threat` is set to `True` whenever `total_vendor_flags > 0`, including 1–2 vendor detections. However, 1–2 vendor flags represent low-confidence vendor threat signals rather than independently confirmed threats. This triggers a cautionary `"warn"` action rather than a `"block"`. The naming of `has_confirmed_threat` for low vendor detections is an acknowledged implementation detail slated for future review).*

---

## 3. Critical Policy: Warnings Over Invasive DOM Tampering

> [!CAUTION]
> **Rejection of In-Page Password Field Disabling (ADR-005):**
> An earlier design concept suggested that on suspicious or phishing sites, the content script should mutate the target page's DOM to disable password fields (`input.disabled = true`).
>
> **Site Sentry officially rejects this practice as an insecure anti-pattern:**
> 1. Hostile JavaScript on the phishing page can easily circumvent DOM-level field disabling via mutation observers, script re-enabling, or capturing keystrokes on window-level event listeners.
> 2. Mutating the target DOM causes severe breakages on legitimate websites during false alarms and interferes with password managers (Bitwarden, 1Password) and browser autofill.
> 3. In-page warning banners injected directly into third-party HTML can be hidden with CSS (`display: none !important`), redressed, or spoofed by malicious authors.
>
> **Authoritative Approach:** Site Sentry prioritizes **clear, trustworthy, tamper-proof browser warnings** rendered in isolated extension surfaces (the toolbar badge, the isolated popup, and the `chrome-extension://.../pages/warning.html` interstitial) that execute completely outside the target page's DOM.

---

## 4. Distinguishing Incomplete Analysis from Operational Failure

Site Sentry cleanly distinguishes two different non-clean situations:
1. **Incomplete Analysis (API Response):**
   * The backend was reached successfully and analyzed local page structure.
   * However, external threat intelligence feeds timed out or were rate-limited.
   * The backend returns a valid `PageAnalysisResponse` with `action = "warn"` and `threat_category = "inconclusive"`.
   * The client UI presents an **Inconclusive / Caution** warning, informing the user that threat feeds were unavailable.
2. **Operational Failure (Transport / Server Outage):**
   * The browser extension could not connect to the FastAPI backend (e.g. server down, DNS error, network drop).
   * No `PageAnalysisResponse` exists.
   * Handled purely within the extension client as an offline state (`slate` color), allowing the user to retry the scan.
