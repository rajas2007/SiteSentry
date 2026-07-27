# 16 Score Fusion Engine

## 1. Overview
The Score Fusion Engine (formerly known as the Scoring Engine) sits at the critical juncture where raw analysis turns into finalized metrics. It merges the deterministic outputs of the **Rule Engine** with the probabilistic outputs of the **Machine Learning Engine**.

## 2. Responsibilities
- Merges outputs from:
  - Security Engine (via Rule/ML)
  - Privacy Intelligence Engine (via Rule/ML)
  - Threat Intelligence Engine (via Rule/ML)
  - Web3 Engine (via Rule/ML)
- Calculates the final **Security Score** (0-100).
- Calculates the final **Privacy Score** (0-100).
- Calculates the final **Web3 Score** (0-100, if applicable).
- Calculates the platform's **Confidence Score** (0-100%).

## 3. Weighting Strategy
The Fusion Engine follows a strict hierarchy of evaluation:

1. **Rule Engine Overrides (Priority 1):** If the Rule Engine issues a zero-tolerance override (e.g., Threat Intel confirms known malware), the ML score is ignored, and the respective score drops to 0.
2. **ML Probabilities (Priority 2):** If no hard overrides exist, the ML probability is converted into a score penalty (e.g., `P(Phish)=0.85` -> `-60` to Security Score).
3. **Rule Modifiers (Priority 3):** Minor heuristic penalties are subtracted (e.g., `-5` for each tracker found).

## 4. Confidence Calculation
The Confidence Score is calculated based on:
- **Data Completeness:** Did all external Threat Intelligence APIs respond? If WHOIS timed out, confidence drops by 10%.
- **ML Confidence:** Is the XGBoost prediction firmly at `0.99` (High Confidence) or wavering at `0.55` (Low Confidence)?
- **Feature Sparsity:** Was the DOM payload from the client fully parsed, or was it truncated?

## 5. Future Weighting Improvements
Future iterations of the platform will introduce dynamic weighting based on the user's specific context. For example, if the user is in a corporate environment, the Privacy Score might be weighted less heavily than strict Enterprise Security policies.

## 6. Related Engines
- [Trust Engine](./12_TRUST_ENGINE.md)
- [Decision Engine](./16a_DECISION_ENGINE.md)
