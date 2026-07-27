# 18 Component Tree

## 1. Overview
This document outlines the React component hierarchy for both the Browser Extension Popup and the Web Dashboard.

## 2. Browser Extension Popup (`apps/extension/src/popup/`)

```text
PopupApp (Root)
│
├── Header
│   ├── Logo
│   └── SettingsMenuTrigger
│
├── MainScoreDisplay
│   ├── OverallTrustGauge (Large Circular Progress)
│   └── RecommendationText (e.g., "Safe to browse")
│
├── ScoreBreakdownGrid
│   ├── MiniGauge (Security)
│   ├── MiniGauge (Privacy)
│   └── MiniGauge (Trust)
│
├── ExplainableFactorsAccordion
│   ├── FactorItem (e.g., "Valid SSL") - Green Check Icon
│   ├── FactorItem (e.g., "3 Trackers") - Yellow Warning Icon
│   └── FactorItem (e.g., "New Domain") - Red Cross Icon
│       └── FactorDetail (Expanded text)
│
└── Footer
    ├── ScanStatus (e.g., "Last scanned 2m ago")
    └── ForceRescanButton
```

## 3. Web Dashboard (`apps/dashboard/src/app/(dashboard)/`)

```text
DashboardLayout
│
├── Sidebar
│   ├── NavigationLinks (Overview, History, Analytics, Settings)
│   └── UserProfileSnippet
│
└── MainContentArea
    │
    ├── Topbar
    │   ├── SearchBar (Search scan history by URL)
    │   └── ThemeToggle (Dark/Light)
    │
    ├── (Route: /overview)
    │   ├── StatsRow
    │   │   ├── StatCard (Total Scans)
    │   │   ├── StatCard (Threats Blocked)
    │   │   └── StatCard (Avg Privacy Score)
    │   ├── RiskTrendChart (Recharts LineChart)
    │   └── RecentScansTable (Top 5)
    │
    ├── (Route: /history)
    │   ├── HistoryDataGrid
    │   │   ├── Filters (Date range, Risk level)
    │   │   ├── TableHeader
    │   │   ├── TableRow (URL, Date, Security Score, Privacy Score)
    │   │   └── PaginationControls
    │
    └── (Route: /settings)
        ├── AccountSettingsForm
        └── ExtensionPreferencesForm (Strict mode, whitelist)
```

## 4. Shared UI Components (`packages/ui/` or `components/ui/`)
Built primarily using `shadcn/ui`.
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`
- `ProgressGauge` (Custom SVG component wrapping Radix primitives)
- `Badge` (For risk labels: Safe/Warning/Danger)
- `Button`, `Input`, `Select`
