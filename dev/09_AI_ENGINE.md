# 09. Machine Learning & Explainability Engines

* **Product:** Site Sentry
* **Status:** ML Training Deferred per ADR-002; Explainability Active (Evidence-Grounded)
* **Canonical Path:** `dev/09_AI_ENGINE.md`
* **Related ADRs:**
  * [ADR-001: Prioritizing Deterministic Security Rules Over ML](./decisions/ADR-001-deterministic-security-priority.md)
  * [ADR-002: Deferring Machine Learning Model Training](./decisions/ADR-002-defer-ml-training.md)
* **Model Contract:** `services/api/src/engines/machine_learning/MODEL_CONTRACT.md`

---

## 1. Machine Learning Engine (Deferred Status)

### 1.1. Strategic Decision to Defer Training
Machine learning model training, offline training pipelines, and real-time model inference are **deferred** from immediate production scanning milestones.

The decision to defer ML is based on findings from Milestones 2A and 2B:
1. **Public Dataset Limitations:** Public phishing datasets (e.g., Mendeley sets, CompPhish v4) lack verified, complete HTML DOM trees, suffer from high temporal obsolescence, or introduce severe domain-level data leakage.
2. **Deterministic Baseline First:** The combination of authoritative threat intelligence (Google Safe Browsing, VirusTotal) and structural security rules provides high precision and transparent explanations. Model training will only be revisited in Phase 5 after the deterministic baseline is quantitatively benchmarked per [29. Detection Evaluation Plan](./29_DETECTION_EVALUATION_PLAN.md).
3. **No Model in Live Scanning:** `ScanService.analyze_page()` does not execute ML inference or load model weights.

### 1.2. Preserved ML Infrastructure & Contracts
To ensure future research can resume without re-architecting, all existing ML schema definitions and contract files are preserved in `services/api/src/engines/machine_learning/`:
* **Canonical 27-Feature Schema:** Defined in `schemas.py` (`FEATURE_ORDER`), spanning 20 structural features (0–19) and 7 threat intelligence features (20–26).
* **Structural Model Contract (`v1_structural`):** Defined in `MODEL_CONTRACT.md`. Formally isolates features 0–19 into an immutable 20-feature tensor input for future candidate models, cleanly separating page structure from external threat feed counters.
* **Dataset Utilities:** `MLFeatureExtractor`, `TrainingRecord`, and `DatasetSplitter` are retained as modular offline research tools.

---

## 2. Explainability Engine (Active & Evidence-Grounded)

### 2.1. Overview & Purpose
Trust in security warnings requires transparent explanations. The Explainability Engine (`services/api/src/engines/explainability/`) translates technical findings into clear, human-understandable evidence delivered directly to the browser extension and dashboard.

Because ML training is deferred, **TreeSHAP feature attributions are also deferred**. Deterministic explanations do not require SHAP values.

### 2.2. Evidence-Based Explanation Mapping
For each active finding produced by the `SecurityEngine` or `RuleEngine`, the Explainability Engine formats structured evidence:
* **Observed Signal:** The specific condition detected (e.g., `has_password_field=True` with `external_form_action=True`).
* **Source of Evidence:** Whether derived from the target DOM, URL structure, or third-party threat feeds.
* **Context & Severity:** Why the signal represents a security risk (e.g., "Critical: Password submitted to untrusted external host").
* **Decision Impact:** How the finding affected the final score and user recommendation.

```json
{
  "finding_id": "SEC-EXT-FORM-001",
  "category": "credential_harvesting",
  "severity": "critical",
  "title": "External Credential Submission",
  "description": "This page contains a password input field that submits credentials to an external domain (evil-collector.com) rather than the host domain.",
  "evidence": {
    "form_action": "https://evil-collector.com/login.php",
    "host_domain": "legitimate-lookalike.com"
  }
}
```

### 2.3. Anti-Hallucination & Honest Communication
* Explanations are strictly bound to verified signals.
* Heuristics are never presented as definitive proof of malware or phishing.
* Incomplete or failed provider lookups are explained honestly as "Analysis Incomplete" rather than concealed.
