# 11 Privacy Intelligence Engine

## 1. Overview
The Privacy Intelligence Engine (formerly Privacy Engine) focuses on how a website handles user data, tracks user behavior, and respects user consent. It protects users against data exploitation, Spam, Tracking, and Privacy Abuse.

## 2. Responsibilities
Like the Security Engine, the Privacy Intelligence Engine consumes normalized data from the **Feature Extraction Engine**. It analyzes these features to identify invasive data practices.

## 3. Core Analyzers

### 3.1. Tracker & Cookie Analysis
Evaluates the usage of first and third-party storage.
- Identifies fingerprinting scripts and cross-site tracking pixels.
- Flags "supercookies" and persistent tracking mechanisms.
- Evaluates cookie consent mechanisms (detecting dark patterns like hidden "Opt-Out" buttons).

### 3.2. Email Collection & Marketing Detection
Assesses the aggression of user data harvesting.
- Detects immediate, unprompted email capture popups.
- Identifies pre-checked consent boxes for marketing communications.

### 3.3. Privacy Policy AI Analysis
Translates dense legal privacy policies into actionable intelligence.
- Utilizing Natural Language Processing (via LLM APIs), it scans extracted policy text.
- **Data Sharing Detection:** Specifically flags clauses allowing the sale or sharing of PII with "third-party affiliates" or "marketing partners".

## 4. Output Contract
The Privacy Intelligence Engine outputs intermediate findings rather than a final score.

```json
{
  "engine": "PrivacyIntelligence",
  "findings": [
    {
      "category": "Tracking",
      "severity": "high",
      "feature_trigger": "third_party_cookie_count",
      "raw_value": 45,
      "internal_code": "PRIV-TRK-EXCESS"
    },
    {
      "category": "Privacy Abuse",
      "severity": "critical",
      "feature_trigger": "policy_data_sold",
      "raw_value": true,
      "internal_code": "PRIV-POL-SALE"
    }
  ]
}
```
These findings are passed to the **Score Fusion Engine**, which calculates the final user-facing **Privacy Score** (0-100).

## 5. Related Engines
- [Feature Extraction Engine](./09b_FEATURE_EXTRACTION_ENGINE.md)
- [Score Fusion Engine](./16_SCORING_ENGINE.md)
