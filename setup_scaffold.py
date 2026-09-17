import os
import json

base_dir = '.'

def write_file(filepath, content):
    with open(os.path.join(base_dir, filepath), 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')

# Root files
write_file('package.json', '''{
  "name": "site-sentry",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}''')

write_file('.gitignore', '''
node_modules
.next
dist
build
__pycache__/
*.pyc
.env
.venv
venv/
.pytest_cache/
.coverage
''')

write_file('.dockerignore', '''
node_modules
.next
dist
build
__pycache__/
*.pyc
.env
.venv
.git
''')

write_file('.env.example', '''
# API
API_ENV=development
API_HOST=0.0.0.0
API_PORT=8000

# PostgreSQL
POSTGRES_USER=sentry
POSTGRES_PASSWORD=sentry_password
POSTGRES_DB=sitesentry
DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

# Redis
REDIS_URL=redis://redis:6379/0

# Secrets (DO NOT ADD REAL SECRETS HERE)
SECRET_KEY=change_this_in_production
VIRUSTOTAL_API_KEY=mock_key
OPENAI_API_KEY=mock_key
''')

write_file('docker-compose.yml', '''
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-sentry}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-sentry_password}
      POSTGRES_DB: ${POSTGRES_DB:-sitesentry}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-sentry} -d ${POSTGRES_DB:-sitesentry}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./services/api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER:-sentry}:${POSTGRES_PASSWORD:-sentry_password}@postgres:5432/${POSTGRES_DB:-sitesentry}
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  dashboard:
    build:
      context: ./apps/dashboard
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8000
    depends_on:
      - api

volumes:
  postgres_data:
''')

write_file('docker-compose.dev.yml', '''
version: '3.8'

services:
  api:
    build:
      context: ./services/api
    volumes:
      - ./services/api:/app
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

  dashboard:
    build:
      context: ./apps/dashboard
    volumes:
      - ./apps/dashboard:/app
      - /app/node_modules
    command: npm run dev
''')

write_file('Makefile', '''
.PHONY: dev test lint

dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

test:
	pytest services/api/tests

lint:
	cd services/api && ruff check . && black --check . && mypy src
''')

write_file('README.md', '# Site Sentry Platform\n\nMonorepo for Site Sentry Browser Extension, Dashboard, and API.')

# Packages
write_file('packages/shared-types/package.json', '''{
  "name": "@site-sentry/shared-types",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts"
}''')

write_file('packages/shared-types/src/index.ts', 'export * from "./api";\nexport * from "./scores";')
write_file('packages/shared-types/src/api.ts', 'export interface HealthResponse { status: string; service: string; version: string; }')
write_file('packages/shared-types/src/scores.ts', 'export interface Scores { security: number; privacy: number; trust: number; confidence: number; }')

write_file('packages/ui/package.json', '''{
  "name": "@site-sentry/ui",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts"
}''')
write_file('packages/ui/src/index.ts', 'export const UI = "UI components here";')

# Dashboard
write_file('apps/dashboard/package.json', '''{
  "name": "dashboard",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  }
}''')

write_file('apps/dashboard/tsconfig.json', '''{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}''')

write_file('apps/dashboard/next.config.ts', '''import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;''')

write_file('apps/dashboard/src/app/layout.tsx', '''export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}''')

write_file('apps/dashboard/src/app/page.tsx', '''export default function Page() {
  return <h1>Site Sentry Dashboard</h1>
}''')

write_file('apps/dashboard/Dockerfile', '''FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
''')

# Extension
write_file('apps/extension/package.json', '''{
  "name": "extension",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@types/chrome": "^0.0.260",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.2.0"
  }
}''')

write_file('apps/extension/tsconfig.json', '''{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}''')

write_file('apps/extension/tsconfig.node.json', '''{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}''')

write_file('apps/extension/vite.config.ts', '''import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
        background: 'src/background/service-worker.ts',
        content: 'src/content/content-script.ts'
      },
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
})''')

write_file('apps/extension/manifest/manifest.base.json', '''{
  "manifest_version": 3,
  "name": "Site Sentry",
  "version": "0.1.0",
  "description": "Browser security and trust intelligence platform",
  "action": {
    "default_popup": "index.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "permissions": [
    "storage",
    "webNavigation",
    "activeTab"
  ]
}''')

write_file('apps/extension/index.html', '''<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Site Sentry</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup/App.tsx"></script>
  </body>
</html>''')

write_file('apps/extension/src/popup/App.tsx', '''import React from 'react';

function App() {
  return (
    <div>
      <h1>Site Sentry</h1>
    </div>
  );
}

export default App;''')

write_file('apps/extension/src/background/service-worker.ts', '// Service worker entry')
write_file('apps/extension/src/content/content-script.ts', '// Content script entry')

# Mobile placeholder
write_file('apps/mobile/package.json', '''{
  "name": "mobile",
  "version": "0.1.0",
  "private": true
}''')

# Backend
write_file('services/api/pyproject.toml', '''[project]
name = "site-sentry-api"
version = "0.1.0"
description = "Site Sentry Backend API"
authors = [{name = "Site Sentry"}]
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.23.2",
    "pydantic>=2.4.2",
    "pydantic-settings>=2.0.3",
    "sqlalchemy>=2.0.21",
    "asyncpg>=0.28.0",
    "alembic>=1.12.0",
    "redis>=5.0.1",
    "httpx>=0.25.0"
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.2",
    "pytest-asyncio>=0.21.1",
    "black>=23.9.1",
    "isort>=5.12.0",
    "ruff>=0.1.0",
    "mypy>=1.6.0"
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.black]
line-length = 88
target-version = ['py311']

[tool.isort]
profile = "black"

[tool.ruff]
line-length = 88

[tool.mypy]
python_version = "3.11"
strict = true
''')

write_file('services/api/Dockerfile', '''FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml ./
RUN pip install hatchling && pip install .

COPY src/ src/
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
''')

write_file('services/api/src/main.py', '''from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="Site Sentry API", version="0.1.0")

@app.get("/health")
async def health_root() -> dict[str, str]:
    return {"status": "ok", "service": "site-sentry-api", "version": "0.1.0"}

@app.get("/api/v1/health")
async def health_api() -> dict[str, str]:
    return {"status": "ok", "service": "site-sentry-api", "version": "0.1.0"}
''')

print("Scaffolding complete.")
