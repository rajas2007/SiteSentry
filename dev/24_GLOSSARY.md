# 24. Glossary of Terms

* **Product:** Site Sentry (formerly TrustLens AI)
* **Canonical Path:** `dev/24_GLOSSARY.md`

---

## A
* **Action (API Action):** The canonical operational browser directive emitted by the Decision Engine via the API schema `Decision.action: Literal["allow", "warn", "block"]`. Incomplete scans are represented via `action = "warn"` with `threat_category = "inconclusive"`. `INCONCLUSIVE` and `ERROR` are not API actions.
* **Analysis Completeness (`data_completeness`):** A boolean attribute in analysis responses indicating whether all active threat intelligence providers responded successfully without timeouts or rate limits (`True` / `False`). When `False`, an otherwise clean site cannot receive `"allow"`.

## C
* **Canonical 27-Feature Schema (`v1`):** The foundational 27-feature vector ordering defined in `services/api/src/engines/machine_learning/schemas.py` (`FEATURE_ORDER`), spanning structural features (0–19) and threat intelligence features (20–26).
* **Community Intelligence:** A crowdsourced threat reporting subsystem, officially **deferred** per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md) to prevent Sybil attacks and reputation poisoning.

## D
* **Decision Engine:** The final pipeline component that maps scores, findings, and analysis completeness into canonical browser actions (`allow`, `warn`, `block`) and threat categories per [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md).
* **DomainReputation:** The database entity (`services/api/src/models/scan.py`) tracking rolling scan volume and threat encounter metrics for domains.

## E
* **Explainability Engine:** The subsystem that formats observable security signals into transparent, human-understandable evidence dictionaries delivered to the user interface.

## F
* **Feature Extraction Engine:** The translation layer that normalizes client-side DOM metrics and URL strings into structured schemas for downstream engines.

## G
* **Google Safe Browsing (GSB):** Authoritative global threat feed queried asynchronously by Site Sentry's Threat Intelligence Engine. A positive match acts as a hard override forcing score $\le 10.0$ and `action = "block"` per [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md).

## H
* **Honest Uncertainty:** The design principle mandating that provider timeouts, rate limits, or missing evidence must result in `data_completeness = False` and `threat_category = "inconclusive"` under `action = "warn"`, and must **never** be represented as safe or issued an `action = "allow"`.

## M
* **Machine Learning Engine:** The offline research subsystem for training and evaluating tabular phishing classifiers. Model training and live inference are **deferred** per [ADR-002](./decisions/ADR-002-defer-ml-training.md).
* **MODEL_CONTRACT.md:** The binding specification defining the 20-feature `v1_structural` input tensor boundary that excludes threat intelligence features from future ML models.

## O
* **Operational Failure:** A client-side state where the extension cannot reach the backend API (network disconnection or HTTP 5xx). Handled entirely in the client with a `slate` badge and retry UI; distinct from API responses.

## P
* **Privacy Intelligence Engine:** The secondary analytical engine evaluating third-party tracker script counts and cookie density.

## R
* **Rule Engine:** The deterministic engine executing Boolean rules against lexical, transport, and structural DOM signals.

## S
* **ScanHistory:** The database entity (`services/api/src/models/scan.py`) recording immutable audit logs of each performed scan.
* **Score Fusion Engine:** The central engine that computes the normalized security score ($0.0 - 100.0$), caps VirusTotal deductions at 50 points, and enforces hard threat overrides per [16. Score Fusion Engine](./16_SCORING_ENGINE.md).
* **Security Engine:** The analytical engine evaluating intrinsic website characteristics (URL syntax, hostname entropy, punycode, login forms).
* **Site Sentry:** The canonical name of the browser security platform.

## T
* **Threat Category:** The taxonomic classification assigned to the scan by the pipeline (e.g., `phishing`, `malware`, `credential_theft`, `suspicious_content`, `elevated_risk`, `inconclusive`, `safe`). Incomplete scans with no active threats are assigned `threat_category = "inconclusive"`.
* **Threat Intelligence Engine:** The engine managing concurrent, bounded outbound lookups across Google Safe Browsing and VirusTotal APIs with resilience guards.
* **Trust Engine:** The historical entity reputation subsystem; its independent scoring role is deferred to preserve transparency.

## U
* **UI State:** Visual representations in browser chrome and popups, including badge colors (`emerald`, `amber`, `rose`, `slate`), icons, and interstitial warnings. Distinct from API action enums.

## V
* **VirusTotal Capped Deduction:** The authoritative scoring policy where positive vendor detections apply $-10.0$ points per detection, strictly capped at a maximum deduction of 50.0 points.
* **v1_structural:** The 20-feature structural model boundary (features 0–19) isolating page structure from threat intelligence features 20–26.

## W
* **Warning Interstitial (`warning.html`):** The isolated extension-origin page (`chrome-extension://...`) displayed during `BLOCK` actions, preventing credential entry without mutating the page DOM per [ADR-005](./decisions/ADR-005-browser-warning-over-dom-tampering.md).
* **Web3 Engine:** The smart contract and crypto wallet auditing module, officially **deferred** per [ADR-004](./decisions/ADR-004-defer-web3-community-intelligence.md).
