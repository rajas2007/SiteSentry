# 25. Threat Knowledge Base & Signatures

* **Product:** Site Sentry
* **Status:** Active Simplified Specification (Section 3.16)
* **Canonical Path:** `dev/25_KNOWLEDGE_BASE.md`
* **Storage Baseline:** PostgreSQL 15+ & In-Memory YAML Configurations
* **Related Engines:** `RuleEngine`, `SecurityEngine`, `ThreatIntelligenceEngine`

---

## 1. Overview & Baseline Storage

The **Knowledge Base** defines the structured threat signatures, deterministic heuristic rules, and educational metadata utilized by Site Sentry.

Per Section 3.16 of the architectural guidelines, **we avoid adding complex document stores (MongoDB, Elasticsearch)** or distributed document databases. The operational baseline is strictly supported by:
1. **In-Memory Versioned YAML Configurations:** Deterministic rule definitions loaded at application startup by `RuleEngine` (`services/api/src/engines/rules/`).
2. **PostgreSQL Relational Tables:** Structured domain reputation and audit histories (`DomainReputation`, `ScanHistory`).
3. **Redis Key-Value Cache:** Fast in-memory cache for recent threat provider verdicts.

---

## 2. Segregation of Evidence by Trust Level

To prevent data contamination and false-positive poisoning, the Knowledge Base strictly maintains separate data stores based on trust level:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: Authoritative Threat Feeds                              │
│ (Google Safe Browsing, VirusTotal) - High Trust, Fast Cache     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────┐
│ Tier 2: Deterministic Structural Rules                          │
│ (YAML Rule Sets in services/api/src/engines/rules/)             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────┐
│ Tier 3: Historical Domain Telemetry                             │
│ (PostgreSQL DomainReputation records)                           │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────┐
│ Tier 4: Unverified User Reports                                 │
│ (Deferred from live scoring; analyst telemetry only)            │
└─────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Data Integrity Axiom:** Data from different trust levels must **never** be merged into a single undifferentiated reputation score. An unverified community report can never downgrade a site's baseline, and a clean structural score can never erase an authoritative threat intelligence match.

---

## 3. Structural Rule Definitions

Deterministic rules are maintained as version-controlled configurations within `services/api/src/engines/rules/rules.yaml`.

```yaml
rules:
  - id: "SEC-EXT-FORM-001"
    name: "External Credential Submission"
    category: "credential_harvesting"
    severity: "critical"
    deduction: 40.0
    conditions:
      has_password_field: true
      external_form_action: true
    description: "The webpage presents a password input that submits to a third-party domain."

  - id: "SEC-IP-HOST-001"
    name: "Raw IP Hostname"
    category: "infrastructure"
    severity: "high"
    deduction: 30.0
    conditions:
      has_ip_host: true
    description: "The website is hosted directly on a raw IP address without a domain name."
```

---

## 4. Maintenance & Governance

* Rule definitions are versioned directly in Git alongside the backend codebase.
* Changes to rules require pull-request reviews and regression testing against the test suite (`pytest`) before deployment.
* Rules are tested for false positives against top benign domains during Phase 3 detection evaluation per [29. Detection Evaluation Plan](./29_DETECTION_EVALUATION_PLAN.md).
