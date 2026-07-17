# Production Deploy — Advanced Project Control

## پیش‌شرط Go

قبل از Production همه موارد زیر باید سبز باشند:

1. Staging Deploy
2. Migration Review PASS
3. Disposable + Upgrade Path migrate
4. Import Fixture Manifest Exact Match
5. Smoke Test
6. E2E
7. Screenshots
8. Backup/Restore Staging
9. Rollback Dry-Run

## دستور Production (واقعی همین پروژه)

```bash
# روی سرور، در مسیر Deploy
export API_IMAGE=ghcr.io/samanmah/mstiddashbord-api:project-control-f39c712
export WEB_IMAGE=ghcr.io/samanmah/mstiddashbord-web:project-control-f39c712
export APP_VERSION=f39c712c8355b53960d3813ee5107e3853abe7a
export GIT_SHA=f39c712c8355b53960d3813ee5107e3853abe7a
export COOKIE_SECURE=true
export NODE_ENV=production
export RUN_SEED_ON_START=false

# Backup اجباری
./infrastructure/backup/backup-postgres.sh

docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d

# Health
curl -fsS https://$APP_DOMAIN/api/v1/health/readiness
curl -fsS https://$APP_DOMAIN/api/v1/health/liveness
```

یا از اسکریپت (پیش‌فرض DRY-RUN):

```bash
./infrastructure/scripts/project-control/deploy-production.sh --dry-run --commit f39c712c8355b53960d3813ee5107e3853abe7a
# فقط پس از تأیید انسانی:
./infrastructure/scripts/project-control/deploy-production.sh --execute --commit f39c712c8355b53960d3813ee5107e3853abe7a
```

## ممنوع

- `docker compose down -v`
- حذف Volume Production
- `latest` برای Release Candidate
- تضعیف `COOKIE_SECURE` در `compose.production.yml`
- Merge خودکار PR / Push به main از این مرحله
- اجرای Seed روی Production مگر با تأیید جداگانه

## Release State

پس از Deploy، فایل خارج Git:

`/opt/ppm/releases/project-control/<timestamp>/release.env`

شامل Imageها، Commit، Backup path، Previous images — بدون Secret.
