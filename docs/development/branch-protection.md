# Branch Protection Rules

To maintain the integrity of the Site Sentry monorepo and ensure a high level of code quality, the `main` branch must be protected.

The repository requires the following branch protection configurations to be manually applied via the GitHub Repository Settings.

## Rules for `main`

- **Require a pull request before merging:**
  - All changes to the main branch must go through a Pull Request.
  - Require approvals: **1 approval** minimum.
- **Require status checks to pass before merging:**
  - Branch must be up to date with `main` before merging.
  - Require checks that are guaranteed to run for the relevant PR (avoid requiring checks that can remain permanently pending because a workflow was skipped via path filtering):
    - `Validate Repository Structure` (Repository CI)
    - `Backend Lint, Typecheck, and Test` (Backend CI)
    - `Dashboard Lint, Typecheck, Test, and Build` (Dashboard CI)
    - `Extension Lint, Typecheck, Test, and Build` (Extension CI)
- **Do not allow bypassing the above settings:**
  - Even administrators must submit Pull Requests and pass CI.
- **Restrict pushes:**
  - Direct pushes to `main` are disabled.
- **Block force pushes:**
  - Force pushing to `main` is completely prohibited.

*These rules guarantee that the CI pipeline acts as an automated quality gate, enforcing strict formatting, typing, and testing checks before any code reaches production.*
