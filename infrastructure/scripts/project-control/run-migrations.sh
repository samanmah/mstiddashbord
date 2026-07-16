#!/usr/bin/env bash
# اجرای migrate deploy روی Staging (یا کانتینر Disposable) — هرگز به Production وصل نشود.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

DRY_RUN=0
MODE="staging"
has_flag --dry-run "$@" && DRY_RUN=1
has_flag --disposable "$@" && MODE="disposable"

log "Migration mode=${MODE}"

if [[ "$MODE" == "disposable" ]]; then
  # تست Disposable PostgreSQL 18
  NAME="ppm_pc_migtest_$$"
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would start postgres:18-alpine as ${NAME}, migrate deploy, validate, tear down"
    exit 0
  fi
  require_cmd docker
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" \
    -e POSTGRES_USER=ppm_mig \
    -e POSTGRES_PASSWORD=ppm_mig_pass \
    -e POSTGRES_DB=ppm_mig \
    -p 127.0.0.1:55432:5432 \
    postgres:18-alpine >/dev/null
  for i in $(seq 1 30); do
    docker exec "$NAME" pg_isready -U ppm_mig -d ppm_mig >/dev/null 2>&1 && break
    sleep 1
  done
  export DATABASE_URL="postgresql://ppm_mig:ppm_mig_pass@127.0.0.1:55432/ppm_mig?schema=public"
  pnpm --filter @ppm/api exec prisma migrate deploy
  pnpm --filter @ppm/api exec prisma validate
  docker rm -f "$NAME" >/dev/null
  log "Disposable migrate PASSED"
  exit 0
fi

# Staging container
[[ "$DRY_RUN" == "1" ]] && { log "DRY-RUN: docker exec ppm_pc_staging_api prisma migrate deploy"; exit 0; }
docker exec ppm_pc_staging_api node node_modules/prisma/build/index.js migrate deploy
docker exec ppm_pc_staging_api node node_modules/prisma/build/index.js migrate status
log "Staging migrate PASSED"
exit 0
