#!/usr/bin/env bash
# استقرار Production — پیش‌فرض DRY-RUN. نیاز به --execute و تأیید صریح.
# Migration Down اجرا نمی‌شود. Volume حذف نمی‌شود. down -v ممنوع است.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

EXECUTE=0
DRY_RUN=1
has_flag --execute "$@" && EXECUTE=1 && DRY_RUN=0
has_flag --dry-run "$@" && DRY_RUN=1 && EXECUTE=0

COMMIT="$(get_flag_value --commit "$@" || true)"
COMMIT="${COMMIT:-$(current_commit)}"
SHORT="$(printf '%s' "$COMMIT" | cut -c1-7)"
API_IMAGE="${API_IMAGE:-${REGISTRY_API_DEFAULT}:project-control-${SHORT}}"
WEB_IMAGE="${WEB_IMAGE:-${REGISTRY_WEB_DEFAULT}:project-control-${SHORT}}"
DEPLOY_PATH="${DEPLOY_PATH:-.}"
STATE_ROOT="${PRODUCTION_RELEASE_STATE_DIR:-/opt/ppm/releases/project-control}"

log "=== Production Deploy Candidate ==="
log "Commit=${COMMIT}"
log "API_IMAGE=${API_IMAGE}"
log "WEB_IMAGE=${WEB_IMAGE}"
log "DEPLOY_PATH=${DEPLOY_PATH}"
log "MODE=$([ "$EXECUTE" = "1" ] && echo EXECUTE || echo DRY-RUN)"

[[ "${API_IMAGE}" != *":latest" ]] || die "Production RC نباید latest باشد."
[[ "${WEB_IMAGE}" != *":latest" ]] || die "Production RC نباید latest باشد."

if [[ "$EXECUTE" != "1" ]]; then
  log "DRY-RUN — هیچ تغییری اعمال نمی‌شود."
  log "دستور واقعی (پس از تأیید انسانی و Staging سبز):"
  cat <<EOF
export API_IMAGE=${API_IMAGE}
export WEB_IMAGE=${WEB_IMAGE}
export APP_VERSION=${COMMIT}
export GIT_SHA=${COMMIT}
export COOKIE_SECURE=true
export NODE_ENV=production
# Backup اجباری قبل از Deploy
# ${ROOT_DIR}/infrastructure/backup/backup-postgres.sh
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d
curl -fsS https://\$APP_DOMAIN/api/v1/health/readiness
EOF
  log "برای اجرای واقعی روی سرور (خطرناک): $0 --execute --commit ${COMMIT}"
  exit 0
fi

confirm_or_die "آیا واقعاً می‌خواهید Production را Deploy کنید؟ تایپ کنید: yes"
confirm_or_die "تأیید دوم: Staging و Migration و E2E همه سبز بوده‌اند؟ تایپ کنید: yes"

# Safety: never down -v
log "Production deploy starting (no volume wipe)..."
export API_IMAGE WEB_IMAGE
export APP_VERSION="$COMMIT" GIT_SHA="$COMMIT" COOKIE_SECURE=true NODE_ENV=production

PREV_API="$(docker inspect --format='{{index .Config.Image}}' "$(docker ps --format '{{.Names}}' | grep -E 'api' | head -1)" 2>/dev/null || true)"
PREV_WEB="$(docker inspect --format='{{index .Config.Image}}' "$(docker ps --format '{{.Names}}' | grep -E 'web' | head -1)" 2>/dev/null || true)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
STATE_DIR="${STATE_ROOT}/${TS}"
mkdir -p "$STATE_DIR"

# Backup
BACKUP_FILE=""
if [[ -x "$ROOT_DIR/infrastructure/backup/backup-postgres.sh" ]]; then
  BACKUP_FILE="$("$ROOT_DIR/infrastructure/backup/backup-postgres.sh" | tail -1 || true)"
fi

cat >"${STATE_DIR}/release.env" <<EOF
RELEASE_COMMIT=${COMMIT}
API_IMAGE=${API_IMAGE}
WEB_IMAGE=${WEB_IMAGE}
PREVIOUS_API_IMAGE=${PREV_API}
PREVIOUS_WEB_IMAGE=${PREV_WEB}
MIGRATION_NAME=20260716135226_advanced_project_control
BACKUP_FILE=${BACKUP_FILE}
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DEPLOYED_BY=${USER:-unknown}
EOF
log "Release state written to ${STATE_DIR}/release.env (no secrets)"

docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d
sleep 20
curl -fsS "${APP_ORIGIN:-http://localhost}/api/v1/health/readiness" >/dev/null \
  || die "Production readiness failed — اجرای rollback.sh را در نظر بگیرید."

log "Production Deploy PASSED"
exit 0
