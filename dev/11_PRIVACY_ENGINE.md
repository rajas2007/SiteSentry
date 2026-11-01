# 11. Privacy Intelligence Engine

* **Product:** Site Sentry
* **Status:** Active Secondary Capability (Reduced Scope per Section 3.13)
* **Canonical Path:** `dev/11_PRIVACY_ENGINE.md`
* **Implementation:** `services/api/src/engines/privacy/engine.py`
* **Related Specification:** [31. Data Privacy and Retention Specification](./31_DATA_PRIVACY_AND_RETENTION.md)

---

## 1. Overview & Revised Product Scope

The **Privacy Intelligence Engine** (`services/api/src/engines/privacy/`) provides secondary analysis of tracking technologies and data collection practices on visited websites.

Under Site Sentry's revised product priorities, **website security (phishing, malware, credential theft) is the primary focus**. Privacy intelligence is maintained as a lightweight, secondary diagnostic capability.

---

## 2. Active Capabilities vs. Deferred Modules

### 2.1. Active Secondary Capabilities
* **Third-Party Tracker Detection:** Evaluates counts of external tracking scripts and known advertising/analytics domains present on the page.
* **Cookie Aggregation:** Evaluates first-party and third-party cookie volume observed by the extension content script.
* **Privacy Score Generation:** Computes a normalized Privacy Score ($0–100$) reflecting tracking density.

### 2.2. Deferred Capabilities (Future Scope)
To avoid unnecessary operational complexity and external API costs, the following speculative privacy features are officially **deferred**:
* **LLM-Based Privacy Policy Summarization:** Automated analysis of legal privacy policy text via OpenAI/Anthropic APIs is deferred.
* **Canvas / Audio Fingerprinting Auditing:** Deep heuristic detection of browser fingerprinting techniques is deferred.
* **Dark Pattern & Consent Banner Extraction:** Automated parsing of GDPR/CCPA cookie consent modals is deferred.
* **Unverifiable Data Sharing Claims:** Generating claims about whether a company sells data without verified evidence is rejected.

---

## 3. Engine Pipeline Flow

1. **Input:** Receives quantitative tracker metrics and cookie counts from `ScanService`.
2. **Analysis:** `PrivacyIntelligenceEngine.analyze()` compares counts against baseline thresholds:
   * Tracking domain count $> 10 \implies$ Medium finding (deduction $-15$ pts).
   * Tracking domain count $> 25 \implies$ High finding (deduction $-30$ pts).
3. **Score:** Outputs a `PrivacyResult` containing findings and a normalized privacy score.
4. **Integration:** Handed off to `ScoreFusionEngine` for display in the popup and dashboard. Privacy deductions do **not** override security findings or trigger `BLOCK` actions.

---

## 4. Privacy & Data Minimization Safeguards

* The Privacy Intelligence Engine inspects only metadata (domain names of scripts, cookie counts).
* Cookie values, session identifiers, and user browsing history are **never** stored or inspected per [31. Data Privacy and Retention](./31_DATA_PRIVACY_AND_RETENTION.md).
