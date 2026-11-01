# 11a. Web3 Engine (Deferred)

* **Product:** Site Sentry
* **Status:** Deferred per ADR-004 (Inactive Prototype)
* **Canonical Path:** `dev/11a_WEB3_ENGINE.md`
* **Related ADR:** [ADR-004: Deferring Web3 Auditing and Community Intelligence Systems](./decisions/ADR-004-defer-web3-community-intelligence.md)
* **Prototype Directory:** `services/api/src/engines/web3/`

---

## 1. Overview & Deferred Status

The **Web3 Engine** was originally conceived as a specialized subsystem for detecting cryptocurrency wallet drainers, analyzing smart contract bytecode, and auditing Ethereum/Solana wallet connection requests.

Under Site Sentry's revised architecture, **the Web3 Engine is officially deferred from immediate production roadmaps**:
* It is **excluded** from the active scan path (`ScanService.analyze_page()`).
* No live blockchain node connections or third-party crypto-threat APIs (e.g., Etherscan, Chainalysis) are configured or queried.
* Existing prototype code located in `services/api/src/engines/web3/` is preserved in the repository as an inactive, modular reference.

---

## 2. Rationale for Deferral

1. **Alignment with Core Purpose:** Site Sentry is focused on protecting the broad population of internet users from credential harvesting, malware, and brand impersonation. Crypto wallet drainers represent a specialized niche with high maintenance requirements.
2. **Third-Party RPC Volatility:** Querying blockchain nodes introduces high latency, third-party RPC rate limiting, and unpredictability into a real-time browser security tool designed for sub-500ms navigation responses.
3. **Attack Surface Minimization:** Disabling outbound blockchain RPC calls eliminates potential Server-Side Request Forgery (SSRF) risks and unnecessary external API keys from backend deployments.

---

## 3. Preserved Conceptual Architecture (Future Scope)

If the team decides to reactivate Web3 security in future phases, the preserved architecture encompasses:
* **Connection Inspection:** Identifying when a page requests wallet access via `window.ethereum` or Solana providers.
* **Payload Auditing:** Warning users against signing dangerous approval payloads (e.g., `setApprovalForAll`, `eth_sign`).
* **Contract Threat Feeds:** Integrating with established Web3 threat intelligence feeds rather than compiling and decompiling smart contracts on the backend.

Reactivation criteria are formally defined in [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
