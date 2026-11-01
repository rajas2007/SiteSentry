# 26. Community Intelligence (Deferred)

* **Product:** Site Sentry
* **Status:** Deferred per ADR-004 (Section 3.15)
* **Canonical Path:** `dev/26_COMMUNITY_INTELLIGENCE.md`
* **Related ADR:** [ADR-004: Deferring Web3 Auditing and Community Intelligence Systems](./decisions/ADR-004-defer-web3-community-intelligence.md)

---

## 1. Overview & Deferred Status

The original TrustLens AI architecture proposed a decentralized **Community Intelligence Engine** that relied on crowdsourced user voting, reputation staking ("Cyber Hygiene Scores"), and consensus algorithms to automatically flag or unblock websites.

Under Site Sentry's revised architecture, **the full crowdsourced community intelligence and reputation system is officially deferred**:
* Unverified community votes or reports are **strictly excluded** from the real-time scanning path (`ScanService.analyze_page()`).
* Community reports cannot alter a website's score, override authoritative threat intelligence feeds, or trigger automated domain blocks.
* No consensus algorithms, token staking, or gamified user scoring systems will be implemented.

---

## 2. Vulnerabilities of Crowdsourced Reputation

The decision to defer community scoring is based on fundamental security and game-theoretic vulnerabilities:
1. **Sybil Attacks:** Malicious actors can spin up thousands of synthetic identities to artificially downvote competitor websites or upvote newly deployed phishing domains.
2. **Coordinated Extortion & Brigading:** Open voting systems are susceptible to organized harassment campaigns targeting specific commercial or political sites.
3. **Poisoning of Automated Defenses:** Feeding unverified crowdsourced reports directly into automated blocking rules creates severe false positives on critical business portals.
4. **Moderation Overhead:** Validating crowdsourced claims requires dedicated human security operations teams, which is unsustainable at the current stage.

---

## 3. Retained Scope: Passive Feedback for Security Analysts

While automated crowdsourced scoring is deferred, the concept of **user-submitted feedback** is preserved strictly as an asynchronous telemetry channel:
* **False Positive Feedback:** Users can submit a URL if they believe a legitimate site was incorrectly flagged as suspicious.
* **Triage Pipeline:** Submissions are queued into an administrative review log for inspection by human security analysts.
* **Zero Automatic Impact:** Feedback submissions do **not** dynamically change scan scores or database reputation records until verified by an authoritative rule update or threat intelligence feed refresh.

Conditions for revisiting community features are detailed in [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
