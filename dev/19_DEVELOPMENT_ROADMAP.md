# 19 Development Roadmap

## Phase 1: Foundation & MVP (Months 1-2)
**Goal:** Build a functional end-to-end scanning system with a basic extension and API.
- [x] Set up monorepo (`apps/dashboard`, `apps/extension`, `services/api`).
- [x] Establish CI/CD pipelines (GitHub Actions) for linting and basic testing.
- [x] **Backend:** Build FastAPI Gateway, PostgreSQL schema, and Redis caching layer.
- [x] **Security Engine:** Implement basic heuristics (URL length, HTTPS check, DOM password fields).
- [x] **Extension:** Build MV3 background worker, DOM extraction script, and basic Popup UI (hardcoded mock data, then wire to API).
- [ ] Deploy API to Railway/Render and DB to Supabase/RDS.

## Phase 2: Intelligence & Explainability (Months 3-4)
**Goal:** Integrate AI/ML and OSINT feeds to provide real security value and XAI.
- [ ] **Security Engine:** Integrate VirusTotal API and Google Safe Browsing API.
- [ ] **Privacy Engine:** Integrate tracker blocking lists (DuckDuckGo Radar).
- [ ] **AI Engine (ML):** Train an initial XGBoost model on an open-source phishing dataset. Deploy model using FastAPI.
- [ ] **AI Engine (XAI):** Integrate SHAP to extract feature importance and wire it through the Scoring Engine to the UI.
- [ ] **Extension:** Polish the Explainable Factors Accordion UI.

## Phase 3: Privacy Deep Dive & Dashboard (Months 5-6)
**Goal:** Complete the Privacy pillar and launch the user dashboard.
- [ ] **Privacy Engine (NLP):** Integrate OpenAI API to summarize `/privacy-policy` pages asynchronously.
- [ ] **Dashboard:** Build Next.js Web Dashboard. Implement Authentication (NextAuth).
- [ ] **Dashboard:** Build Scan History data table and Analytics charts (Recharts).
- [ ] Synchronize extension state with Dashboard user accounts.

## Phase 4: Scale & Future Scope (Month 7+)
**Goal:** Commercialization, enterprise features, and advanced capabilities.
- [ ] **Enterprise:** Organization-level policies (Admin dashboard to view employee threat trends).
- [ ] **Visual AI:** Implement screenshot capture and OCR/Computer Vision to detect brand impersonation (e.g., fake Microsoft login screens).
- [ ] Release Firefox and Edge specific extension builds.
- [ ] Implement Mobile App MVP.

## References
- [Future Scope](./23_FUTURE_SCOPE.md)
