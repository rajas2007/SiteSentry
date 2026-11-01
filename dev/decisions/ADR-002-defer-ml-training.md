# ADR-002: Deferring Machine Learning Model Training and SHAP Explainability

* **Status:** Proposed (Under Review)
* **Date:** 2026-10-19
* **Authors:** Site Sentry Core Engineering Team
* **Deciders:** Product Security, Data Science, Backend Engineering

---

## 1. Context

The initial architectural roadmap for TrustLens AI specified a dedicated Machine Learning Engine to classify websites as phishing or benign using a 27-feature vector and TreeSHAP explainability.

During Milestone 2 audits (Milestones 2A, 2B), several critical realities were uncovered:
1. **Dataset Quality & Provenance:** Public phishing datasets (e.g., Mendeley sets, CompPhish v4) frequently lack complete, uncorrupted raw HTML DOM trees, suffer from high temporal obsolescence, or introduce severe domain-level data leakage (where the model memorizes domain strings rather than structural phishing traits).
2. **Feature Extraction Parity:** The canonical 27-feature schema includes both structural page features (features 0–19) and threat intelligence counters (features 20–26). Training an ML model on threat intelligence features introduces circular dependencies and masks structural signals.
3. **Operational Overhead:** Training, validating, packaging, and serving an ML model with SHAP explanations in the real-time scanning path imposes significant latency penalties, memory bloat, dependency overhead (`scikit-learn`, `lightgbm`, `shap`), and risk of silent model degradation.
4. **Baseline Unmeasured:** The current deterministic pipeline (threat intelligence feeds + structural Security Engine rules) has not yet been quantitatively benchmarked on a standard test suite to establish its true false-positive and false-negative rates.

---

## 2. Decision

We **defer** machine learning model training, offline training pipelines, and SHAP explainability from immediate production milestones:

1. **Preserve Existing Contracts & Schemas:**
   * Keep the canonical 27-feature ordering (`FEATURE_ORDER` in `services/api/src/engines/machine_learning/schemas.py`).
   * Keep `MLFeatureExtractor`, `MLFeatureVector`, `TrainingRecord`, and `DatasetSplitter` as modular offline utilities.
   * Keep `MODEL_CONTRACT.md` (defining the 20-feature `v1_structural` boundary that cleanly excludes threat intel features 20–26 from any future model tensor).
2. **No Model in Critical Path:** The production scan pipeline (`ScanService.analyze_page()`) shall NOT invoke or require ML inference or SHAP calculations.
3. **No Synthetic Training Data:** We will not generate synthetic or fabricated scan data to simulate model training.
4. **Offline Evaluation Prerequisite:** Any future proposal to train a model must be preceded by an empirical detection audit of the deterministic baseline.

---

## 3. Rationale

* **Engineering Pragmatism:** Prematurely deploying a model trained on low-fidelity or leaky data creates a false sense of security while introducing unpredictable false positives on benign user traffic.
* **Deterministic Explainability First:** Users need clear, human-understandable reasons for security warnings (e.g., "The form submits credentials to a foreign domain without HTTPS"), which the Rule and Security Engines generate directly without requiring SHAP approximations.
* **Stability of Production API:** Production API contracts (`PageAnalysisRequest`, `PageAnalysisResponse`) remain completely clean, stable, and independent of model weight formats or tensor schemas.
* **Preservation of Past Work:** None of the rigorous contract design work (the 27-feature schema or the 20-feature `v1_structural` contract) is discarded; it remains intact for controlled experimental evaluation.

---

## 4. Alternatives Considered

* **Immediate Training on Mendeley / CompPhish v4 Dataset:**
  * *Reason for Rejection:* Feasibility audits revealed incomplete DOM trees, missing feature reproduction capabilities for several structural features, and restrictive terms requiring active site crawling.
* **Training on Synthetic / Mock Records:**
  * *Reason for Rejection:* Violates core security integrity; synthetic distributions do not reflect adversarial tactics and result in models that fail catastrophically in production.
* **Complete Removal of ML Schemas and Utilities:**
  * *Reason for Rejection:* Would destroy well-architected interfaces (`MLFeatureVector`, `DatasetSplitter`, `MODEL_CONTRACT.md`) that will be needed if experimental validation in Phase 5 justifies a model.

---

## 5. Consequences

### Positive
* The backend remains fast, lightweight, and completely deterministic.
* Eliminates heavy dependencies (`shap`, `lightgbm`, `xgboost`, `scipy`) from production server deployments.
* Eliminates model drift and distribution shift risks from the live browser extension experience.

### Negative / Trade-offs
* Phishing attacks that exhibit zero known structural anti-patterns and are absent from threat intelligence blacklists will not be caught until threat feeds update or rules are added.

---

## 6. Conditions for Revisit

This decision will be formally revisited during **Phase 5 (Reassess ML)** if:
1. Phase 3 benchmark evaluation demonstrates that deterministic rules leave a quantifiable, high-risk detection gap on real-world phishing attacks.
2. A verified, high-fidelity dataset containing complete raw DOMs and verifiable benign/phishing labels is acquired with permissible licensing.
3. A trained candidate model demonstrates statistically significant improvement in recall over deterministic rules with false positive rates below 0.1% on Alexa/Tranco top domains.
