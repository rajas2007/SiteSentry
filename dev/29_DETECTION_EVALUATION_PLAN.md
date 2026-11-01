# 29. Detection Evaluation Plan

* **Status:** Draft / Active Specification
* **Canonical Path:** `dev/29_DETECTION_EVALUATION_PLAN.md`
* **Target Milestone:** Phase 3 (Detection Evaluation)
* **Related Components:** `SecurityEngine`, `RuleEngine`, `ThreatIntelligenceEngine`, `ScoreFusionEngine`

---

## 1. Objective

Before any machine learning model is trained or new complex detection engines are introduced, the engineering team must quantitatively measure the real-world performance of Site Sentry's existing deterministic security pipeline.

The goal of this evaluation is to:
1. Establish empirical **False Positive Rate (FPR)** and **False Negative Rate (FNR)** baselines on representative web traffic.
2. Identify specific categories of phishing attacks that evade current deterministic rules and threat feeds.
3. Uncover legitimate website structural patterns that trigger false alarms (e.g. enterprise login portals, SSO redirects, multi-subdomain architectures).
4. Measure pipeline resilience and degradation modes when third-party threat intelligence APIs are unreachable.

---

## 2. Dataset Selection, Provenance & Safety Requirements

Evaluation datasets must be curated with rigorous provenance, avoiding synthetic data and minimizing temporal obsolescence.

### 2.1 Benign Evaluation Corpus (Target: 10,000 samples)
* **Source:** Tranco Top 1M list (sampled from top 10,000 domains) and popular corporate/SaaS login portals.
* **Inclusion Criteria:** Domains with stable DNS, active HTTPS, and established operational history (> 1 year).
* **Snapshot Dating:** Benign samples must record the exact dated release of the Tranco list (e.g. `tranco_XXXX.csv`) and the exact timestamp when HTML/DOM features were retrieved.
* **High-Risk Edge Cases:**
  * Complex SSO redirection pages (e.g., Microsoft login, Okta, Google Auth).
  * Dynamic single-page applications (React, Angular, Vue) with external CDN assets.
  * Legitimate financial and government portals with complex form structures.

### 2.2 Malicious Evaluation Corpus (Target: 5,000 samples)
* **Sources:**
  * PhishTank (actively verified, non-expired submissions with multi-user confirmation).
  * OpenPhish (active community feed).
  * CompPhish / Mendeley benchmark sets (HTML snapshots with validated provenance).
* **Inclusion Criteria:** Confirmed credential-harvesting kits, tech support scams, brand impersonation pages, and malware delivery landing pages.
* **Diversity Requirements:** Must include IP-based hosts, punycode/homoglyph URLs, free subdomain hosting services (e.g., `pages.dev`, `vercel.app`, `firebaseapp.com`), and dynamic obfuscation kits.
* **Label Validation:** Ground truth labels must be independently validated before inclusion. Ambiguous submissions (e.g. single unverified user reports, dead or parked pages, generic HTTP 404/403 errors) must be quarantined or excluded.

### 2.3 Temporal Freshness & Synchronization
* **Feed Expiration & Threat Decay:** Phishing kits have an operational half-life often measured in hours or days. Stale samples whose hosting infrastructure has expired must be segregated from active campaigns.
* **Synchronized Threat Intelligence Queries:** Querying live external threat intelligence APIs (e.g. Google Safe Browsing, VirusTotal) for a 2-year-old expired phishing URL introduces severe survivorship bias (vendor feeds delist inactive URLs, artificially reporting `clean`). Evaluation of external threat intel must use historical ground truth snapshots matching the sample capture date, or live queries must be restricted to active, unexpired campaigns (< 48 hours old).

### 2.4 Deduplication & Leakage Prevention
* **URL & Domain Deduplication:** Strict deduplication must be performed at both the exact normalized URL path and the registered domain (eTLD+1).
* **Domain Frequency Cap:** Prevent a single high-volume domain (e.g. free subdomain hosting or compromised shared hosts) from dominating the malicious corpus and biasing evaluation metrics.
* **Cross-Split Exclusion:** No registered domain (eTLD+1) may appear across both the benign and malicious corpora.

### 2.5 Safe Offline Handling of Malicious Samples
* **Strict Execution Ban:** Malicious web samples contain live exploit code, phishing credential harvesters, or malware droppers. Under no circumstances may malicious samples be loaded in standard interactive web browsers, navigated to directly, or executed on developer workstations.
* **Network-Isolated Sandbox:** All artifact storage, ingestion, and feature extraction must occur in an isolated environment with network egress disabled.
* **Static DOM/HTML Parsing Only:** Feature extraction must be performed strictly using headless, non-executing static HTML parsers or serialized DOM string parsers. Inline JavaScript execution, remote asset fetching, image loading, and dynamic script execution must remain strictly disabled.
* **Secure Storage & Git Exclusion:** Raw malicious payloads and HTML archives must be stored in encrypted or restricted-access local directories. Under no circumstances may raw malicious samples, HTML payloads, or phishing scripts be committed to the Git repository.

---

## 3. Evaluation Methodology

```
┌───────────────────────────┐      ┌────────────────────────────┐
│ Benign Dataset (10,000)   │      │ Malicious Dataset (5,000)  │
└─────────────┬─────────────┘      └─────────────┬──────────────┘
              │                                  │
              └───────────────┬──────────────────┘
                              │
                              ▼
                 [Offline Evaluation Harness]
               Simulate Page Navigation Payload
              (URL, Hostname, Structural DOM Data)
                              │
                              ▼
                 [Site Sentry Pipeline Run]
              SecurityEngine + RuleEngine + Intel
                              │
                              ▼
                 [Metrics Calculation Engine]
           Confusion Matrix, Precision, Recall, FPR
```

### 3.1 Metrics to Measure
* **True Positive Rate (Recall):** $\frac{\text{TP}}{\text{TP} + \text{FN}}$ (Percentage of real phishing sites correctly identified as `warn` or `block`).
* **False Positive Rate (FPR):** $\frac{\text{FP}}{\text{FP} + \text{TN}}$ (Percentage of benign sites incorrectly flagged as `warn` or `block`).
  * *Target Standard (Evaluation Objective):* FPR on top benign domains must be $< 0.1\%$ to prevent alert fatigue. *(Note: This $< 0.1\%$ figure is a target evaluation threshold/objective standard, not an established empirical result of the current codebase.)*
* **Threat Intel Contribution vs. Rule Contribution:**
  * Percentage of threats caught solely by Threat Intel (GSB/VT).
  * Percentage of threats caught solely by Deterministic Structural Rules (zero-minute attacks missed by feeds).
  * Percentage of threats caught by both.
* **Degraded Pipeline Performance:** Run the complete malicious corpus with external threat intel mock-disabled to measure the stand-alone efficacy of deterministic structural rules.

---

## 4. Evaluation Constraints & Data Leakage Prevention

1. **Domain-Level Leakage Prevention:**
   * Evaluation sets must strictly group samples by registered domain (eTLD+1). Samples from the same domain must not appear across benign and malicious splits.
2. **Temporal Validity:**
   * Phishing kits evolve rapidly. Threat intelligence lookups must account for the date of the sample; querying current APIs for an expired phishing domain will artificially report `clean` because the domain was taken down. Historical ground truth snapshots must be used.
3. **Static DOM Limitations:**
   * Modern single-page applications (SPAs) render DOM elements dynamically via client-side JavaScript. Offline evaluation harnesses must simulate DOM extraction as captured after `DOMContentLoaded` by the browser extension content script, rather than raw server-side HTML responses.

---

## 5. Output Deliverables of Phase 3

Upon completion of Phase 3, the evaluation team will publish:
1. **The Baseline Detection Report:** Quantitative precision, recall, and false positive metrics across all evaluated categories.
2. **Detection Failure Taxonomy:** Detailed root-cause analysis for top false negatives (attacks missed) and false positives (benign sites flagged).
3. **Deterministic Improvement Backlog (Phase 4 Input):** List of specific structural rules to add, adjust, or retire.
4. **ML Justification Gate (Phase 5 Input):** An empirical finding on whether deterministic rules leave an unresolvable structural gap that justifies training a machine learning model.
