# 06 Backend Architecture

## 1. Introduction
The TrustLens AI Platform backend is built on Python and FastAPI. It serves as the orchestrator for the entire Analysis Pipeline, managing plugins, caching, and database interactions.

## 2. Core Components

### 2.1. FastAPI Gateway (`services/api/src/api/`)
Handles HTTP requests from the Extension, Dashboard, and Enterprise APIs. Routes requests to the Plugin Manager.

### 2.2. Plugin Manager (`services/api/src/core/`)
The architecture is inherently pluggable. The Plugin Manager determines which Sub-Engines (Plugins) should execute based on the context provided by the Feature Extraction Engine.
- E.g., If the feature vector indicates no crypto elements, the Plugin Manager skips loading the Web3 Engine.

### 2.3. The Intelligence Pipeline (`services/api/src/pipeline/`)
The backend strictly executes engines in sequence:
1. **Feature Extraction Engine**
2. **Sub-Engines** (Security, Privacy, Threat, Web3)
3. **Rule & Machine Learning Engines**
4. **Score Fusion Engine**
5. **Trust Engine**
6. **Explainability Engine**
7. **Decision Engine**

## 3. Threat Intelligence & Concurrency
The most time-consuming part of the pipeline is querying external OSINT feeds via the **Threat Intelligence Engine**.
- The FastAPI gateway uses `asyncio` to execute these external requests concurrently.
- Results are heavily cached in Redis.

## 4. Machine Learning Inference
The **Machine Learning Engine** runs computationally heavy inference (XGBoost, SHAP). To prevent event loop blocking in FastAPI, these operations are offloaded to a thread pool (`run_in_threadpool`) or handled by a separate Celery worker cluster in production.

## 5. Related Documents
- [System Architecture](./03_SYSTEM_ARCHITECTURE.md)
- [Plugin Architecture (System Arch)](./03_SYSTEM_ARCHITECTURE.md#4-plugin-architecture)
