#!/usr/bin/env bash
# اجرای Playwright E2E روی Staging واقعی.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

# shellcheck disable=SC1091
[[ -f "$ROOT_DIR/.env.staging" ]] && { set -a; source "$ROOT_DIR/.env.staging"; set +a; }

export PLAYWRIGHT_BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
export E2E_EDITOR_USERNAME="${SEED_EDITOR_USERNAME:-editor}"
export E2E_EDITOR_PASSWORD="${SEED_EDITOR_PASSWORD:?SEED_EDITOR_PASSWORD required}"
export E2E_VIEWER_USERNAME="${SEED_VIEWER_USERNAME:-viewer}"
export E2E_VIEWER_PASSWORD="${SEED_VIEWER_PASSWORD:?SEED_VIEWER_PASSWORD required}"

log "E2E base URL=${PLAYWRIGHT_BASE_URL}"
curl -fsS "${PLAYWRIGHT_BASE_URL}/api/v1/health/liveness" >/dev/null || die "Staging در دسترس نیست."

cd "$ROOT_DIR/apps/web"
pnpm exec playwright test e2e/project-control.spec.ts e2e/dashboard.spec.ts --reporter=list
log "E2E PASSED"
exit 0
