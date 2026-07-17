# Staging — Advanced Project Control

## هدف

محیط ایزوله برای Validation قبل از Production:

- Volume / DB / Network / Ports مستقل
- فقط روی localhost منتشر می‌شود
- به Production Network وصل نمی‌شود

## URL

- App: `http://127.0.0.1:18080`
- HTTPS (اختیاری): `https://127.0.0.1:18443`
- Postgres host-only: `127.0.0.1:15432`

## آماده‌سازی

```bash
cp .env.staging.example .env.staging
# مقادیر Placeholder را با Secret تصادفی جایگزین کنید (Commit نکنید)

./infrastructure/scripts/project-control/preflight.sh
./infrastructure/scripts/project-control/build-images.sh
./infrastructure/scripts/project-control/deploy-staging.sh --execute
```

Compose واقعی:

```bash
export COMPOSE_PROJECT_NAME=ppm_project_control_staging
docker compose \
  -f compose.production.yml \
  -f compose.staging.yml \
  --env-file .env.staging \
  up -d
```

**از این دستور استفاده نکنید:** `docker compose -f docker-compose.yml up -d --build`

## Pipeline Validation

```bash
./infrastructure/scripts/project-control/run-migrations.sh
./infrastructure/scripts/project-control/import-fixture.sh
./infrastructure/scripts/project-control/smoke-test.sh
./infrastructure/scripts/project-control/run-e2e.sh
./infrastructure/scripts/project-control/capture-screenshots.sh
./infrastructure/scripts/project-control/backup-restore-test.sh --execute
./infrastructure/scripts/project-control/rollback.sh --staging --dry-run
```

## قواعد امنیتی Staging

- `COOKIE_SECURE=false` فقط در Override Staging
- `NODE_ENV=development` فقط در Override Staging
- `compose.production.yml` تضعیف نمی‌شود (پیش‌فرض `COOKIE_SECURE=true`)
- Imageها Commit-based هستند (`project-control-<sha7>`) — نه `latest`
