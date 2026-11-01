# 16. Score Fusion Engine

* **Product:** Site Sentry
* **Status:** Authoritative Scoring Specification & Codebase Mapping
* **Canonical Path:** `dev/16_SCORING_ENGINE.md`
* **Implementation:** `services/api/src/engines/score_fusion/engine.py`
* **Test Suite:** `services/api/tests/test_score_fusion.py`
* **Related Contract:** [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md)

---

## 1. Overview & Authoritative Status

The **Score Fusion Engine** (`services/api/src/engines/score_fusion/`) synthesizes intrinsic structural security findings, external threat intelligence metrics, and privacy indicators into a normalized numerical score ($0$ to $100$) and an explanatory factor list.

This document serves as the **single authoritative specification** for Site Sentry's scoring formula, directly reflecting the verified logic in `services/api/src/engines/score_fusion/engine.py`.

---

## 2. Reconciled VirusTotal Semantics

The relationship between VirusTotal detections, blacklisting, and score penalties is structured as follows:

```
[VirusTotal API Results]
         │
         ▼
Is malicious_count >= 3?
  ├──► YES ──► ThreatIntelligenceEngine adds "VirusTotal" to blacklists_triggered
  │            ▼
  │            ScoreFusionEngine executes: score = min(score, 10) [Hard Override]
  │            has_confirmed_threat = True
  │
  └──► NO (total_vendor_flags > 0: 1 or 2 detections)
               ▼
               ScoreFusionEngine executes: penalty = min(50, total_vendor_flags * 10)
               score -= penalty [Proportional Capped Deduction]
               has_confirmed_threat = True
```

### Clarification of Fields & Flags
* **`blacklists_triggered`:** Contains provider names (e.g., `"Google Safe Browsing"`, `"VirusTotal"`). A positive match forces `score = min(score, 10)` and marks `has_confirmed_threat = True`.
* **`total_vendor_flags`:** The total count of security vendors flagging the domain.
* **Proportional Deduction:** When `blacklists_triggered` is not set, detections apply $-10.0$ points per vendor, strictly **capped at a maximum deduction of 50.0 points**.
* **Superseeded Zeroing Rule:** Older documentation that suggested setting `score = 0` whenever VT detections hit a threshold is officially **superseded** by this two-tiered (clamp vs. capped deduction) model.

> [!NOTE]
> **Implementation Naming Ambiguity & Unresolved Policy Question (Under Review):**
> In `ScoreFusionEngine.fuse()`, `has_confirmed_threat` is set to `True` whenever `total_vendor_flags > 0`, even if detections are low (1 or 2 flags). In `DecisionEngine`, `has_confirmed_threat == True` prevents an `"allow"` action and forces `"warn"`, even if the score is $\ge 80$. Detections of 1–2 vendor flags represent vendor threat signals rather than independently confirmed threats. The naming ambiguity of `has_confirmed_threat` covering both confirmed blacklist hits and low-confidence vendor signals is an acknowledged implementation detail scheduled for future review.

---

## 3. Mathematical Scoring Formula & Code Implementation

The fused score is computed in `services/api/src/engines/score_fusion/engine.py` starting from a baseline of $100$:

### 3.1. Baseline
$$\text{Score}_{\text{initial}} = 100$$

### 3.2. Threat Intelligence Deductions & Clamp
1. **Blacklist Hard Clamp:**
   $$\text{If } \text{blacklists\_triggered} \neq \emptyset \implies \text{Score} = \min(\text{Score}, 10)$$
2. **Proportional Vendor Penalty (if not blacklisted):**
   $$\text{If } \text{total\_vendor\_flags} > 0 \implies \text{Score} = \text{Score} - \min(50, \text{total\_vendor\_flags} \times 10)$$

### 3.3. Structural Signal Deductions
Deductions applied from `SecurityEngine` structural signals:
* **`insecure_login`** (password field on unencrypted HTTP / IP host): $-40$ points
* **`no_https`** (plain unencrypted transport): $-30$ points
* **`suspicious_login`** (external form submission or anomalous path): $-20$ points
* **`suspicious_keywords`** (phishing keyword density): $-15$ points
* **`long_hostname`** or **`multiple_subdomains`**: $-10$ points

### 3.4. Privacy Intelligence Deductions
Deductions applied from `PrivacyIntelligenceEngine` findings:
* **Critical Privacy Risk:** $-40$ points
* **High Privacy Risk:** $-20$ points
* **Medium Privacy Risk:** $-10$ points

### 3.5. Final Normalization
$$\text{Final Score} = \max(0, \min(100, \text{Score}))$$

---

## 4. Score Ranges and Decision Engine Thresholds

The score boundaries map directly into the operational thresholds defined in `DecisionEngine` (`services/api/src/engines/decision/engine.py`):

| Score Range | Severity | Decision Action | Category Context |
| :--- | :--- | :--- | :--- |
| **$0 \le \text{Score} < 50$** | `"high"` | `"block"` | Confirmed threat (`phishing`, `malware`) or severe vulnerability (`credential_theft`). |
| **$50 \le \text{Score} < 80$** | `"medium"` | `"warn"` | Elevated risk or suspicious content. |
| **$80 \le \text{Score} \le 100$** | `"low"` | `"allow"` | Clean site (requires `data_completeness == True`). |
| **$80 \le \text{Score} \le 100$** | `"medium"` | `"warn"` | Incomplete threat check (`data_completeness == False` $\implies$ category is `"inconclusive"`). |

---

## 5. Confidence and Analysis Completeness

* **Confidence (`confidence: float`):**
  * `0.95`: Domain triggered an active blacklist.
  * `0.90`: Threat intel complete with 0 detections.
  * `0.85` / `0.70`: Incomplete data with partial provider status.
  * `0.50`: All providers unavailable.
* **Completeness (`data_completeness: bool`):**
  * If `False`, `ScoreFusionEngine` appends an explanatory factor: *"Threat intelligence data is incomplete or unavailable"*.
  * Incomplete scans with scores $\ge 80$ are prevented from receiving `"allow"`, yielding `"warn"` with threat category `"inconclusive"`.
