# ADR-001: Prioritizing Deterministic Security Rules and Authoritative Threat Intelligence Over Probabilistic ML

* **Status:** Proposed (Under Review)
* **Date:** 2026-10-19
* **Authors:** Site Sentry Core Engineering Team
* **Deciders:** Product Security, Backend Engineering

---

## 1. Context

Site Sentry is a browser security extension and backend service designed to detect phishing and malicious websites, explain risk characteristics to users, and present clear protective warnings.

The original architecture (under TrustLens AI) planned an extensive, multi-engine pipeline featuring machine learning classifiers (LightGBM/XGBoost), SHAP value explainability, Web3 wallet-drainer analyzers, LLM privacy policy summarizers, and community crowdsourced reputation scoring.

However, browser security scanning imposes strict latency, reliability, and explainability requirements:
1. When a site is listed on authoritative threat intelligence feeds (Google Safe Browsing, VirusTotal), confidence is definitive. Overriding or diluting authoritative threat findings with probabilistic scores creates dangerous false negatives.
2. Users and security analysts need exact, deterministic evidence (e.g., "login form posts credentials to an external IP address" or "domain uses punycode cyrillic homoglyphs") rather than opaque probabilistic weights or SHAP feature approximations.
3. Operating complex ML training pipelines, feature extraction parity between browser/server, model drift monitoring, and dataset curation introduces substantial operational overhead before the baseline security pipeline has been properly stabilized and benchmarked.

---

## 2. Decision

We prioritize **deterministic security rules** and **authoritative threat intelligence** as the primary, non-negotiable foundation of the Site Sentry detection pipeline:

1. **Authoritative Overrides:** Confirmed malicious findings from authoritative threat intelligence providers (Google Safe Browsing, VirusTotal) act as hard overrides or maximum risk deductions. Probabilistic heuristics cannot soften a confirmed threat finding.
2. **Deterministic Structural Analysis:** The Security Engine and Rule Engine evaluate verifiable, observable signals (URL characteristics, hostname patterns, transport security status, DOM form targets, credential input contexts).
3. **Evidence-Based Explanations:** Explanations delivered to the browser extension and dashboard must map directly to observable security findings rather than statistical feature attributions.
4. **Deferred Probabilistic Scoring:** Machine learning model training and inference are removed from the critical scan path and deferred to a dedicated evaluation phase.

---

## 3. Rationale

* **Zero Hallucination / Explainability:** Deterministic rules produce exact evidence (e.g., finding IDs, target URLs, mismatched domains) that directly inform the user warning dialog.
* **Low Latency & High Availability:** Rule evaluation against extracted structural metadata executes in sub-millisecond timeframes without loading model weights into memory or maintaining specialized ML inference runtimes.
* **Security Reliability:** High-confidence threat intelligence feeds minimize false positives on critical business domains and instantly detect active campaigns known to global threat databases.
* **Clear Debuggability:** When a scan produces an unexpected score, developers can inspect the rule execution trace directly without running feature perturbation analysis.

---

## 4. Alternatives Considered

* **ML-First Classification Pipeline:**
  * *Description:* Rely primarily on a trained gradient-boosted tree or deep neural network to assign phishing probabilities, using rules only for secondary filtering.
  * *Reason for Rejection:* High vulnerability to adversarial evasion, high false-positive rates on legitimate uncommon domains, complex model training/drift lifecycle, and inability to provide deterministic explanations to users.
* **Pure Blacklist Lookup (Threat Intel Only):**
  * *Description:* Only query Google Safe Browsing and VirusTotal, discarding structural DOM and URL rules entirely.
  * *Reason for Rejection:* Completely blind to newly created zero-minute phishing sites, local network phishing, and credential harvesting kits before they are reported and cataloged by third-party databases.

---

## 5. Consequences

### Positive
* Predictable, reproducible scan scores and decision actions.
* Significantly reduced runtime memory footprint and dependency footprint (no PyTorch, LightGBM, or SHAP required in production web workers).
* Clear audit trail for security decisions.
* Faster development velocity focusing on core pipeline reliability.

### Negative / Trade-offs
* Zero-minute phishing sites that avoid known structural anti-patterns and are not yet cataloged in threat feeds will produce `CLEAN` or `INCONCLUSIVE` results.
* Structural heuristics require continuous tuning against emerging evasion techniques.

---

## 6. Conditions for Revisit

This decision will be formally revisited during **Phase 5 (Reassess ML)** if and only if:
1. The deterministic pipeline has undergone controlled benchmarking against verified datasets (PhishTank, CompPhish, Tranco/Alexa benign sets).
2. A quantifiable detection gap is documented (i.e. zero-minute phishing attacks that evade structural rules but possess distinct structural feature vectors).
3. A trained candidate model demonstrates superior recall without introducing unacceptable false positive rates on benign domains.
4. Inference latency and operational maintenance costs are verified to be sustainable.
