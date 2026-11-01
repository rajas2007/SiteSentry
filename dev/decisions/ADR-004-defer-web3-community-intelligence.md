# ADR-004: Deferring Web3 Auditing and Community Intelligence Systems

* **Status:** Proposed (Under Review)
* **Date:** 2026-10-19
* **Authors:** Site Sentry Core Engineering Team
* **Deciders:** Product Strategy, Application Security

---

## 1. Context

The original TrustLens AI architectural specification envisioned two specialized modules:
1. **Web3 Engine (`services/api/src/engines/web3/`):** Intended to detect crypto-drainers, inspect Ethereum/Solana wallet connection scripts, decompile smart contract bytecode, and query blockchain RPC nodes.
2. **Community Intelligence Engine (`dev/26_COMMUNITY_INTELLIGENCE.md`):** Intended to establish a decentralized or crowdsourced threat reporting mechanism where end-users submit website ratings and report malicious domains to build a collective reputation score.

### Critical Challenges Identified
* **Mission Creep:** Site Sentry's core purpose is protecting everyday web users against mainstream phishing, credential harvesting, malware delivery, and deceptive websites. Web3 wallet draining represents a specialized niche with high maintenance requirements (tracking dozens of blockchain protocols, DEX interfaces, and wallet standards).
* **Adversarial Exploitation of Crowdsourcing:** Unverified user voting systems are notoriously vulnerable to Sybil attacks, competitor sabotage, extortion, and brigading. Allowing unverified community downvotes or upvotes to alter a website's security score creates catastrophic false positives or enables attackers to whitelabel malicious domains.
* **Operational & Security Burden:** Querying blockchain nodes and auditing decentralized contracts introduces third-party RPC rate limits, blockchain node hosting costs, and non-deterministic smart contract state transitions into the real-time scanning loop.

---

## 2. Decision

We **defer** both the Web3 Engine and the Community Intelligence Engine from active development and production scanning:

1. **Excluded from Critical Scan Path:** Neither `Web3Engine` nor any community voting subsystem shall be invoked during `ScanService.analyze_page()`.
2. **No Community Overrides:** Unverified user reports, feedback, or community ratings shall NEVER override or dilute authoritative threat intelligence (Google Safe Browsing, VirusTotal) or deterministic structural findings.
3. **Preserve Existing Code:** The code located in `services/api/src/engines/web3/` shall remain in the repository as an inactive, modular research prototype. No new dependencies or RPC configurations will be added.
4. **Passive Feedback Only:** If the browser extension collects user feedback or false-positive reports in the future, such submissions are treated strictly as unverified telemetry queued for asynchronous security analyst review, not real-time scoring inputs.

---

## 3. Rationale

* **Threat Feeds Are Authoritative:** Global security vendors and community security projects (e.g., Google Safe Browsing, VirusTotal, PhishTank) already maintain robust threat verification pipelines with dedicated security research teams. Replicating an unmoderated crowdsourced voting system creates high risk with minimal added security value.
* **Focused Attack Surface:** Disabling smart contract RPC calls and Web3 script analysis eliminates extraneous third-party network dependencies, API keys, and potential SSRF vectors from the backend.
* **Engineering Focus:** Conserves developer resources to deliver maximum reliability and precision on deterministic phishing and malicious website detection.

---

## 4. Alternatives Considered

* **Basic In-Page Web3 Script Detection:**
  * *Description:* Flag pages that inject `window.ethereum` or contain crypto-wallet connection triggers.
  * *Reason for Rejection:* The mere presence of Web3 scripts is common across hundreds of thousands of legitimate dApps and tech blogs; flagging them produces excessive false positives without confirming malicious intent.
* **Weighted Web-of-Trust Voting System:**
  * *Description:* Weight user votes by user tenure or staked tokens.
  * *Reason for Rejection:* Highly vulnerable to bot networks and account takeover attacks; requires a complete anti-fraud, moderation, and identity infrastructure disproportionate to the project's current scale.

---

## 5. Consequences

### Positive
* Protects the core security scoring engine from manipulation and Sybil attacks.
* Eliminates Web3 RPC provider costs and rate-limiting dependencies.
* Keeps the scanning pipeline focused on universal web threats affecting all Internet users.

### Negative / Trade-offs
* Specialized crypto wallet drainers that do not employ conventional phishing or malware signatures may not be flagged unless detected by upstream threat intelligence feeds.

---

## 6. Conditions for Revisit

This decision may be revisited if:
1. Product direction explicitly expands to crypto-native security tooling with dedicated funding for blockchain threat intelligence feeds and analyst moderation.
2. A vetted, third-party authoritative crypto-threat API (e.g., Chainalysis, Blowfish, Web3 Antivirus) is integrated as a standard threat intelligence provider rather than building an in-house blockchain analyzer.
