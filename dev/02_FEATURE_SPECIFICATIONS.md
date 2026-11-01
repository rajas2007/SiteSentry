# 02. Feature Specifications

* **Product:** Site Sentry
* **Status:** Active Feature Specification
* **Canonical Path:** `dev/02_FEATURE_SPECIFICATIONS.md`

---

## 1. Scope & Categorization

This document specifies the concrete features and threat categories evaluated by Site Sentry. Features are strictly classified into **Active (Core Pipeline)**, **Secondary (Reduced Scope)**, and **Deferred (Future Scope)** to prevent architectural drift.

---

## 2. Threat Risk Categories Evaluated

Site Sentry categorizes observable website risks to inform deterministic rules and user-facing explanations:
* **Credential Harvesting:** Pages presenting login forms or password inputs that submit credentials to untrusted external domains, insecure protocols, or IP-based hosts.
* **Brand Impersonation / Homoglyphs:** Domains utilizing punycode, Cyrillic/Greek homoglyphs, or targeted typosquatting to mimic established brands.
* **Malware Distribution:** Domains actively flagged by global threat intelligence feeds for hosting malicious binaries, drive-by downloads, or exploit kits.
* **Deceptive / Phishing Infrastructure:** Newly registered domains, high-entropy hostnames, or excessive subdomains configured with misleading keywords (e.g., `paypal-verify-account.security-update.com`).
* **Insecure Transport on Sensitive Pages:** Forms collecting sensitive user inputs (passwords, payment fields) over unencrypted HTTP.
* **Deceptive Tracking (Secondary):** Pages embedding excessive third-party tracking scripts or non-consensual tracking pixels.

---

## 3. Active Core Features

### 3.1. Security Engine (Active & Prioritized)
* **URL Structural Analysis:** Evaluates total URL length, path depth, query parameter complexity, and URL entropy.
* **Hostname Analysis:** Detects IP-based hostnames (IPv4/IPv6), punycode (`xn--`), suspicious TLDs, and excessive subdomain counts.
* **Transport Security:** Verifies SSL/HTTPS usage; applies critical deductions if sensitive forms exist on non-HTTPS pages.
* **DOM Form Target Inspection:** Evaluates whether `<form>` actions point to relative paths, legitimate origins, or external untrusted domains.

### 3.2. Threat Intelligence Engine (Active & Prioritized)
* **Google Safe Browsing Integration:** Verifies URL/domain against Google's global threat databases via the Safe Browsing v4 API.
* **VirusTotal Integration:** Queries VirusTotal domain reports, extracting vendor detection counts and threat tags.
* **Provider Failure Resilience:** Enforces 2.5s bounded timeouts, 429 rate-limit cooling, and ensures failed lookups produce `data_completeness = False` rather than a clean pass per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md).

### 3.3. Score Fusion & Decision Engine (Active)
* **Score Fusion:** Base score 100.0, VT deduction capped at 50.0 points, structural finding deductions, hard threat override clamping score $\le 10.0$.
* **Decision Generation:** Maps scores and evidence completeness into canonical browser actions (`allow`, `warn`, `block`) per [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md), setting `threat_category = "inconclusive"` within `action = "warn"` when threat intelligence is incomplete.

### 3.4. Explainability (Active & Evidence-Based)
* Generates clear, structured explanations directly tied to observed findings (e.g., "Finding: External Form Action. Severity: High. Reason: This form posts passwords to an external third-party domain").
* Does not require statistical approximations (TreeSHAP) for deterministic rules.

### 3.5. Browser Extension UI (Active)
* **Trusted Interstitial Warning:** Intercepts `BLOCK` decisions with a full-tab extension-origin page (`warning.html`).
* **Toolbar Icon Badging:** Real-time badge color coding (Green: Safe, Amber: Suspicious/Inconclusive, Red: Threat).
* **Popup Evidence Drawer:** Displays scan score, provider status, and itemized structural findings.
* **Service Worker Persistence:** Stores tab scan states in `chrome.storage.local` across background service-worker lifecycle events.

### 3.6. Management Dashboard (Active Baseline)
* **Scan History View:** Searchable, filterable list of scanned URLs, verdicts, and timestamps.
* **Analysis Detail View:** In-depth breakdown of findings, threat intelligence flags, and scores for a specific scan.
* **Analytics Overview:** Real-time metrics on total scans, threat distribution, and provider availability.

---

## 4. Secondary & Reduced-Scope Features

### 4.1. Privacy Intelligence Engine (Reduced Scope)
* **Active:** Lightweight heuristic count of third-party tracking domains and cookies observed on the page.
* **Deferred:** LLM-based privacy policy summarization, automated consent-banner dark pattern detection, and browser canvas fingerprinting audits.

---

## 5. Deferred Features (Future Scope)

The following capabilities from the original specification are officially **deferred**:
* **Machine Learning Model Training & SHAP:** Deferred per [ADR-002](./decisions/ADR-002-defer-ml-training.md).
* **Web3 Engine (Smart Contract & Wallet Drainer Auditing):** Deferred per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
* **Community Intelligence (Crowdsourced Voting / Staking):** Deferred per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
* **DOM Password Field Disabling:** Classified as an insecure anti-pattern and rejected per [ADR-005](./decisions/ADR-005-browser-warning-over-dom-tampering.md).
* **Enterprise Multi-Tenant Fleet Auditing:** Deferred per [Future Scope](./23_FUTURE_SCOPE.md).
