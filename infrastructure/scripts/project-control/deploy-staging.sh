#!/usr/bin/env bash
# استقرار Staging ایزوله — به Production Container/Volume دست نمی‌زند.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

DRY_RUN=0
EXECUTE=0
has_flag --dry-run "$@" && DRY_RUN=1
has_flag --execute "$@" && EXECUTE=1

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ppm_project_control_staging}"
ENV_FILE="${ROOT_DIR}/.env.staging"
COMPOSE_FILES=(-f compose.production.yml -f compose.staging.yml)

[[ -f "$ENV_FILE" ]] || die ".env.staging یافت نشد. از .env.staging.example کپی کنید."
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

[[ -n "${API_IMAGE:-}" && -n "${WEB_IMAGE:-}" ]] || die "API_IMAGE و WEB_IMAGE لازم است."
[[ "${API_IMAGE}" != *":latest" ]] || die "برای RC از latest استفاده نکنید."
[[ "${WEB_IMAGE}" != *":latest" ]] || die "برای RC از latest استفاده نکنید."

# جلوگیری از نام‌های Production شناخته‌شده
case "${COMPOSE_PROJECT_NAME}" in
  *prod*|ppm) die "COMPOSE_PROJECT_NAME مشکوک به Production است: ${COMPOSE_PROJECT_NAME}" ;;
esac

log "Staging project=${COMPOSE_PROJECT_NAME}"
log "API_IMAGE=${API_IMAGE}"
log "WEB_IMAGE=${WEB_IMAGE}"
log "Compose: ${COMPOSE_FILES[*]}"

if [[ "$DRY_RUN" == "1" ]] || [[ "$EXECUTE" != "1" ]]; then
  log "DRY-RUN / بدون --execute: دستور واقعی اجرا نمی‌شود."
  log "برای اجرا: $0 --execute"
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" config >/dev/null
  log "compose config: OK"
  exit 0
fi

"$ROOT_DIR/infrastructure/scripts/project-control/preflight.sh" || die "Preflight failed"

# اطمینان از وجود Image محلی
docker image inspect "$API_IMAGE" >/dev/null 2>&1 || die "Image API موجود نیست. ابتدا build-images.sh را اجرا کنید."
docker image inspect "$WEB_IMAGE" >/dev/null 2>&1 || die "Image Web موجود نیست. ابتدا build-images.sh را اجرا کنید."

STATE_DIR="${RELEASE_STATE_DIR:-/tmp/ppm-releases/project-control/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$STATE_DIR"
PREV_API="$(docker inspect --format='{{index .Config.Image}}' ppm_pc_staging_api 2>/dev/null || true)"
PREV_WEB="$(docker inspect --format='{{index .Config.Image}}' ppm_pc_staging_web 2>/dev/null || true)"

cat >"${STATE_DIR}/release.env" <<EOF
RELEASE_COMMIT=${GIT_SHA:-${APP_VERSION:-unknown}}
API_IMAGE=${API_IMAGE}
WEB_IMAGE=${WEB_IMAGE}
PREVIOUS_API_IMAGE=${PREV_API}
PREVIOUS_WEB_IMAGE=${PREV_WEB}
MIGRATION_NAME=20260716135226_advanced_project_control
BACKUP_FILE=
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DEPLOYED_BY=${USER:-unknown}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}
EOF
log "Release state: ${STATE_DIR}/release.env (no secrets)"

log "Bringing up Staging stack..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d --remove-orphans

log "Waiting for health..."
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:18080/api/v1/health/readiness" >/dev/null 2>&1; then
    log "Staging readiness OK"
    break
  fi
  if [[ "$i" -eq 40 ]]; then
    docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" logs --tail=80 api || true
    die "Staging readiness timeout"
  fi
  sleep 3
done

# Migration pending check
PENDING="$(docker exec ppm_pc_staging_api node node_modules/prisma/build/index.js migrate status 2>&1 || true)"
echo "$PENDING" | grep -qi 'Database schema is up to date' \
  || echo "$PENDING" | grep -qi 'No pending migrations' \
  || die "Migration هنوز Pending است یا status ناموفق: ${PENDING}"

log "Staging Deploy PASSED — URL http://127.0.0.1:18080"
exit 0
