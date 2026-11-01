# 20. Coding Standards & Engineering Practices

* **Product:** Site Sentry
* **Canonical Path:** `dev/20_CODING_STANDARDS.md`
* **Target Repositories:** `apps/extension`, `apps/dashboard`, `services/api`

---

## 1. Core Engineering Principles

1. **Readability & Predictability:** Code is read and audited far more frequently than written. Deterministic logic must be explicit.
2. **Strict Typing:** All Python code must include explicit type annotations. All frontend/extension code must use strict TypeScript without `any`.
3. **Data Minimization:** Handlers and scripts must never log, process, or persist sensitive user inputs (passwords, payment details, session tokens) per [31. Data Privacy and Retention](./31_DATA_PRIVACY_AND_RETENTION.md).
4. **Isolated Warning Surfaces:** Content scripts must never inject code to mutate page DOM elements or disable inputs per [ADR-005](./decisions/ADR-005-browser-warning-over-dom-tampering.md).

---

## 2. Python Backend Standards (`services/api/`)

* **Style & Formatter:** PEP 8 compliance enforced by `black` (line length 88) and `isort`.
* **Linting & Quality:** `ruff` or `flake8` for static analysis; `bandit` for security linting.
* **Type Safety:** Type hints are mandatory on all functions and methods. Checked via `mypy`.
* **Asynchronous I/O Rules:**
  * Outbound HTTP calls must use asynchronous `httpx.AsyncClient` with bounded timeouts ($< 2.5\text{s}$) and connection pools.
  * Synchronous blocking network calls (e.g., standard `requests` or `urllib`) are strictly prohibited in the async event loop.
* **Schema Validation:** All incoming REST request bodies must be validated using Pydantic v2 schemas (`services/api/src/schemas/`).
* **Database Access:** Database interactions must use SQLAlchemy 2.0 session contexts (`async with AsyncSession(...)` or managed session dependencies).

---

## 3. TypeScript & React Standards (`apps/extension/`, `apps/dashboard/`)

* **Frameworks:** Next.js 14 App Router for dashboard; React with Vite for extension.
* **Typing:** Strict mode enabled (`"strict": true` in `tsconfig.json`). Never use implicit `any`.
* **Component Design:** Functional components with React hooks. Props must be defined using explicit interfaces.
* **DOM Scripting Rules (Content Scripts):**
  * Content scripts must execute read-only DOM feature extraction.
  * DOM mutation (such as disabling `<input type="password">` or rewriting form actions) is strictly forbidden per ADR-005.
* **Extension State Persistence:** Ephemeral service-worker states must be backed by `chrome.storage.local` to survive browser sleep cycles.

---

## 4. Git & Monorepo Workflow

* **Branching Strategy:** GitHub Flow with short-lived feature branches (`feat/description`, `fix/description`).
* **Commit Conventions:** Follow Conventional Commits format (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
* **Secret Protection:** Never commit `.env` files, API keys, or credentials. Repository excludes must be honored (`.git/info/exclude`).
* **Pull Request Requirements:** All CI tests and lints must pass before merging.
