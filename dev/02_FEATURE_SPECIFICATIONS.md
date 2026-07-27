# 02 Feature Specifications

## 1. Introduction
This document details the specific features, capabilities, and threat categories handled by the TrustLens AI Platform engines.

## 2. Threat Risk Categories
Instead of a binary "Dangerous" label, the platform categorizes risks granularly to power the Decision Engine's recommendations:
- **Credential Theft:** Sites actively attempting to steal passwords or session tokens.
- **Fake Login:** High-fidelity visual clones of legitimate services (e.g., Office365, banks).
- **Phishing:** General deceptive practices to steal PII.
- **Malware:** Domains known to distribute malicious binaries or drive-by downloads.
- **Spam:** Aggressive, unsolicited marketing or low-reputation domains.
- **Tracking:** Excessive use of third-party cookies and browser fingerprinting.
- **Crypto Scam:** Fake token presales, wallet drainers, and malicious airdrops.
- **Privacy Abuse:** Selling data without consent or violating stated privacy policies.
- **Fake Store:** E-commerce sites with no intent to ship products.
- **Browser Hijacking:** Sites that alter browser settings or hijack search.
- **Notification Abuse:** Sites that aggressively prompt or misuse push notifications to deliver ads.

## 3. Engine-Specific Features

### 3.1. Security Engine
- Focuses purely on analyzing extracted security features.
- Flags indicators of Fake Logins, Malware hosting, and Browser Hijacking based on DOM and URL structure.

### 3.2. Privacy Intelligence Engine
- **Email Collection Detection:** Identifies aggressive pop-ups for email harvesting.
- **Privacy Policy AI:** Analyzes legal text to detect Data Sharing and Marketing Abuse.
- **Tracker & Cookie Analysis:** Evaluates fingerprinting and third-party storage.

### 3.3. Threat Intelligence Engine
- Unified interface for querying external feeds (Google Safe Browsing, VirusTotal, PhishTank, OpenPhish, WHOIS).
- Normalizes disparate external threat data into a standard TrustLens Threat Object.

### 3.4. Web3 Engine (Plugin)
- **Wallet Reputation:** Checks the historical reputation of addresses requested for connection.
- **Smart Contract Reputation:** Audits contracts for known honeypot or drainer signatures.
- **Transaction Warning:** Alerts users before signing high-risk payloads (e.g., `setApprovalForAll`).

### 3.5. Community Intelligence
- **Crowdsourced Reporting:** Users can report False Positives or False Negatives.
- **Reputation System:** Users gain a Cyber Hygiene Score based on the accuracy of their reports.
- **Community Whitelist/Blacklist:** Rapid consensus-based blocking of emerging threats before ML catches them.

### 3.6. Knowledge Base
- A centralized repository that stores:
  - Known threat signatures and detection patterns.
  - Learning resources and definitions (accessible via the UI).
  - Historical context used by the Machine Learning Engine for retraining.

## 4. User Interface Features
### 4.1. Browser Extension
- **Multi-Score Dashboard:** Displays Security, Privacy, Trust, and Web3 scores.
- **Confidence Indicator:** Shows high/medium/low confidence.
- **Analysis Timeline:** Visual checklist showing steps completed (e.g., "✔ WHOIS Retrieved", "✔ AI Analysis Complete").

### 4.2. Web Dashboard
- **Threat Categories Timeline:** Visualizes which specific categories (e.g., Credential Theft vs Privacy Abuse) the user has encountered over the month.

## 5. References
- [Decision Engine](./16a_DECISION_ENGINE.md)
- [Web3 Engine](./11a_WEB3_ENGINE.md)
