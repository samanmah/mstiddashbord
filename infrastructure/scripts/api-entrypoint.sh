#!/bin/sh
# ==========================================================================
# Entrypoint کانتینر API:
#   ۱) اجرای Migrationهای Prisma (migrate deploy) به‌صورت idempotent
#   ۲) اجرای دستور اصلی (پیش‌فرض: node dist/main.js)
# ==========================================================================
set -e

echo "[entrypoint] اجرای Prisma migrate deploy ..."
node node_modules/prisma/build/index.js migrate deploy

if [ "${RUN_SEED_ON_START}" = "true" ]; then
  echo "[entrypoint] اجرای Seed اولیه ..."
  node node_modules/prisma/build/index.js db seed || echo "[entrypoint] Seed اجرا نشد (احتمالاً داده موجود است)."
fi

echo "[entrypoint] شروع سرویس API ..."
exec "$@"
