# 09 Machine Learning & Explainability Engines

*Note: This document covers the probabilistic AI engines of the TrustLens AI Platform. For deterministic AI and heuristics, see the [Rule Engine](./09a_RULE_ENGINE.md).*

## 1. Machine Learning Engine

### 1.1. Overview
The Machine Learning Engine is responsible for probabilistic inference. It is strictly separated from the Rule Engine to ensure that we do not present basic deterministic features as "AI."

### 1.2. Responsibilities
- Receives a high-dimensional Feature Vector from the **Feature Extraction Engine**.
- Executes trained models to generate classification probabilities (e.g., `P(Phishing) = 0.82`).
- Calculates a **Confidence** metric based on the model's certainty and the completeness of the input feature vector.
- Passes probabilities, SHAP values, and the Confidence metric to the **Score Fusion Engine**.

### 1.3. Inference & Architecture
- **Models:** Primarily Tabular models like XGBoost and LightGBM for speed and explainability.
- **NLP Models:** Utilizes LLMs specifically for summarizing Privacy Policies (extracting intent).
- **Execution:** Inference happens asynchronously where possible. XGBoost inference takes < 10ms.

### 1.4. Training & Model Versioning
- Models are trained on historical data from the **Knowledge Base** and feedback from **Community Intelligence**.
- **Model Versioning:** The API endpoint must explicitly log which model version (e.g., `v2.4.1-xgboost-phish`) was used for a given scan to track data drift.

---

## 2. Explainability Engine

### 2.1. Overview
TrustLens AI is built on Explainable AI (XAI). Users will not trust a black-box score. The Explainability Engine translates raw model outputs into human-readable text.

### 2.2. Responsibilities
- Intercepts SHAP (SHapley Additive exPlanations) values from the ML Engine and rule triggers from the Rule Engine.
- Maps technical feature names to localized strings.
  - *Input:* `{"feature": "domain_age", "value": 1, "shap": +40}`
  - *Output:* `"This domain is newly registered (1 day old), which is highly suspicious."`
- Passes these formatted explanations to the **Decision Engine** to be presented in the extension UI.

## 3. Related Engines
- [Rule Engine](./09a_RULE_ENGINE.md)
- [Score Fusion Engine](./16_SCORING_ENGINE.md)
