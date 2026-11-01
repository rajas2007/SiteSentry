# 09a. Rule Engine

* **Product:** Site Sentry
* **Status:** Active & Prioritized (Core Deterministic Foundation)
* **Canonical Path:** `dev/09a_RULE_ENGINE.md`
* **Related ADR:** [ADR-001: Prioritizing Deterministic Security Rules Over ML](./decisions/ADR-001-deterministic-security-priority.md)
* **Authoritative Contracts:**
  * [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md)
  * [16. Score Fusion Engine](./16_SCORING_ENGINE.md)

---

## 1. Overview & Architectural Role

The Rule Engine (`services/api/src/engines/rules/`) provides the deterministic backbone of Site Sentry. It evaluates observable URL, hostname, and DOM signals against concrete security rules to produce unambiguous findings, severity classifications, and score deductions.

Because machine learning model training is deferred (per [ADR-002](./decisions/ADR-002-defer-ml-training.md)), the Rule Engine—working alongside the `SecurityEngine` and `ThreatIntelligenceEngine`—is the primary mechanism for detecting threats.

---

## 2. Evidence Hierarchy & Rule Taxonomy

The Rule Engine distinguishes between three distinct classes of evidence:

1. **Authoritative Threat Findings:**
   * Signals from verified threat feeds (e.g., Google Safe Browsing match, or VirusTotal $\ge 3$ detections entering `blacklists_triggered`).
   * Semantics: Confirmed malicious. Triggers hard overrides clamping score $\le 10.0$ and enforcing an `"action": "block"`.
2. **Strong Structural Security Rules:**
   * Highly discriminatory technical signals (e.g., `insecure_login` [$-40$ pts], `no_https` [$-30$ pts], `suspicious_login` [$-20$ pts]).
   * Semantics: Critical/High severity findings. If cumulative deductions bring the score below 50, the site receives `"action": "block"` with threat category `"credential_theft"`.
3. **Weak Heuristic Indicators:**
   * Contextual characteristics that correlate with phishing but occur on benign sites (e.g., `long_hostname` [$-10$ pts], `multiple_subdomains` [$-10$ pts], `suspicious_keywords` [$-15$ pts]).
   * Semantics: Low/Medium severity. Weak heuristics contribute to a `"warn"` action only when combined with other indicators; they can **never** trigger a `"block"` action on their own.

---

## 3. Reconciliation of VirusTotal Scoring Policy

> [!IMPORTANT]
> **Resolution of Historical VirusTotal Policy Contradiction:**
> An older draft of this document suggested a zero-tolerance rule: `IF virus_total_positives >= 3 THEN security_score = 0`.
>
> **Authoritative Codebase Contract:**
> As verified in `services/api/src/engines/threat_intelligence/engine.py` and `services/api/src/engines/score_fusion/engine.py`:
> 1. **Detections $\ge 3$:** Added to `blacklists_triggered`, triggering a hard clamp: `score = min(score, 10)` and setting `has_confirmed_threat = True`, which leads to an `"action": "block"`.
> 2. **Detections $1 - 2$:** Apply a proportional deduction `penalty = min(50, total_vendor_flags * 10)` ($-10$ or $-20$ points) and set `has_confirmed_threat = True`, which leads to an `"action": "warn"`. These low detections represent vendor threat signals rather than independently confirmed threats.
>
> *(Note on implementation terminology: In the current codebase, the boolean flag `has_confirmed_threat` is set to `True` whenever `total_vendor_flags > 0`, including 1–2 vendor detections. However, 1–2 detections represent weak vendor signals rather than confirmed malicious infrastructure; they trigger a cautionary `"action": "warn"` rather than a `"block"`. The naming of `has_confirmed_threat` for low vendor detections is an implementation detail scheduled for future review).*
>
> The older "zeroing" rule is officially marked as **superseded** by this two-tiered clamp vs. capped deduction model.

---

## 4. Signal Deductions in Implementation

The following deductions reflect the active implementation in `services/api/src/engines/score_fusion/engine.py`:

| Signal ID | Observable Condition | Category | Score Deduction |
| :--- | :--- | :--- | :--- |
| `insecure_login` | Password field submitted over unencrypted HTTP | Credential Risk | $-40.0$ |
| `no_https` | Unencrypted HTTP transport | Transport Security | $-30.0$ |
| `suspicious_login` | External form action or suspicious credential target | Credential Risk | $-20.0$ |
| `suspicious_keywords`| High density of sensitive/phishing keywords | Lexical Anomaly | $-15.0$ |
| `long_hostname` | Hostname length exceeds threshold | Hostname Anomaly | $-10.0$ |
| `multiple_subdomains`| Subdomain count exceeds threshold | Hostname Anomaly | $-10.0$ |

---

## 5. Strengths & Governance

* **100% Explainable:** Each rule corresponds to an explicit finding identifier, user-facing title, and technical evidence dictionary.
* **Sub-Millisecond Execution:** Rules execute as compiled in-memory Boolean logic in Python, taking $< 2\text{ms}$.
* **No Model Drift:** Unlike statistical models, deterministic rules do not suffer from distribution shift or silent degradation over time.
