#!/usr/bin/env bash
# ==========================================================================
# بازیابی دیتابیس PostgreSQL از فایل پشتیبان
#
# اجرا:
#   ./restore-postgres.sh /var/backups/ppm/ppm_ppm_db_2026-07-13_02-00-00.sql.gz
#
# هشدار: این عملیات داده‌های فعلی دیتابیس را بازنویسی می‌کند.
# ==========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yml}"
PG_USER="${POSTGRES_USER:-ppm_user}"
PG_DB="${POSTGRES_DB:-ppm_db}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "استفاده: $0 <path-to-backup.sql.gz>"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  log "خطا: فایل پشتیبان یافت نشد: ${BACKUP_FILE}"
  exit 1
fi

if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  log "خطا: فایل پشتیبان معتبر نیست یا خراب است."
  exit 1
fi

read -r -p "آیا مطمئن هستید؟ داده‌های فعلی دیتابیس '${PG_DB}' بازنویسی خواهد شد. (yes/no): " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  log "عملیات لغو شد."
  exit 0
fi

log "شروع بازیابی از ${BACKUP_FILE} ..."

if gunzip -c "${BACKUP_FILE}" \
    | docker compose -f "${ROOT_DIR}/${COMPOSE_FILE}" exec -T postgres \
        psql -U "${PG_USER}" -d "${PG_DB}"; then
  log "بازیابی با موفقیت انجام شد."
else
  log "خطا: بازیابی ناموفق بود."
  exit 1
fi

exit 0
