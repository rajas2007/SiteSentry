# 22 Deployment & Infrastructure

## 1. Overview
TrustLens AI uses containerization and Infrastructure as Code (IaC) to ensure deployments are repeatable, scalable, and environment-agnostic.

## 2. Environment Architecture
- **Development:** Local Docker Compose stack.
- **Staging:** Hosted environment mimicking production (connected to staging DB and test API keys).
- **Production:** Scalable cloud environment.

## 3. Local Development
Developers can spin up the entire stack using Docker Compose:
```bash
docker-compose up -d
```
This launches:
- PostgreSQL (Port 5432)
- Redis (Port 6379)
- FastAPI Backend (Port 8000)
- Next.js Dashboard (Port 3000)

## 4. Production Hosting Strategy (MVP)
To minimize DevOps overhead during the startup phase, we utilize managed PaaS providers:

### 4.1. Frontend (Dashboard)
- **Provider:** Vercel
- **Deployment:** Automatic deployments from the `main` branch. Vercel handles global CDN, Edge functions, and Next.js SSR seamlessly.

### 4.2. Backend (API & DB)
- **Provider:** Railway or Render
- **Deployment:** Dockerfile deployments linked to GitHub.
- **Database:** Managed PostgreSQL instance (automated backups, point-in-time recovery).
- **Cache:** Managed Redis instance.

## 5. Production Hosting Strategy (Scale)
As user volume grows, the backend will migrate to AWS or GCP using Kubernetes (EKS/GKE).
- **Terraform:** Used to provision VPCs, Load Balancers, RDS, and ElastiCache.
- **Horizontal Pod Autoscaling (HPA):** Scale FastAPI pods based on CPU utilization and Redis queue length.

## 6. Extension Publishing
- **Chrome Web Store:** Automated zipping and uploading via GitHub Actions (using `chrome-webstore-upload-cli`). Manual review usually takes 24-48 hours.
- **Edge Add-ons:** Similar automated pipeline.

## 7. Secrets Management
- All secrets (API keys for VirusTotal, OpenAI, Database URLs) are stored in GitHub Secrets for CI/CD and in the PaaS environment variables (Vercel/Railway) for runtime. Never hardcode secrets.
