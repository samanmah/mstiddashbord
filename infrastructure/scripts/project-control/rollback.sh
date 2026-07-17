#!/usr/bin/env bash
# Rollback واقعی: API + Web + Environment + Compose configuration قبلی.
# پیش‌فرض: بدون Migration Down و بدون Restore DB.
# Restore DB فقط با --restore-db --execute و تأیید مضاعف.
# ممنوع: docker image prune، حذف Backup، down -v.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

EXECUTE=0
RESTORE_DB=0
TARGET="staging"
has_flag --execute "$@" && EXECUTE=1
has_flag --restore-db "$@" && RESTORE_DB=1
has_flag --production "$@" && TARGET="production"
has_flag --staging "$@" && TARGET="staging"
DRY_RUN=1
[[ "$EXECUTE" == "1" ]] && DRY_RUN=0

STATE_FILE="$(get_flag_value --state "$@" || true)"
if [[ -z "${STATE_FILE:-}" ]]; then
  if [[ "$TARGET" == "staging" ]]; then
    STATE_FILE="$(ls -1dt /tmp/ppm-releases/project-control/*/release.env 2>/dev/null | head -1 || true)"
  else
    STATE_FILE="$(ls -1dt /opt/ppm/releases/project-control/*/release.env 2>/dev/null | head -1 || true)"
  fi
fi
[[ -n "${STATE_FILE:-}" && -f "$STATE_FILE" ]] || die "release.env یافت نشد. با --state <path> مشخص کنید."

# shellcheck disable=SC1090
source "$STATE_FILE"
log "Rollback target=${TARGET}"
log "State=${STATE_FILE}"
log "PREVIOUS_API_IMAGE=${PREVIOUS_API_IMAGE:-}"
log "PREVIOUS_WEB_IMAGE=${PREVIOUS_WEB_IMAGE:-}"
log "BACKUP_FILE=${BACKUP_FILE:-}"
log "PREVIOUS_ENV_FILE=${PREVIOUS_ENV_FILE:-}"

[[ -n "${PREVIOUS_API_IMAGE:-}" ]] || die "PREVIOUS_API_IMAGE در state نیست."
[[ -n "${PREVIOUS_WEB_IMAGE:-}" ]] || die "PREVIOUS_WEB_IMAGE در state نیست."

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY-RUN full rollback plan:"
  log "  1) API_IMAGE=${PREVIOUS_API_IMAGE}"
  log "  2) WEB_IMAGE=${PREVIOUS_WEB_IMAGE}"
  log "  3) Restore previous env file if present"
  log "  4) Restore previous compose.server / runtime overlays if present"
  log "  5) compose up -d --force-recreate api web (بدون down -v)"
  log "  6) Health check readiness نسخه قبلی"
  log "  7) Backup دیتابیس حذف نمی‌شود؛ Imageهای Rollback prune نمی‌شوند"
  if [[ "$RESTORE_DB" == "1" ]]; then
    log "  8) OPTIONAL restore DB from ${BACKUP_FILE:-unset}"
  fi
  exit 0
fi

confirm_or_die "Rollback ${TARGET} را با API+Web+Env+Compose قبلی اجرا کنم؟ تایپ کنید: yes"

export API_IMAGE="$PREVIOUS_API_IMAGE"
export WEB_IMAGE="$PREVIOUS_WEB_IMAGE"

# بازگردانی Environment و Compose قبلی (در صورت وجود در state)
if [[ -n "${PREVIOUS_ENV_FILE:-}" && -f "${PREVIOUS_ENV_FILE}" ]]; then
  if [[ "$TARGET" == "production" ]]; then
    cp -a "${PREVIOUS_ENV_FILE}" /opt/ppm/.env
    log "Restored /opt/ppm/.env from previous release"
  fi
fi
if [[ -n "${PREVIOUS_SERVER_COMPOSE:-}" && -f "${PREVIOUS_SERVER_COMPOSE}" ]]; then
  cp -a "${PREVIOUS_SERVER_COMPOSE}" /opt/ppm/compose.server.yml
  log "Restored compose.server.yml"
fi
if [[ -n "${PREVIOUS_RUNTIME_COMPOSE:-}" && -f "${PREVIOUS_RUNTIME_COMPOSE}" ]]; then
  cp -a "${PREVIOUS_RUNTIME_COMPOSE}" /opt/ppm/compose.runtime-production.yml
  log "Restored compose.runtime-production.yml"
fi

if [[ "$TARGET" == "staging" ]]; then
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ppm_project_control_staging}"
  ENV_FILE="${STAGING_ENV_FILE:-/opt/ppm/secrets/.env.staging}"
  [[ -f "$ENV_FILE" ]] || ENV_FILE="${ROOT_DIR}/.env.staging"
  WT="${WORKTREE:-$ROOT_DIR}"
  docker compose \
    -f "${WT}/compose.production.yml" \
    -f "${WT}/compose.staging.yml" \
    --env-file "$ENV_FILE" \
    up -d --no-deps --force-recreate api web
  sleep 15
  curl -fsS http://127.0.0.1:18080/api/v1/health/readiness >/dev/null \
    || die "Staging health after rollback failed"
else
  confirm_or_die "Rollback PRODUCTION — تأیید نهایی؟ تایپ کنید: yes"
  WT="${WORKTREE:-$ROOT_DIR}"
  PROD_COMPOSE="${PROD_COMPOSE:-${WT}/compose.production.yml}"
  SERVER_COMPOSE="${SERVER_COMPOSE:-/opt/ppm/compose.server.yml}"
  RUNTIME_COMPOSE="${RUNTIME_COMPOSE:-/opt/ppm/compose.runtime-production.yml}"
  ENV_FILE="${PROD_ENV_FILE:-/opt/ppm/.env}"
  docker compose \
    -f "${PROD_COMPOSE}" \
    -f "${SERVER_COMPOSE}" \
    -f "${RUNTIME_COMPOSE}" \
    --env-file "$ENV_FILE" \
    up -d --no-deps --force-recreate api web
  sleep 20
  HEALTH_BASE="${HEALTH_BASE:-http://127.0.0.1:1011}"
  curl -fsS "${HEALTH_BASE}/api/v1/health/readiness" >/dev/null \
    || die "Production health after rollback failed"
fi

if [[ "$RESTORE_DB" == "1" ]]; then
  [[ -n "${BACKUP_FILE:-}" && -f "${BACKUP_FILE}" ]] || die "BACKUP_FILE معتبر نیست."
  confirm_or_die "Restore دیتابیس از Backup انجام شود؟ این عملیات مخرب است. تایپ کنید: yes"
  confirm_or_die "تأیید دوم Restore DB؟ تایپ کنید: yes"
  if [[ -x "$ROOT_DIR/infrastructure/backup/restore-postgres.sh" ]]; then
    "$ROOT_DIR/infrastructure/backup/restore-postgres.sh" "$BACKUP_FILE"
  else
    die "restore-postgres.sh یافت نشد."
  fi
fi

log "Rollback PASSED — API+Web(+env/compose) restored; backup retained; no image prune"
exit 0
