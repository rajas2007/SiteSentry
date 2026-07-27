# 05 Tech Stack

## 1. Overview
TrustLens AI leverages a modern, robust tech stack designed for performance, scalability, and seamless AI integration.

## 2. Frontend (Dashboard)
- **Framework:** Next.js (App Router)
- **Library:** React
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (Accessible, customizable Radix UI primitives)
- **Data Visualization:** Recharts (for Threat Analytics and Score Trends)
- **State Management:** Zustand or React Context (depending on complexity)
- **Data Fetching:** TanStack Query (React Query)

## 3. Browser Extension
- **Architecture:** Manifest V3 (MV3 standard for Chrome/Edge/Brave)
- **Framework:** React
- **Language:** TypeScript
- **Build Tool:** Vite (Fast bundling for extension specific outputs)
- **Styling:** Tailwind CSS (Scoped to prevent conflicts with host pages)
- **Communication:** MV3 Message Passing (`chrome.runtime.sendMessage`)

## 4. Backend (API & Orchestration)
- **Framework:** FastAPI (High performance, async native, automatic OpenAPI docs)
- **Language:** Python 3.11+
- **ORM:** SQLAlchemy (Async)
- **Data Validation:** Pydantic V2
- **Task Queue (Async/Background):** Celery or RQ (for heavy ML tasks, optional for MVP if FastAPI `BackgroundTasks` suffice)

## 5. Artificial Intelligence & Machine Learning
- **Tabular Models (Phishing/Risk):** XGBoost, Scikit-Learn
- **Data Processing:** Pandas, NumPy
- **Explainability (XAI):** SHAP (SHapley Additive exPlanations) for tabular models.
- **NLP / Policy Analysis:** Integration with OpenAI API (GPT-4o) or Anthropic API (Claude 3) for summarizing privacy policies and extracting intent.

## 6. Database & Caching
- **Primary Database:** PostgreSQL 15+ (Relational data, user profiles, scan history)
- **Caching & Rate Limiting:** Redis (Extremely fast lookups for domain reputation and API rate limiting)

## 7. Infrastructure & DevOps
- **Containerization:** Docker & Docker Compose
- **CI/CD:** GitHub Actions (Automated testing, linting, and deployment)
- **Hosting (Frontend):** Vercel (Optimized for Next.js)
- **Hosting (Backend & DB):** Railway or AWS (ECS/RDS/ElastiCache for production scaling)

## 8. Third-Party Integrations
- **Threat Intelligence Feeds:**
  - Google Safe Browsing API
  - VirusTotal API
  - PhishTank / OpenPhish (Lists)
- **Domain/DNS Intelligence:**
  - WHOIS API (e.g., WHOISXMLAPI)
  - Cloudflare DNS over HTTPS

## 9. Justification of Choices
- **FastAPI + Python:** Python is the undisputed king of ML/AI ecosystems. FastAPI allows us to serve these models natively with high performance without needing a separate Node.js gateway.
- **Next.js + Tailwind:** Rapid development of high-quality, responsive dashboards with excellent SEO and performance out of the box.
- **Manifest V3:** Required for modern extension stores. Enforces better security and performance by utilizing Service Workers instead of persistent background pages.
