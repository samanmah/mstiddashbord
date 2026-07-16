#!/usr/bin/env bash
# اجرای Playwright E2E روی Staging واقعی.
# پیش از تست: contracts/API build و تولید Excel Fixture در worktree تمیز.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

# shellcheck disable=SC1091
[[ -f "$ROOT_DIR/.env.staging" ]] && { set -a; source "$ROOT_DIR/.env.staging"; set +a; }

export PLAYWRIGHT_BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
export E2E_EDITOR_USERNAME="${SEED_EDITOR_USERNAME:-editor}"
export E2E_EDITOR_PASSWORD="${SEED_EDITOR_PASSWORD:?SEED_EDITOR_PASSWORD required}"
export E2E_VIEWER_USERNAME="${SEED_VIEWER_USERNAME:-viewer}"
export E2E_VIEWER_PASSWORD="${SEED_VIEWER_PASSWORD:?SEED_VIEWER_PASSWORD required}"

# HTML report تولید شود ولی خودکار Serve/Open نشود (Failure باید فوراً exit کند؛ پورت 9323 آزاد بماند).
export PLAYWRIGHT_HTML_OPEN=never
export PW_TEST_HTML_REPORT_OPEN=never

FIXTURE_XLSX="$ROOT_DIR/artifacts/project-control/gantt-fixture.xlsx"
FIXTURE_DIST_JS="$ROOT_DIR/apps/api/dist/modules/project-control/import/__fixtures__/gantt-fixture.js"

fixture_xlsx_ok() {
  [[ -f "$FIXTURE_XLSX" ]] && [[ -s "$FIXTURE_XLSX" ]]
}

log "E2E base URL=${PLAYWRIGHT_BASE_URL}"
curl -fsS "${PLAYWRIGHT_BASE_URL}/api/v1/health/liveness" >/dev/null || die "Staging در دسترس نیست."

log "Building @ppm/contracts (پیش‌نیاز generate-fixture)..."
pnpm --filter @ppm/contracts build \
  || die "ساخت @ppm/contracts شکست خورد؛ E2E بدون Skip متوقف شد."

log "Generating Prisma client..."
pnpm --filter @ppm/api exec prisma generate \
  || die "prisma generate شکست خورد؛ E2E بدون Skip متوقف شد."

log "Building @ppm/api (برای dist fixture)..."
pnpm --filter @ppm/api build \
  || die "ساخت @ppm/api شکست خورد؛ E2E بدون Skip متوقف شد."

[[ -f "$FIXTURE_DIST_JS" ]] \
  || die "فایل dist fixture یافت نشد پس از build: ${FIXTURE_DIST_JS}"

if ! fixture_xlsx_ok; then
  log "Excel Fixture موجود/غیرخالی نیست — تولید با generate-fixture.mjs..."
  node "$ROOT_DIR/infrastructure/scripts/project-control/generate-fixture.mjs" \
    || die "تولید gantt-fixture.xlsx شکست خورد؛ E2E بدون Skip متوقف شد."
fi

fixture_xlsx_ok \
  || die "Excel Fixture پس از تولید خالی یا ناموجود است: ${FIXTURE_XLSX}"

log "Excel Fixture آماده است: ${FIXTURE_XLSX} ($(wc -c <"$FIXTURE_XLSX" | tr -d ' ') bytes)"

cd "$ROOT_DIR/apps/web"
set +e
pnpm exec playwright test e2e/project-control.spec.ts e2e/dashboard.spec.ts \
  --reporter=list --reporter=html
E2E_CODE=$?
set -e
[[ "$E2E_CODE" -eq 0 ]] || die "E2E شکست خورد (exit=${E2E_CODE}). HTML report بدون Serve در playwright-report/ موجود است."
log "E2E PASSED"
exit 0
