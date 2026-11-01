# 10. Security Engine

* **Product:** Site Sentry
* **Status:** Active & Prioritized (Core Analytical Engine)
* **Canonical Path:** `dev/10_SECURITY_ENGINE.md`
* **Implementation:** `services/api/src/engines/security/engine.py`
* **Related Contract:** [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md)

---

## 1. Overview & Architectural Role

The **Security Engine** (`services/api/src/engines/security/`) is the central deterministic analyzer for intrinsic website characteristics in Site Sentry. It evaluates observable lexical, transport, and structural DOM signals to detect phishing kits, credential-harvesting mechanisms, and deceptive infrastructure.

The Security Engine executes entirely in-process within `ScanService.analyze_page()`, producing structured findings with associated severity ratings and evidence objects.

---

## 2. Core Analyzers & Evaluated Signals

### 2.1. Lexical & Hostname Analyzer
Evaluates properties of the URL and fully qualified domain name (FQDN):
* **IP-Based Hostnames:** Detects direct IPv4 or IPv6 access (e.g., `http://192.168.1.1/login`), a hallmark of disposable phishing hosts.
* **Punycode / Homoglyphs:** Detects Internationalized Domain Names (`xn--`) used to impersonate established brand domains with lookalike Cyrillic/Greek characters.
* **Structural Entropy:** Computes Shannon entropy on host and path strings to detect Domain Generation Algorithms (DGA) and randomized credential drops.
* **URL Structural Metrics:** Evaluates URL length, subdomain count, and path depth against statistical anomaly thresholds.

### 2.2. Transport Security Analyzer
* **Protocol Verification:** Checks for `https://` vs. unencrypted `http://`.
* **Contextual Escalation:** If sensitive elements (such as password fields or login forms) are detected on unencrypted HTTP pages, the finding severity is escalated to **High** or **Critical**.

### 2.3. DOM Structural & Form Target Analyzer
Inspects lightweight structural DOM metrics provided by the extension content script:
* **Credential Input Context:** Detects `<input type="password">` elements and form structures.
* **External Form Submission:** Compares form `action` URLs against the page origin. Forms submitting credentials to disparate external domains or IP hosts trigger critical credential harvesting alerts.
* **Obfuscation & Hidden Elements:** Checks for hidden iframes (`<iframe>`), zero-dimension elements, or script obfuscation markers often used in phishing cloaking.

---

## 3. Findings vs. Confirmed Threats

To avoid alert fatigue and maintain user trust, the Security Engine strictly distinguishes **suspicious indicators** from **confirmed malicious findings**:

| Signal Type | Example Finding | Severity | Downstream Action Impact |
| :--- | :--- | :--- | :--- |
| **Critical Structural Threat** | Password field submitting to external host or raw IP | Critical | Incurs large score deduction ($-40$ pts); contributes to `WARN` or `BLOCK`. |
| **Suspicious Context** | Insecure HTTP with login form or Punycode homoglyph | High | Incurs $-25$ pts deduction; triggers `WARN` when paired with sensitive inputs. |
| **Contextual Anomaly** | High Shannon entropy, excessive subdomains ($>3$) | Medium | Incurs $-15$ pts deduction; requires additional corroborating signals to alert user. |
| **Weak Heuristic** | URL length $> 100$ characters, uncommon TLD | Low | Incurs $-5$ pts deduction; **never** triggers an alert on its own. |

---

## 4. Pipeline Integration & Codebase Flow

1. **Input:** Receives `PageFeatures` (extracted DOM flags) and parsed URL components from `ScanService`.
2. **Analysis:** Executes `SecurityEngine.analyze()`, evaluating lexical, transport, and structural rules.
3. **Output (`SecurityResult`):**
   * `findings`: List of `Finding` objects containing ID, severity, title, and evidence.
   * `score`: Base structural security score (0–100).
   * `metrics`: Extracted numeric metrics.
4. **Handoff:** Passes `SecurityResult` to `ScoreFusionEngine` to merge with external threat intelligence.
