# Strategic Project Monitoring Platform

A production-ready, Persian (RTL) web platform for monitoring and managing the progress of strategic projects. Project charter and progress data are imported from Excel, stored in PostgreSQL, visualized on an interactive management dashboard, and editable through an admin panel.

> Persian documentation: [README_FA.md](./README_FA.md)

---

## Features

- **Two access levels**: `MANAGER_VIEWER` (read-only) and `PROJECT_EDITOR` (full editor).
- **Secure auth**: JWT with refresh-token rotation, Argon2id hashing, account lockout, HttpOnly/Secure/SameSite cookies, CSRF protection.
- **Management dashboard**: project info cards, overall status gauge, effectiveness indicator, activities table, monthly progress line chart, risks, decisions, grouped bar chart, and an activity timeline.
- **Wallboard mode**: fullscreen monitor view with 60s auto-refresh.
- **Full admin panel**: project general info, indicators, monthly progress (Excel paste + bulk save), activities (weight validation + reorder), risks, decisions, user management, and audit log.
- **Excel import**: preview, validation, SHA-256 hashing, and atomic transactional commit.
- **Excel export**: five Persian sheets with formula-injection protection.
- **Backend-only calculations**: all progress/achievement/status logic lives in `DashboardCalculationService` — never in Excel formulas or the frontend.
- **Jalali dates**: display, date picker, and validation; stored as standard `Date` in PostgreSQL with `Asia/Tehran` timezone.
- **Optimistic concurrency**: prevents lost updates via a `version` field and HTTP 409 responses.
- **Print/PDF**: professional print stylesheet for the dashboard.
- **Security & observability**: Helmet, rate limiting, structured logging, request IDs, audit logging, and real health checks.

---

## Architecture

```
Browser
   │
   ▼
 Nginx  (Reverse Proxy + TLS + Security Headers)
   ├── /        → Next.js Web  (App Router, RTL)
   └── /api     → NestJS API
                    ├── Prisma ORM
                    └── PostgreSQL 18
        /api/docs → Swagger / OpenAPI
```

See [docs/architecture.md](./docs/architecture.md) for details.

**Tech stack**

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), TypeScript strict, Tailwind CSS, React Hook Form, Zod, TanStack Query, TanStack Table, Recharts |
| Backend | NestJS, Prisma, PostgreSQL 18, JWT, Argon2id, Helmet, Swagger |
| Runtime | Node.js 24 LTS, pnpm |
| Deploy | Docker, Docker Compose, Nginx, GitHub Actions, GHCR |

---

## Repository layout

```
project-monitoring-platform/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   ├── contracts/    # Shared enums, Zod schemas, DTOs, date/number utils
│   ├── eslint-config/
│   └── tsconfig/
├── references/       # Source Excel file and reference dashboard image
├── docs/             # source-analysis, architecture, data-mapping
├── infrastructure/   # nginx, entrypoint scripts, backup scripts
├── .github/workflows/  # ci.yml and deploy-production.yml
├── compose.yml
├── compose.production.yml
└── .env.example
```

---

## Prerequisites

- **Node.js 24 LTS** (pinned in `.nvmrc`)
- **pnpm** via Corepack (`corepack enable`)
- **PostgreSQL 18** (local or via Docker)
- (optional) **Docker** and **Docker Compose**

---

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env                 # then set DATABASE_URL and secrets
docker compose up -d postgres        # if using Docker for the DB
pnpm --filter=@ppm/contracts build
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

- Frontend: <http://localhost:3000>
- API: <http://localhost:4000/api/v1>
- Swagger: <http://localhost:4000/api/docs>

---

## Testing

```bash
pnpm lint
pnpm typecheck
pnpm test                                   # unit tests (API + Web)
pnpm --filter=@ppm/api test:integration     # integration tests (needs PostgreSQL)
pnpm build
pnpm test:e2e                               # Playwright (needs the running stack)
```

---

## Docker

```bash
# Development
docker compose up -d --build

# Production (behind Nginx)
docker compose -f compose.production.yml up -d
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full server deployment, [SECURITY.md](./SECURITY.md) for the security model, and [README_FA.md](./README_FA.md) for the complete Persian guide.

---

## License

Internal / proprietary. All rights reserved.
