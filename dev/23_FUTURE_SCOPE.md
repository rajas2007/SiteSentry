# 23. Future Scope & Deferred Capabilities

* **Product:** Site Sentry
* **Status:** Authoritative Catalog of Deferred & Long-Term Capabilities
* **Canonical Path:** `dev/23_FUTURE_SCOPE.md`
* **Related Roadmap:** [19. Development Roadmap](./19_DEVELOPMENT_ROADMAP.md)

---

## 1. Overview & Scope Management Principles

To achieve commercial-grade reliability in the core browser security pipeline, Site Sentry strictly bounds its immediate engineering scope.

The original TrustLens AI documentation described a wide array of speculative modules (ML classifiers, crypto wallet drainers, LLM privacy policy assistants, community voting). This document formally catalogs those capabilities as **deferred**, preserving their architectural designs for future consideration while ensuring they do not divert resources from core phishing and malware detection.

---

## 2. Formally Deferred Subsystems

### 2.1. Machine Learning Model Training & SHAP Explainability
* **Status:** Deferred per [ADR-002](./decisions/ADR-002-defer-ml-training.md).
* **Rationale:** Current public datasets lack complete DOM trees and suffer from domain leakage. Deterministic structural rules and authoritative threat intelligence provide superior explainability without ML operational overhead.
* **Revisit Gate:** Only reconsidered during **Phase 5** if empirical benchmarking in Phase 3 demonstrates quantifiable zero-minute detection gaps that deterministic rules cannot resolve.

### 2.2. Web3 & Smart Contract Security
* **Status:** Deferred per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
* **Scope:** Real-time smart contract decompilation, EVM bytecode vulnerability auditing, and wallet drainer signature matching (`services/api/src/engines/web3/`).
* **Rationale:** Specialized niche outside mainstream web security. Introduces blockchain node RPC costs, latency spikes, and external rate limits into navigation scanning.

### 2.3. Crowdsourced Community Intelligence & Reputation Voting
* **Status:** Deferred per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md) and [26. Community Intelligence](./26_COMMUNITY_INTELLIGENCE.md).
* **Scope:** Decentralized voting, reputation staking, and user-generated domain blacklists.
* **Rationale:** Highly vulnerable to Sybil attacks, competitor sabotage, extortion, and false-positive poisoning. Authoritative threat feeds (Google Safe Browsing, VirusTotal) remain the sole trusted external authority.

### 2.4. LLM-Based Legal Privacy Policy Analysis
* **Status:** Deferred per [11. Privacy Intelligence Engine](./11_PRIVACY_ENGINE.md).
* **Scope:** Automated extraction and natural-language summarization of `/privacy-policy` legal text using OpenAI or Anthropic LLMs.
* **Rationale:** High API latency, non-deterministic outputs, and significant external API costs that distract from core threat protection.

### 2.5. Enterprise Fleet Management & Corporate SOC APIs
* **Status:** Deferred.
* **Scope:** Multi-tenant organization hierarchies, MDM configuration profiles, centralized employee browsing audit logs, and SIEM streaming.
* **Rationale:** Enterprise B2B capabilities require enterprise auth (SAML/SSO), tenant data segregation, and dedicated compliance frameworks disproportionate to current single-tenant baseline needs.

### 2.6. Visual Phishing Detection (Computer Vision)
* **Status:** Deferred.
* **Scope:** Capturing rendered viewport screenshots and running Convolutional Neural Networks (CNNs) to detect visual brand impersonation (e.g., detecting a fake PayPal logo on an unlisted domain).
* **Rationale:** Heavy computational footprint, high latency, and complex client-side headless rendering requirements.

### 2.7. Native Mobile Applications
* **Status:** Deferred.
* **Scope:** Standalone iOS and Android apps using local VPN/DNS packet filters.
* **Rationale:** Chrome and Chromium desktop extension remains the primary target deployment.
