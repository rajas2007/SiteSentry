# 21 Testing Strategy

## 1. Overview
A cybersecurity platform must itself be highly reliable. TrustLens AI employs a comprehensive testing strategy covering unit, integration, and end-to-end (E2E) testing.

## 2. Backend Testing (Python/FastAPI)
- **Framework:** `pytest`
- **Coverage:** Minimum 85% line coverage required.
- **Unit Tests:**
  - Mock all external API calls (VirusTotal, WHOIS, LLM).
  - Test individual analyzers (e.g., ensure `DomainAgeAnalyzer` correctly flags a 2-day old domain).
  - Test the Scoring Engine logic heavily (edge cases where scores drop below 0).
- **Integration Tests:**
  - Test FastAPI endpoints using `TestClient`.
  - Spin up a test PostgreSQL database (via Docker or in-memory SQLite if compatible) to test SQLAlchemy models and migrations.

## 3. Frontend & Extension Testing (TypeScript/React)
- **Framework:** `Vitest` (Unit/Component), `Playwright` (E2E).
- **Unit Tests:**
  - Test React components in isolation using `@testing-library/react`.
  - Test Zustand/Context state transitions.
- **E2E Extension Tests (Playwright):**
  - Load the unpacked extension into a headless Chromium instance.
  - Navigate to a known test page (e.g., a local HTML file with a hidden password form).
  - Assert that the extension badge turns red and the popup displays the correct warning.

## 4. ML Model Testing
- **Validation:** Standard Train/Test splits and Cross-Validation during training.
- **Drift Detection:** In production, periodically run the model against a holdout set of new, verified URLs to ensure accuracy hasn't degraded over time (Data Drift).
- **Explainability Tests:** Assert that SHAP values for synthetically obvious phishing features (like `is_known_blacklist=1`) are consistently high.

## 5. CI/CD Integration
- All tests run automatically on GitHub Actions on every Pull Request.
- PRs cannot be merged unless all tests pass.
- Linting (`ruff`, `eslint`) and formatting (`black`, `prettier`) checks are also mandatory.
