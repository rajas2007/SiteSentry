# 09b. Feature Extraction Engine & Boundaries

* **Product:** Site Sentry
* **Status:** Active Core Specification & Contract Reference
* **Canonical Path:** `dev/09b_FEATURE_EXTRACTION_ENGINE.md`
* **Related Schemas:** `services/api/src/engines/machine_learning/schemas.py`
* **Structural Model Contract:** `services/api/src/engines/machine_learning/MODEL_CONTRACT.md`
* **Privacy Contract:** [31. Data Privacy and Retention Specification](./31_DATA_PRIVACY_AND_RETENTION.md)

---

## 1. Overview & Extraction Boundaries

The Feature Extraction subsystem defines the structural inputs used by Site Sentry's deterministic security engines and offline ML utilities. It establishes clean boundaries between:
1. **Client-Extracted Features:** Lightweight DOM metrics extracted in the browser extension content script.
2. **Backend-Derived Features:** URL, hostname, and protocol features calculated by the backend.
3. **Threat Intelligence Features:** External counters returned by Google Safe Browsing and VirusTotal APIs.

```
┌──────────────────────────────────────────────────────────────┐
│ Browser Extension (Client)                                   │
│ Extracts: DOM counts, boolean flags (has_password, num_forms) │
└──────────────────────────────┬───────────────────────────────┘
                               │ POST /api/v1/analyze
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend API Gateway & URL Normalizer                         │
│ Derives: Hostname entropy, URL length, Punycode, Scheme      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Threat Intelligence Engine                                   │
│ Queries: Google Safe Browsing, VirusTotal Counters           │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Feature Provenance & Ownership

| Feature Group | Originating Component | Extracted Signals | Strict Constraints |
| :--- | :--- | :--- | :--- |
| **Client Structural (DOM)** | Extension Content Script | `has_password_field`, `num_forms`, `num_scripts`, `has_login_form`, `external_form_action`, `external_links_ratio` | **No raw HTML source.** No input values, passwords, keystrokes, or PII. |
| **Backend Structural (URL)** | Backend (`SecurityEngine`) | `url_length`, `hostname_length`, `subdomain_count`, `has_ip_host`, `entropy_score`, `has_punycode` | Normalized directly from target URL string. |
| **Threat Intelligence** | Backend (`ThreatIntelEngine`) | `vt_malicious_count`, `vt_suspicious_count`, `gsb_threat_detected`, `is_blacklisted` | External API queries. Fails safely per [28. Provider Resilience Contract](./28_PROVIDER_RESILIENCE_CONTRACT.md). |
| **Privacy (Secondary)** | Extension & Backend | `tracker_count`, `cookie_count` | Quantitative counts only; no cookie values or session tokens. |

---

## 3. The Canonical 27-Feature Contract (`v1`)

The canonical feature schema defined in `services/api/src/engines/machine_learning/schemas.py` defines 27 features in strict order (`FEATURE_ORDER`):

### Structural Features (Indices 0–19: The `v1_structural` Boundary)
0. `has_https` (bool)
1. `hostname_length` (int)
2. `url_length` (int)
3. `subdomain_count` (int)
4. `has_ip_host` (bool)
5. `has_punycode` (bool)
6. `has_suspicious_tld` (bool)
7. `entropy_score` (float)
8. `has_login_form` (bool)
9. `has_password_field` (bool)
10. `external_form_action` (bool)
11. `has_iframe` (bool)
12. `hidden_element_count` (int)
13. `num_images` (int)
14. `num_links` (int)
15. `num_scripts` (int)
16. `external_links_ratio` (float)
17. `has_eval_or_obfuscation` (bool)
18. `has_credential_input` (bool)
19. `num_forms` (int)

### Threat Intelligence & External Features (Indices 20–26)
20. `gsb_threat_detected` (bool)
21. `vt_malicious_count` (int)
22. `vt_suspicious_count` (int)
23. `vt_harmless_count` (int)
24. `vt_undetected_count` (int)
25. `domain_age_days` (int)
26. `is_blacklisted` (bool)

---

## 4. Feature Isolation Contract: `v1_structural`

Per `services/api/src/engines/machine_learning/MODEL_CONTRACT.md`:
* **Clean Boundary:** Any candidate machine learning model evaluated in the future must train and infer strictly on **features 0–19**.
* **Threat Intel Separation:** Features 20–26 must **never** be included in an ML model input tensor. Including third-party threat counters in an ML classifier creates circular dependencies, masks genuine structural phishing signals, and causes catastrophic failure during provider outages.
* **Deterministic Rules Use Both:** The deterministic `ScoreFusionEngine` combines findings from structural features (0–19) and threat intelligence features (20–26) using explicit rules, deduction caps, and hard overrides.

---

## 5. Unavailable & Restricted Contexts

In environments where DOM inspection is restricted (e.g., PDF viewer, browser internal pages, disabled content scripts):
* Client DOM features default to `None` or safe defaults (`has_password_field = False`, `num_forms = 0`).
* Backend flags the scan as having `partial_data = True`.
* Downstream decision logic evaluates whether threat intelligence alone is sufficient, or yields an `INCONCLUSIVE` verdict per [27. Security Decision Contract](./27_SECURITY_DECISION_CONTRACT.md).
