#!/bin/sh
# ==========================================================================
# Entrypoint کانتینر API:
#   ۱) Prisma migrate deploy (شکست → خروج؛ API شروع نمی‌شود)
#   ۲) Seed اختیاری با JS کامپایل‌شده (بدون ts-node)
#   ۳) اجرای دستور اصلی
# ==========================================================================
set -eu

echo "[entrypoint] APP_VERSION=${APP_VERSION:-unknown} GIT_SHA=${GIT_SHA:-unknown}"

echo "[entrypoint] اجرای Prisma migrate deploy ..."
if ! node node_modules/prisma/build/index.js migrate deploy; then
  echo "[entrypoint] ERROR: migrate deploy شکست خورد — API شروع نمی‌شود." >&2
  exit 1
fi

if [ "${RUN_SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] اجرای Seed اولیه (dist/seed/run-seed.js) ..."
  if [ ! -f dist/seed/run-seed.js ]; then
    echo "[entrypoint] ERROR: فایل Seed کامپایل‌شده یافت نشد: dist/seed/run-seed.js" >&2
    exit 1
  fi
  # شکست Seed را پنهان نمی‌کنیم؛ پیام گمراه‌کننده «احتمالاً داده موجود است» حذف شد.
  if ! node dist/seed/run-seed.js; then
    echo "[entrypoint] ERROR: Seed شکست خورد (exit non-zero). برای ادامه بدون Seed، RUN_SEED_ON_START=false بگذارید." >&2
    exit 1
  fi
fi

echo "[entrypoint] شروع سرویس API ..."
exec "$@"
