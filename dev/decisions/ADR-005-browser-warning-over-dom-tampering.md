# ADR-005: Preferring Explicit Browser Warning Over Invasive DOM Manipulation

* **Status:** Proposed (Under Review)
* **Date:** 2026-10-19
* **Authors:** Site Sentry Core Engineering Team
* **Deciders:** Browser Extension Engineering, UI/UX, Product Security

---

## 1. Context

The original TrustLens AI extension specification (`dev/07_EXTENSION_ARCHITECTURE.md`) proposed an invasive active intervention model: when a website was classified as suspicious or malicious, the extension content script was instructed to mutate the live webpage DOM—specifically searching for all `<input type="password">` fields and disabling them (`disabled = true`) or rewriting form actions to prevent credential submission.

### Vulnerabilities & Architectural Flaws of DOM Tampering
1. **Adversarial Bypass & Mutation Race:** An adversarial web page runs full client-side JavaScript. Phishing authors can easily bypass DOM-level field disabling by using MutationObservers, cloning input nodes, re-enabling attributes, dynamically inserting shadow DOM fields, or capturing keystrokes via window-level listeners (`keydown`, `keypress`) before the form is ever submitted.
2. **In-Page Overlay Hijacking:** Any banner or modal injected directly into an untrusted page's DOM is subject to the page's CSS and JavaScript. Malicious pages can hide extension overlays (`display: none !important; opacity: 0 !important; pointer-events: none;`), spoof the overlay's appearance, or trick users with deceptive styling.
3. **Severe Breakage on False Positives:** When a legitimate website receives an inconclusive or borderline heuristic score, disabling password fields breaks legitimate login workflows, generates high user frustration, and leads users to disable or uninstall the extension.
4. **Conflicts with Password Managers:** Mutating or disabling password inputs interferes with browser-native autofill and trusted password managers (e.g., 1Password, Bitwarden, LastPass), causing unexpected browser crashes or failed authentications.

---

## 2. Decision

We **reject invasive in-page DOM mutations** (such as disabling password fields or rewriting form actions) and **mandate explicit, secure browser-level warning mechanisms**:

1. **Anti-Pattern Declaration:** Injecting code into third-party DOMs to disable inputs is officially classified as an insecure, unsupported anti-pattern for Site Sentry.
2. **Authoritative Browser UI Surfaces & Minimal Warning Model:** All security alerts, risk scores, and evidence explanations must be delivered via trusted extension surfaces, adhering to a minimal three-surface warning model:
   * **Full-Tab Interstitial Warning Page (Authoritative Blocking Surface):** For confirmed malicious threats (`action = "block"`), the extension redirects navigation to a dedicated extension-origin interstitial page (e.g., `chrome-extension://.../pages/warning.html`). As an isolated extension-origin document, it is completely immune to script tampering, CSS overrides, and event capture by the target site.
   * **Extension Toolbar Badge & Popup (Trusted Warning Surfaces):** For suspicious findings (`action = "warn"`) or incomplete threat intelligence (`threat_category = "inconclusive"`), the extension displays distinct risk badges on the toolbar icon (`emerald`, `amber`, `rose`, `slate`) and detailed, isolated security evidence inside the extension popup. Both surfaces execute strictly within extension chrome.
   * **Rejection of In-Page Overlays (Shadow DOM):** An in-page Shadow DOM overlay, even if closed, is not a browser-controlled security surface. Host scripts on an adversarial page can delete the shadow host element, overlay transparent capture elements, or suppress rendering. Consequently, in-page overlays cannot replace the authoritative extension warning interstitial and are excluded from Site Sentry's minimal warning model.
3. **User Empowerment Through Evidence:** Rather than silently or clunkily breaking forms, Site Sentry provides clear, evidence-based warnings explaining *why* the page is untrusted, advising the user not to enter credentials, and providing an immediate "Leave this site" action.

---

## 3. Rationale

* **Security Guarantee:** Extension-origin pages (`chrome-extension://`) execute in an isolated origin immune to target page scripts, CSS overrides, and clickjacking.
* **Compatibility:** Leaving target DOM elements intact ensures zero conflicts with password managers, accessibility screen readers, and browser autofill.
* **Transparent User Experience:** Educating users with clear threat intelligence and structural evidence fosters long-term security awareness rather than creating confusion through broken web forms.

---

## 4. Alternatives Considered

* **Disabling Password Fields in DOM:**
  * *Reason for Rejection:* Ineffective against determined phishing scripts; trivial to bypass via JavaScript; breaks legitimate sites during false alarms.
* **Rewriting Form Action Targets:**
  * *Reason for Rejection:* Complex and fragile; modern phishing sites submit credentials asynchronously via `fetch()` or `XMLHttpRequest` rather than traditional HTML form POSTs.
* **Silent Network Blocking via `declarativeNetRequest`:**
  * *Reason for Rejection:* Without an informative interstitial page explaining the block, users perceive silent network failures as network glitches and attempt to bypass or refresh the page.

---

## 5. Consequences

### Positive
* Robust security: Phishing scripts cannot suppress, style over, or bypass extension-origin interstitial warnings.
* Full compatibility with modern browser autofill, password managers, and web accessibility standards.
* Elimination of fragile, race-condition-prone DOM mutation code.

### Negative / Trade-offs
* If a user willfully ignores an explicit warning dialog and types credentials into a phishing page, the extension does not forcefully stop keystrokes. (This is consistent with standard industry browser security models, including Chrome Safe Browsing and Firefox Enhanced Protection).

---

## 6. Conditions for Revisit

This decision will only be revisited if browser vendors provide a native, tamper-proof browser API (operating at the browser engine level outside the page DOM) specifically designed for credential isolation without script injection.
