# 09a Rule Engine

## 1. Overview
The Rule Engine is the deterministic counterpart to the Machine Learning Engine. It executes hardcoded logic, heuristics, and zero-tolerance policies.

By separating the Rule Engine from the ML Engine, we ensure that obvious, deterministic threats (like a domain explicitly blacklisted by Google Safe Browsing) are not subject to the probabilistic uncertainties of a machine learning model.

## 2. Responsibilities
- Evaluates categorized findings from the Sub-Engines (Security, Privacy Intelligence, Threat Intel, Web3).
- Applies strict Boolean logic to generate immediate score modifiers.
- Outputs definitive findings to the **Score Fusion Engine**.

## 3. Examples of Deterministic Rules
- **Rule `SEC-VT-01`**: IF `virus_total_positives >= 3` THEN `security_score = 0`. (Zero Tolerance)
- **Rule `PRIV-TRK-05`**: IF `has_supercookie == true` THEN `privacy_modifier = -20`.
- **Rule `WEB3-ADDR-01`**: IF `contract_in_knowledge_base == true` AND `kb_status == "drainer"` THEN `web3_score = 0`.

## 4. Scoring Contribution
The Rule Engine outputs a list of "Overrides" and "Modifiers".
- **Overrides:** Immediately force a score to a specific value (usually 0), bypassing any ML predictions.
- **Modifiers:** Add or subtract points from a baseline score.

## 5. Advantages & Limitations
### Advantages
- **100% Explainable:** Deterministic rules are trivial to explain to a user.
- **Instant Execution:** `O(1)` or `O(N)` time complexity. Extremely fast.
- **Absolute Control:** Allows engineers to manually patch zero-day vulnerabilities by pushing a new rule to the Knowledge Base without retraining an ML model.

### Limitations
- Cannot detect novel, previously unseen combinations of features that the ML Engine might catch.
- Requires manual maintenance to prevent rules from becoming stale.

## 6. Related Engines
- [Machine Learning Engine](./09_AI_ENGINE.md)
- [Score Fusion Engine](./16_SCORING_ENGINE.md)
