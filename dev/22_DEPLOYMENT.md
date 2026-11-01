# 22. Deployment & Infrastructure Baseline

* **Product:** Site Sentry
* **Infrastructure Style:** Modular Monolith Container Stack (Docker Compose / Managed PaaS)
* **Canonical Path:** `dev/22_DEPLOYMENT.md`
* **Related ADR:** [ADR-003: Retaining FastAPI Modular Monolith Architecture](./decisions/ADR-003-modular-monolith-architecture.md)

---

## 1. Overview & Operational Philosophy

Per project architectural decisions (Section 3.18 and ADR-003), Site Sentry maintains a lean, highly reliable operational baseline. The backend is packaged as a **modular monolith** with managed PostgreSQL and Redis storage.

We explicitly avoid introducing Kubernetes clusters, message queues (Kafka/RabbitMQ), or distributed microservices during current phases. Horizontal scaling is achieved through stateless FastAPI container replicas behind a standard reverse proxy.

---

## 2. Local Development Stack (`docker-compose.yml`)

The complete development environment can be launched with a single command from the repository root:

```bash
docker-compose up -d
```

### Services Launched:
* **FastAPI Backend (`services/api/`):** Port `8000` (auto-reloading, OpenAPI docs at `/docs`).
* **PostgreSQL Database:** Port `5432` (stores `ScanHistory` and `DomainReputation`).
* **Redis Cache:** Port `6379` (scan result caching and rate limiting).
* **Next.js Dashboard (`apps/dashboard/`):** Port `3000` (connected to backend at `http://localhost:8000`).

---

## 3. Production Deployment Architecture

```
┌────────────────────────────────────────────────────────┐
│ Cloudflare / Reverse Proxy (SSL, DDoS Protection, CDN) │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│ Next.js Dashboard Client   │ │ FastAPI Monolith Replicas │
│ (Vercel / Node.js Engine) │ │ (Docker Containers)       │
└───────────────────────────┘ └─────────────┬─────────────┘
                                            │
                             ┌──────────────┴──────────────┐
                             ▼                             ▼
               ┌───────────────────────────┐ ┌───────────────────────────┐
               │ Managed PostgreSQL 15+    │ │ Managed Redis Cluster     │
               │ (Persistent Scan History) │ │ (Cache & Rate Limits)     │
               └───────────────────────────┘ └───────────────────────────┘
```

### 3.1. Frontend Dashboard Deployment
* **Platform:** Vercel or standalone Node.js Docker container.
* **Environment Configuration:** Configured with `NEXT_PUBLIC_API_URL` pointing to the FastAPI backend domain.

### 3.2. Backend Monolith Deployment
* **Platform:** Railway, Render, or cloud container services (AWS ECS / GCP Cloud Run).
* **Scaling:** Horizontal autoscaling based on HTTP request concurrency and CPU utilization.
* **Environment Variables:**
  * `DATABASE_URL`: PostgreSQL connection string.
  * `REDIS_URL`: Redis connection string.
  * `GOOGLE_SAFE_BROWSING_API_KEY`: External GSB API key.
  * `VIRUSTOTAL_API_KEY`: External VirusTotal API key.

---

## 4. Browser Extension Packaging

* **Build Tool:** Vite with multi-target configuration (`vite build`).
* **Output:** Standalone Manifest V3 distribution directory in `apps/extension/dist/`.
* **Testing:** Load as an unpacked extension in Developer Mode on Chrome, Edge, or Brave.
* **Store Publishing:** Zipped bundle uploaded to the Chrome Web Store and Microsoft Edge Add-ons catalogs.
