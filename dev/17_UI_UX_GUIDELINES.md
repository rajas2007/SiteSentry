# 17. UI/UX Design & Warning Guidelines

* **Product:** Site Sentry
* **Design Philosophy:** Evidence-Grounded, Tamper-Proof, and Actionable
* **Canonical Path:** `dev/17_UI_UX_GUIDELINES.md`
* **Related ADR:** [ADR-005: Preferring Explicit Browser Warning Over DOM Tampering](./decisions/ADR-005-browser-warning-over-dom-tampering.md)
* **Related Contract:** [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md)

---

## 1. Design Philosophy

Site Sentry translates complex security signals into immediate, unambiguous user protections.

Key UX Tenets:
1. **Zero Fake Telemetry:** The interface must never display fake or fabricated analysis steps (e.g., claiming to audit smart contracts or run LLM policy analysis when those subsystems are deferred).
2. **Tamper-Proof Surfaces:** Security alerts and warning dialogs must be rendered strictly on trusted browser surfaces (extension-origin interstitial pages, toolbar badges, and isolated popups) rather than vulnerable in-page DOM overlays.
3. **Actionable Exit Paths:** Every warning must provide a prominent, friction-free exit route ("Take me back to safety") alongside a secondary technical evidence drawer.

---

## 2. Browser Extension UI Surfaces

### 2.1. Full-Tab Warning Interstitial (`pages/warning.html`)
* **Trigger:** Received `action == "BLOCK"` from the Decision Engine.
* **Origin:** `chrome-extension://.../pages/warning.html` (Isolated from target page scripts and CSS).
* **Visual Hierarchy:**
  * High-visibility red shield icon with bold headline: **"Deceptive or Malicious Site Blocked"**.
  * Clear explanation of the threat (e.g., "Google Safe Browsing flagged this site as an active credential-harvesting phishing page").
  * Primary Action Button (High Contrast): **"Take Me Back to Safety"** (returns user to previous page or closes tab).
  * Collapsible Secondary Section: **"Technical Findings & Evidence"** detailing specific signals with an explicit, confirmed bypass option for advanced security testers.

### 2.2. Extension Toolbar Badge
* **Green Shield (`ALLOW`):** Confirmed clean analysis from both threat feeds with zero suspicious structural findings.
* **Amber Shield (`WARN`):** Observable risk signals detected (e.g., homoglyph, high VT detections, external form action).
* **Amber Question Mark (`INCONCLUSIVE`):** Upstream threat feeds timed out or were rate limited.
* **Red Shield (`BLOCK`):** Active threat detected.
* **Grey Icon (`ERROR`):** Backend unreachable.

### 2.3. Extension Popup Drawer (`src/popup/`)
* **Score Gauge:** Prominent display of the fused Security Score ($0 - 100$).
* **Provider Checklist:** Displays real-time operational status for Google Safe Browsing and VirusTotal (Verified / Unavailable).
* **Findings Accordion:** Itemized findings with severity tags (Critical, High, Medium, Low) and plain-English explanations.

---

## 3. Web Management Dashboard UX (`apps/dashboard/`)

* **Authentic Data Only:** Directly visualizes genuine scan telemetry fetched from `/api/v1/history` without synthetic mock generators.
* **Status Color System:**
  * Emerald / Green: Safe (`ALLOW`)
  * Amber / Yellow: Suspicious / Inconclusive (`WARN` / `INCONCLUSIVE`)
  * Rose / Red: Confirmed Threat (`BLOCK`)
  * Slate / Gray: Analysis Error (`ERROR`)
* **Detailed Audit Drawer:** Clicking any scan entry opens a slide-over panel displaying the full breakdown of lexical signals, structural DOM counts, and raw threat provider responses.
