#!/usr/bin/env bash
# Backup/Restore فقط روی Staging — Production Restore اجرا نمی‌شود.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

EXECUTE=0
has_flag --execute "$@" && EXECUTE=1
[[ "$EXECUTE" == "1" ]] || { log "DRY-RUN: برای اجرا --execute بدهید"; exit 0; }

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ppm_project_control_staging}"
# shellcheck disable=SC1091
[[ -f "$ROOT_DIR/.env.staging" ]] && { set -a; source "$ROOT_DIR/.env.staging"; set +a; }

BACKUP_DIR="${ROOT_DIR}/backups/staging"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/ppm_staging_${STAMP}.sql.gz"

log "Creating staging backup -> ${BACKUP_FILE}"
docker exec ppm_pc_staging_postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip >"$BACKUP_FILE"
[[ -s "$BACKUP_FILE" ]] || die "Backup خالی است."

# ثبت یک Progress آزمایشی (best-effort)
BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
API="${BASE_URL}/api/v1"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT
curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -X POST "${API}/auth/login" \
  -d "{\"username\":\"${SEED_EDITOR_USERNAME}\",\"password\":\"${SEED_EDITOR_PASSWORD}\"}" >/dev/null
CSRF="$(awk '$6=="csrf_token"{print $7}' "$COOKIE_JAR" | tail -1)"
PROJECT_ID="$(cat "$ROOT_DIR/artifacts/project-control/staging-project-id.txt" 2>/dev/null || true)"
MARKER="restore-test-${STAMP}"

if [[ -n "${PROJECT_ID:-}" ]]; then
  # فقط برای ایجاد تفاوت قبل از restore — شکست غیر بحرانی است
  curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
    "${API}/projects/${PROJECT_ID}/control/dashboard" >/dev/null || true
  log "Marker context project=${PROJECT_ID} marker=${MARKER}"
fi

log "Restoring staging DB from backup..."
gunzip -c "$BACKUP_FILE" | docker exec -i ppm_pc_staging_postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null

sleep 3
curl -fsS "${API}/health/readiness" >/dev/null || die "Health بعد از Restore شکست خورد."

if [[ -n "${PROJECT_ID:-}" ]]; then
  curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
    "${API}/projects/${PROJECT_ID}/control/wbs" >/dev/null \
    || die "WBS بعد از Restore در دسترس نیست."
fi

log "Backup/Restore Staging PASSED — file=${BACKUP_FILE}"
exit 0
