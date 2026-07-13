#!/usr/bin/env bash
# ==========================================================================
# پشتیبان‌گیری از دیتابیس PostgreSQL سامانه پایش پروژه
#
# اجرا (روی سرور Production):
#   ./backup-postgres.sh
#
# متغیرهای محیطی قابل تنظیم:
#   BACKUP_DIR              مسیر ذخیره فایل‌های پشتیبان (پیش‌فرض: /var/backups/ppm)
#   BACKUP_RETENTION_DAYS   نگهداری چند روز پشتیبان (پیش‌فرض: 14)
#   COMPOSE_FILE            فایل کامپوز (پیش‌فرض: compose.production.yml)
#   POSTGRES_USER / POSTGRES_DB   از فایل .env خوانده می‌شوند
# ==========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# بارگذاری متغیرها از .env در صورت وجود
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ppm}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yml}"
PG_USER="${POSTGRES_USER:-ppm_user}"
PG_DB="${POSTGRES_DB:-ppm_db}"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUTFILE="${BACKUP_DIR}/ppm_${PG_DB}_${TIMESTAMP}.sql.gz"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "${BACKUP_DIR}"

log "شروع پشتیبان‌گیری از دیتابیس '${PG_DB}' ..."

# اجرای pg_dump داخل کانتینر postgres و فشرده‌سازی خروجی
if docker compose -f "${ROOT_DIR}/${COMPOSE_FILE}" exec -T postgres \
      pg_dump -U "${PG_USER}" -d "${PG_DB}" --clean --if-exists \
    | gzip -9 > "${OUTFILE}"; then
  SIZE="$(du -h "${OUTFILE}" | cut -f1)"
  log "پشتیبان با موفقیت ساخته شد: ${OUTFILE} (${SIZE})"
else
  log "خطا: پشتیبان‌گیری ناموفق بود."
  rm -f "${OUTFILE}"
  exit 1
fi

# بررسی سلامت فایل فشرده
if ! gzip -t "${OUTFILE}" 2>/dev/null; then
  log "خطا: فایل پشتیبان خراب است."
  rm -f "${OUTFILE}"
  exit 1
fi

# حذف پشتیبان‌های قدیمی‌تر از RETENTION_DAYS روز
log "حذف پشتیبان‌های قدیمی‌تر از ${RETENTION_DAYS} روز ..."
find "${BACKUP_DIR}" -name 'ppm_*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete || true

log "پشتیبان‌گیری کامل شد."
exit 0
