# 12 Trust Engine

## 1. Overview
The Trust Engine sits near the end of the analysis pipeline. It does NOT simply calculate a localized risk for the current URL. Instead, its sole purpose is to combine the outputs from the **Score Fusion Engine** with the historical reputation of the entity, normalizing them into the ultimate **Overall Trust Score**.

## 2. Responsibilities
- Receives the fused Security, Privacy, and (optional) Web3 scores.
- Queries the **Knowledge Base** and **Community Intelligence Engine** for the historical reputation of the root domain and corporate entity.
- Normalizes these factors into a single `0-100` metric that represents the platform's holistic trust in the website.
- Passes the final numbers to the **Explainability Engine**.

## 3. Calculating Trust
The Trust Score is a weighted fusion, but heavily influenced by historical behavior.

`Trust Score = f(Security_Score, Privacy_Score, Web3_Score, Entity_Historical_Reputation)`

### Example Scenarios:
1. **The Brand New Site:** A site has a perfect Security Score (100) and perfect Privacy Score (100). However, the Threat Intelligence Engine notes the domain is 2 hours old. The Trust Engine dampens the Overall Trust Score to **55 (Amber)** because it lacks historical proof of good behavior.
2. **The Reformed Spammer:** A site has decent current scores, but Community Intelligence shows they were involved in a massive phishing campaign 6 months ago. The Trust Engine heavily penalizes the Overall Trust Score.

## 4. Entity Verification
The Trust Engine also attempts to verify the real-world entity behind the digital presence:
- Does the WHOIS data match public corporate registries?
- Is there an Extended Validation (EV) SSL certificate tying the domain to a legal corporation?
- If the entity is verified and historically safe, the Trust Score receives a positive multiplier.

## 5. Related Engines
- [Score Fusion Engine](./16_SCORING_ENGINE.md)
- [Decision Engine](./16a_DECISION_ENGINE.md)
- [Community Intelligence Engine](./26_COMMUNITY_INTELLIGENCE.md)
