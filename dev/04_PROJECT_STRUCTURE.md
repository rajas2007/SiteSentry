# 04 Project Structure

## 1. Monorepo Organization
The TrustLens AI Platform utilizes a monorepo approach to coordinate the development of various client applications and the heavily modularized backend engines.

```text
trustlens-ai/
├── apps/                           # Client applications
│   ├── dashboard/                  # Next.js web dashboard
│   ├── extension/                  # Browser extension (Data Collection Engine client)
│   └── mobile/                     # React Native app (Future)
│
├── services/                       # Backend services and APIs
│   └── api/                        # FastAPI main gateway
│       ├── src/
│       │   ├── core/               # Config, DB, Plugin Manager
│       │   ├── api/                # REST endpoints
│       │   ├── models/             # DB schema models
│       │   └── pipeline/           # The Intelligence Pipeline
│       │       ├── feature_extraction/
│       │       ├── score_fusion/
│       │       ├── trust/
│       │       ├── explainability/
│       │       └── decision/
│       │
│       ├── plugins/                # Pluggable Sub-Engines
│       │   ├── security/           # Security Engine
│       │   ├── privacy/            # Privacy Intelligence Engine
│       │   ├── threat_intel/       # Threat Intelligence Engine
│       │   ├── web3/               # Web3 Engine (Crypto)
│       │   ├── rule/               # Rule Engine
│       │   └── machine_learning/   # Machine Learning Engine
│       │
│       ├── knowledge_base/         # Internal KB interface
│       └── community/              # Community Intelligence modules
│
├── packages/                       # Shared code
│   ├── shared-types/               # DTOs and Schema contracts
│   └── ui/                         # UI Components
│
├── dev/                            # Architecture Source of Truth (THIS FOLDER)
│   ├── decisions/
│   ├── diagrams/
│   ├── research/
│   └── assets/
│
└── infrastructure/                 # Deployments (Docker, K8s, Terraform)
```

## 2. Rationale & Architecture Alignment
- **`services/api/src/pipeline/`:** Contains the structural orchestration of the Analysis Pipeline (Feature Extraction -> Fusion -> Trust -> Explainability -> Decision).
- **`services/api/plugins/`:** Follows the **Plugin Architecture**. By separating the specialized sub-engines into plugins, the platform can easily dynamically load or bypass analysis (e.g., ignoring Web3 checks on non-crypto sites).
- **Separation of Rule & ML:** The `rule` and `machine_learning` directories emphasize the split between deterministic logic and probabilistic inference.

## 3. Related Documents
- [System Architecture](./03_SYSTEM_ARCHITECTURE.md)
- [Plugin Architecture (Conceptual)](./03_SYSTEM_ARCHITECTURE.md#4-plugin-architecture)
