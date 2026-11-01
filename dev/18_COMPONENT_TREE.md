# 18. UI Component Tree

* **Product:** Site Sentry
* **Canonical Path:** `dev/18_COMPONENT_TREE.md`
* **Target Clients:** Browser Extension (`apps/extension`), Web Dashboard (`apps/dashboard`)

---

## 1. Browser Extension Component Hierarchy (`apps/extension/`)

### 1.1. Extension Popup (`src/popup/`)
```text
PopupApp (Root)
│
├── PopupHeader
│   ├── SiteSentryBrand (Logo & Version)
│   └── CurrentDomainBadge (eTLD+1)
│
├── ScoreOverviewCard
│   ├── SecurityScoreGauge (Circular SVG 0–100)
│   ├── DecisionBadge (allow = Emerald, warn = Amber, block = Rose, offline = Slate)
│   └── VerdictSummaryText (e.g., "Verified Safe", "Phishing Threat Blocked")
│
├── ProviderStatusCard
│   ├── ProviderIndicator (Google Safe Browsing: Clean / Threat / Unavailable)
│   └── ProviderIndicator (VirusTotal: Clean / Malicious Count / Unavailable)
│
├── FindingsAccordion
│   ├── FindingItem (Severity Badge, Finding Title)
│   │   └── FindingEvidenceDrawer (Observed DOM signal, external action URL)
│   └── EmptyFindingsState ("No suspicious indicators detected")
│
└── PopupFooter
    ├── RescanButton (Triggers rescan; cache-bypass force_refresh proposed for future review)
    └── DashboardLink ("Open Full Scan History")
```

### 1.2. Full-Tab Warning Interstitial (`pages/warning.html`)
```text
WarningInterstitialPage (Root - chrome-extension:// origin)
│
├── WarningContainer
│   ├── AlertIcon (Critical Red Shield)
│   ├── Headline ("Deceptive or Malicious Site Blocked")
│   ├── TargetDomainCard (Blocked URL, IP/Domain)
│   │
│   ├── ThreatEvidenceSummary
│   │   ├── ThreatFeedIndicator (e.g., "Flagged by Google Safe Browsing as Phishing")
│   │   └── StructuralFindingsList (e.g., "Form posts password to external untrusted host")
│   │
│   ├── PrimaryActionArea
│   │   └── ReturnToSafetyButton ("Take Me Back to Safety" - Primary CTA)
│   │
│   └── AdvancedCollapsible
│       ├── TechnicalTelemetryDetails (JSON payload view)
│       └── TemporaryBypassButton ("Proceed with risk (Not Recommended)")
```

---

## 2. Web Management Dashboard Component Hierarchy (`apps/dashboard/`)

```text
RootLayout (app/layout.tsx)
│
├── Navbar
│   ├── BrandLogo ("Site Sentry")
│   ├── NavigationLinks (/overview, /history, /analytics)
│   └── HealthStatusIndicator (Backend API Connectivity)
│
└── MainContentArea
    │
    ├── Route: Overview (/app/page.tsx)
    │   ├── MetricsCards (Total Scans, Threats Blocked, Clean Scans, Inconclusive)
    │   └── RecentScansPreviewTable
    │
    ├── Route: Scan History (/app/history/page.tsx)
    │   ├── HistoryFilterToolbar (Search by URL, Filter by Action: ALLOW/WARN/BLOCK)
    │   ├── ScanHistoryTable
    │   │   ├── TableHeader (URL, Domain, Score, Severity, Action, Date)
    │   │   ├── TableRow (Clickable -> opens /history/[id])
    │   │   └── EmptyHistoryState (Honest empty state, no synthetic mocks)
    │   └── PaginationControls (Prev / Next page)
    │
    ├── Route: Scan Detail Inspection (/app/history/[id]/page.tsx)
    │   ├── ScanHeader (Target URL, Final Action, Timestamp)
    │   ├── ScoreBreakdownCard (Base Score, VT Deductions, Structural Deductions)
    │   ├── ThreatIntelDetails (GSB match details, VirusTotal vendor counts)
    │   ├── SecurityFindingsAccordion (Itemized lexical and DOM findings)
    │   └── PrivacyMetricsCard (Tracker domain count, cookie volume)
    │
    └── Route: Analytics (/app/analytics/page.tsx)
        ├── ThreatDistributionSummary
        ├── ProviderAvailabilityMetrics (GSB & VT uptime/failure rates)
        └── FrequentThreatDomainsList
```
