#!/usr/bin/env bash
# Rollback Image-based (Forward-Only Migration).
# پیش‌فرض: بازگرداندن Image قبلی API/Web بدون Migration Down و بدون Restore DB.
# Restore DB فقط با --restore-db --execute و تأیید مضاعف.
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
log "PREVIOUS_API_IMAGE=$(mask_secret "${PREVIOUS_API_IMAGE:-}") -> will use image tag from state"
log "PREVIOUS_API_IMAGE=${PREVIOUS_API_IMAGE:-}"
log "PREVIOUS_WEB_IMAGE=${PREVIOUS_WEB_IMAGE:-}"
log "BACKUP_FILE=${BACKUP_FILE:-}"

[[ -n "${PREVIOUS_API_IMAGE:-}" ]] || die "PREVIOUS_API_IMAGE در state نیست."
[[ -n "${PREVIOUS_WEB_IMAGE:-}" ]] || die "PREVIOUS_WEB_IMAGE در state نیست."

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY-RUN rollback plan:"
  log "  1) Set API_IMAGE=${PREVIOUS_API_IMAGE}"
  log "  2) Set WEB_IMAGE=${PREVIOUS_WEB_IMAGE}"
  log "  3) compose up -d (بدون down -v، بدون حذف Volume)"
  log "  4) Health check"
  log "  5) جداول Additive جدید بلااستفاده باقی می‌مانند (Migration Down اجرا نمی‌شود)"
  if [[ "$RESTORE_DB" == "1" ]]; then
    log "  6) OPTIONAL restore DB from ${BACKUP_FILE:-unset} (نیاز به --execute)"
  fi
  exit 0
fi

confirm_or_die "Rollback ${TARGET} را با Imageهای قبلی اجرا کنم؟ تایپ کنید: yes"

export API_IMAGE="$PREVIOUS_API_IMAGE"
export WEB_IMAGE="$PREVIOUS_WEB_IMAGE"

if [[ "$TARGET" == "staging" ]]; then
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ppm_project_control_staging}"
  docker compose -f compose.production.yml -f compose.staging.yml --env-file .env.staging up -d
  sleep 15
  curl -fsS http://127.0.0.1:18080/api/v1/health/readiness >/dev/null || die "Staging health after rollback failed"
else
  confirm_or_die "Rollback PRODUCTION — تأیید نهایی؟ تایپ کنید: yes"
  docker compose -f compose.production.yml up -d
  sleep 20
  curl -fsS "${APP_ORIGIN:-http://localhost}/api/v1/health/readiness" >/dev/null || die "Production health after rollback failed"
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

log "Before: API was ${API_IMAGE:-unknown} (current pin), previous restored from state"
log "Rollback PASSED (forward-only schema retained)"
exit 0
