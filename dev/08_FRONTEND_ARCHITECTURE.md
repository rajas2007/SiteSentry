# 08 Frontend Architecture

## 1. Overview
The Frontend Architecture refers to the TrustLens Web Dashboard, a standalone web application where users can view their scan history, threat analytics, manage account settings, and view aggregated trends. 

## 2. Framework & Libraries
- **Core Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (Radix UI)
- **Data Fetching:** TanStack Query (React Query)
- **State Management:** Zustand (for global UI state like sidebar toggles, theme)
- **Authentication:** NextAuth.js or generic JWT handling with the FastAPI backend.

## 3. Directory Structure (App Router)

```text
apps/dashboard/src/
├── app/
│   ├── (auth)/                 # Grouped auth routes
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/            # Grouped dashboard routes (requires auth)
│   │   ├── layout.tsx          # Main sidebar & header layout
│   │   ├── page.tsx            # Overview / Home
│   │   ├── history/page.tsx    # Scan history table
│   │   ├── analytics/page.tsx  # Charts and graphs
│   │   └── settings/page.tsx   # User preferences
│   ├── globals.css             # Tailwind imports
│   └── layout.tsx              # Root layout (Providers)
├── components/
│   ├── ui/                     # shadcn components (buttons, inputs, cards)
│   ├── charts/                 # Recharts wrapper components
│   └── layout/                 # Sidebar, Header, UserNav
├── lib/
│   ├── api.ts                  # Axios/fetch configuration interceptors
│   ├── utils.ts                # Tailwind merge utils (cn)
│   └── hooks/                  # Custom React hooks (e.g., useUser)
└── store/
    └── ui-store.ts             # Zustand store
```

## 4. Key Design Patterns

### 4.1. Server Components vs Client Components
Next.js App Router uses Server Components by default.
- **Server Components:** Used for fetching initial page data (if SEO/speed requires it) and rendering static layouts (Sidebars, Headers).
- **Client Components (`"use client"`):** Used for interactive elements (Buttons, Forms, Charts, Data Tables with sorting/filtering).

### 4.2. API Integration
The dashboard communicates directly with the FastAPI backend.
- We use an Axios instance configured in `lib/api.ts` to automatically attach JWT authorization headers.
- **TanStack Query** is used in Client Components for fetching, caching, and updating asynchronous data (e.g., the scan history table). This handles loading states, error states, and pagination elegantly.

### 4.3. UI / UX Approach
- **Design System:** We rely heavily on Tailwind CSS and `shadcn/ui` to build a clean, modern, dark-mode native interface.
- **Visuals:** Use vibrant colors for statuses (Emerald for Safe, Amber for Warning, Rose for Danger) against a sleek dark/light theme background.
- **Data Visualization:** Use Recharts to display trend lines of threats blocked over time, and pie charts showing the breakdown of tracker types encountered.

## 5. Security & Authentication
- The dashboard is protected via JWT tokens.
- Routes under `(dashboard)` verify authentication state via middleware or higher-order components.
- Ensure XSS protection by utilizing React's native escaping and sanitizing any raw HTML (if applicable, though we should avoid `dangerouslySetInnerHTML`).

## 6. Related Documents
- [System Architecture](./03_SYSTEM_ARCHITECTURE.md)
- [UI/UX Guidelines](./17_UI_UX_GUIDELINES.md)
- [Component Tree](./18_COMPONENT_TREE.md)
