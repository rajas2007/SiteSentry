# 20 Coding Standards

## 1. General Principles
- **Readability first:** Code is read 10x more often than it is written.
- **Type Safety:** Use TypeScript strictly in the frontend/extension. Use Type Hints strictly in Python.
- **Modularity:** High cohesion, low coupling. Functions should do one thing well.

## 2. Python (Backend)
- **Style Guide:** Follow [PEP 8](https://peps.python.org/pep-0008/).
- **Formatter:** Use `black` (line length 88) and `isort` for import sorting.
- **Linter:** Use `ruff` or `flake8`.
- **Type Checking:** Use `mypy`. All function signatures MUST have type hints.
  ```python
  # Good
  async def analyze_domain(domain: str, strict_mode: bool = False) -> float: ...
  
  # Bad
  async def analyze_domain(domain, strict_mode=False): ...
  ```
- **Docstrings:** Use Google-style docstrings for all classes and complex functions.
- **Async:** Never use blocking I/O calls (e.g., standard `requests` library) inside an `async def` route without offloading to a thread pool. Use `httpx` for async HTTP requests.

## 3. TypeScript & React (Frontend & Extension)
- **Style Guide:** Follow standard ESLint rules (e.g., `eslint-config-next` and `@typescript-eslint/recommended`).
- **Formatter:** Use `Prettier`.
- **Components:** Use functional components and hooks. No class components.
- **Props:** Define explicit Interfaces or Types for all component props.
  ```tsx
  // Good
  interface ScoreGaugeProps {
    score: number;
    label: string;
  }
  const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, label }) => { ... }
  ```
- **State:** Avoid complex nested state in `useState`. Use `useReducer` or Zustand for complex local/global state.

## 4. Git Workflow
- **Branching:** Use Trunk-Based Development or GitHub Flow.
  - `main` is always deployable.
  - Feature branches: `feat/issue-number-short-desc` (e.g., `feat/12-add-vt-integration`)
  - Bug fixes: `fix/issue-number-short-desc`
- **Commits:** Follow Conventional Commits format.
  - `feat: integrate VirusTotal API`
  - `fix: resolve crash on null DOM context`
  - `docs: update system architecture diagram`
- **PRs:** Require at least 1 approval, passing CI (tests + linting) before merge. Rebase and squash on merge to keep history clean.

## 5. Security Standards
- Never commit secrets, API keys, or `.env` files. Use GitHub Secrets for CI and environment variables in production.
- Use `bandit` for Python security linting.
- Always validate incoming API data using Pydantic. Do not trust extension payloads blindly.
