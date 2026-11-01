# 08. Frontend Dashboard Architecture

* **Product:** Site Sentry
* **Framework:** Next.js 14 (App Router) with React 18 & TypeScript
* **Canonical Path:** `dev/08_FRONTEND_ARCHITECTURE.md`

---

## 1. Overview & Current Scope

The Site Sentry Management Dashboard (`apps/dashboard/`) is a web interface allowing users and administrators to review scan histories, examine technical security findings, and monitor threat analytics.

Per project architectural guidelines (Section 3.17), the dashboard retains all existing useful capabilities while strictly avoiding scope creep into speculative enterprise fleet management, complex team RBAC, or unneeded account tiers.

---

## 2. Directory Structure & Route Hierarchy

```text
apps/dashboard/src/
├── app/
│   ├── layout.tsx              # Root layout (Theme, Providers, Shell)
│   ├── page.tsx                # Overview & Metrics summary
│   ├── history/
│   │   ├── page.tsx            # Live scan history table
│   │   └── [id]/page.tsx       # Detailed scan inspection & evidence audit
│   └── analytics/
│       └── page.tsx            # Threat distribution & provider availability metrics
├── components/
│   ├── Navbar.tsx              # Navigation bar & status indicator
│   ├── ScanHistoryTable.tsx    # Paginated scan table with sorting & filtering
│   ├── AnalysisDetails.tsx     # Breakdown of structural findings & provider lookups
│   └── MetricsCards.tsx        # High-level aggregate cards (Total Scans, Blocked Threats)
├── lib/
│   ├── api.ts                  # Fetch client configured for backend REST endpoints
│   └── utils.ts                # Tailwind utility functions
└── tailwind.config.js
```

---

## 3. Real Backend Integration & Data Integrity

Following the Milestone 1B integrity audit, the dashboard connects exclusively to genuine backend endpoints without synthetic mock generators or fabricated fallback records:
* **`GET /api/v1/history`:** Fetches live scan history with pagination and timestamp ordering.
* **`GET /api/v1/history/{analysis_id}`:** Fetches comprehensive scan telemetry, including exact rule findings, Google Safe Browsing and VirusTotal vendor counts, and final decision actions.
* **`GET /api/v1/analytics/overview`:** Fetches real-time aggregated metrics computed directly from PostgreSQL `ScanHistory` and `DomainReputation` tables.

### Empty and Error States
If the backend is unreachable or the database contains zero scans, the dashboard presents honest empty states ("No scan history recorded yet") rather than injecting synthetic demo data.

---

## 4. Design & UX System

* **Styling:** Tailwind CSS with dark-mode native styling.
* **Status Palette:**
  * Emerald / Green: Safe (`ALLOW`)
  * Amber / Yellow: Suspicious / Inconclusive (`WARN`, `INCONCLUSIVE`)
  * Rose / Red: Confirmed Threat (`BLOCK`)
  * Slate / Gray: Offline / Error (`ERROR`)
* **Accessibility:** Semantic HTML tables, ARIA attributes on interactive badges, and full keyboard navigation.
