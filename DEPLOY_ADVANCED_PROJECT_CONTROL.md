# Deploy Guide — Advanced Project Control

این راهنما مخصوص همین Repository است و با فایل‌های واقعی Compose هم‌خوان است.

## فایل‌های Compose واقعی

| فایل | نقش |
|------|-----|
| `compose.yml` | توسعه محلی (build از Dockerfile) |
| `compose.production.yml` | پایه Production |
| `compose.staging.yml` | Override ایزوله Staging |

**استفاده نکنید:** `docker compose -f docker-compose.yml up -d --build`  
(فایل `docker-compose.yml` در این پروژه وجود ندارد.)

## Image Tagهای Release Candidate

```
ghcr.io/samanmah/mstiddashbord-api:project-control-f39c712
ghcr.io/samanmah/mstiddashbord-web:project-control-f39c712
```

Commit مرجع Feature کامل: `f39c712c8355b53960d3813ee5107e3853abe7a`  
(پس از Commit Release Engineering، SHA جدید را جایگزین کنید.)

## مسیر سریع Staging

```bash
git checkout feature/advanced-project-control-wbs-gantt
cp .env.staging.example .env.staging   # Secret واقعی را لوکال بگذارید

./infrastructure/scripts/project-control/preflight.sh
./infrastructure/scripts/project-control/build-images.sh
./infrastructure/scripts/project-control/deploy-staging.sh --execute
./infrastructure/scripts/project-control/import-fixture.sh
./infrastructure/scripts/project-control/smoke-test.sh
./infrastructure/scripts/project-control/run-e2e.sh
./infrastructure/scripts/project-control/capture-screenshots.sh
./infrastructure/scripts/project-control/backup-restore-test.sh --execute
```

Staging URL: **http://127.0.0.1:18080**

## Production (فقط پس از Go)

نگاه کنید: `docs/project-control/release/production.md`

```bash
./infrastructure/scripts/project-control/deploy-production.sh --dry-run
# پس از تأیید انسانی:
./infrastructure/scripts/project-control/deploy-production.sh --execute --commit <FULL_SHA>
```

```bash
export API_IMAGE=ghcr.io/samanmah/mstiddashbord-api:project-control-<sha7>
export WEB_IMAGE=ghcr.io/samanmah/mstiddashbord-web:project-control-<sha7>
export COOKIE_SECURE=true
export NODE_ENV=production
export RUN_SEED_ON_START=false

./infrastructure/backup/backup-postgres.sh
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d
curl -fsS https://$APP_DOMAIN/api/v1/health/readiness
```

## Rollback Production

```bash
./infrastructure/scripts/project-control/rollback.sh --production --dry-run
./infrastructure/scripts/project-control/rollback.sh --production --execute
```

جزئیات: `docs/project-control/release/rollback.md`

## اصلاحات Deployment داخل این Branch

- pnpm 11: `allowBuilds` در `pnpm-workspace.yaml`
- API Dockerfile: openssl، `pnpm deploy --prod --legacy`، بدون کپی دستی `.prisma`
- Seed/CLI Runtime: JS کامپایل‌شده (`dist/seed/run-seed.js` و CLIهای dist) — بدون ts-node
- PostgreSQL 18 volume: `/var/lib/postgresql`
- `COOKIE_SECURE` از Environment (Production پیش‌فرض true)
- Entrypoint: migrate failure → no start؛ Seed failure دیگر مخفی نمی‌شود
- Health liveness: `version` / `gitSha` / `buildDate`

## مستندات مرتبط

- `docs/project-control/release/staging.md`
- `docs/project-control/release/production.md`
- `docs/project-control/release/rollback.md`
- `docs/project-control/release/migration-review.md`
- `docs/project-control/release/e2e-report.md`
- `docs/project-control/release/smoke-test.md`
- `docs/project-control/release/known-limitations.md`
