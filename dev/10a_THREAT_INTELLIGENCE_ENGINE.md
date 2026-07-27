# 10a Threat Intelligence Engine

## 1. Overview
The Threat Intelligence Engine is a dedicated module responsible for interfacing with all external OSINT (Open-Source Intelligence) databases and community threat feeds. It acts as an abstraction layer, shielding the rest of the TrustLens AI Platform from the complexities, rate limits, and downtimes of third-party APIs.

## 2. Responsibilities
- Fetching historical and real-time threat data for a given domain, IP, or URL.
- Normalizing disparate API responses into a unified TrustLens Threat Object.
- Aggregating Community Reports from the Community Intelligence Engine.
- Caching expensive OSINT lookups in Redis to ensure sub-100ms response times for repeat queries.

## 3. External Integrations
The engine orchestrates calls to the following providers:
- **Google Safe Browsing API:** Real-time checks for known malware and phishing URLs.
- **VirusTotal API:** Broad consensus check against 80+ security vendors.
- **WHOIS & DNS APIs:** Extracts domain registration dates and registrar reputation.
- **PhishTank & OpenPhish:** Specialized feeds for zero-day phishing campaigns.

## 4. Internal Integrations
- **Knowledge Base:** Checks the internal database for historically verified threat signatures.
- **Community Intelligence:** Checks if the domain has been recently flagged by highly-reputable TrustLens users before it appears on public feeds like VirusTotal.

## 5. Output format (Unified Threat Object)
The Threat Intelligence Engine returns a structured object that is consumed by the **Feature Extraction Engine** and the **Rule Engine**.

```json
{
  "domain": "evil-phish.com",
  "domain_age_days": 2,
  "blacklists_triggered": ["Google Safe Browsing", "PhishTank"],
  "total_vendor_flags": 12,
  "community_flags": 4,
  "threat_categories": ["Phishing", "Credential Theft"],
  "registrar_reputation": "low",
  "confidence": 0.95
}
```

## 6. Fallback & Resilience Strategy
If a third-party API (e.g., VirusTotal) experiences an outage or rate limits the platform, the Threat Intelligence Engine gracefully degrades. It returns the data it *does* have, and sets an internal `data_completeness` flag to `false`. This flag propagates down to the **Score Fusion Engine**, which will correspondingly lower the final **Confidence Score** presented to the user.
