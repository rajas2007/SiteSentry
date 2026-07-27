# 10 Security Engine

## 1. Overview
The Security Engine is a core plugin in the TrustLens AI Platform responsible for evaluating the structural and payload-based security of a website.

*Note: In previous iterations, this engine directly queried OSINT feeds and calculated final scores. Under the new platform architecture, it relies purely on the **Feature Extraction Engine** for its inputs and relies on the **Score Fusion Engine** to finalize its outputs.*

## 2. Responsibilities
The Security Engine focuses purely on analyzing the *intrinsic* properties of the webpage and its transport layer, identifying patterns indicative of:
- **Credential Theft:** Specifically targeting Fake Logins and password harvesting.
- **Browser Hijacking:** Detecting abusive scripts that alter browser behavior.
- **Malware Distribution:** Identifying drive-by download structures or hidden cryptominers.

## 3. Internal Analyzers
The engine runs several sub-analyzers on the extracted feature vectors:

### 3.1. Lexical Analyzer
Analyzes URL structures for anomalies (e.g., high entropy, IP-based URLs, typosquatting of known brands).

### 3.2. TLS/SSL Analyzer
Evaluates the transport layer security features (e.g., invalid certificates, weak ciphers, untrusted issuers).

### 3.3. Payload Analyzer
Evaluates the DOM features extracted by the client (e.g., presence of `<input type="password">` on non-HTTPS pages, hidden `<iframe>` elements used for clickjacking).

## 4. Pipeline Execution
1. The **Feature Extraction Engine** passes a structured dictionary of security-related features (e.g., `has_password_field: true`, `has_https: false`).
2. The Security Engine processes these features.
3. It does **not** output a final "Security Score".
4. Instead, it outputs a set of intermediate findings and risk multipliers (e.g., `PayloadRisk: High`, `TLSRisk: Critical`).
5. These findings are passed downstream to the **Rule Engine** (for deterministic zero-tolerance blocking) and the **Machine Learning Engine** (for probabilistic context evaluation).

## 5. Related Engines
- [Feature Extraction Engine](./09b_FEATURE_EXTRACTION_ENGINE.md)
- [Threat Intelligence Engine](./10a_THREAT_INTELLIGENCE_ENGINE.md) (Handles external checks now)
