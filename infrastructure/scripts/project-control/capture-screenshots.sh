#!/usr/bin/env bash
# Capture Screenshotهای Fixture Sanitized پس از موفقیت E2E.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

# shellcheck disable=SC1091
[[ -f "$ROOT_DIR/.env.staging" ]] && { set -a; source "$ROOT_DIR/.env.staging"; set +a; }

export PLAYWRIGHT_BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
export E2E_EDITOR_USERNAME="${SEED_EDITOR_USERNAME:-editor}"
export E2E_EDITOR_PASSWORD="${SEED_EDITOR_PASSWORD:?SEED_EDITOR_PASSWORD required}"
export E2E_VIEWER_USERNAME="${SEED_VIEWER_USERNAME:-viewer}"
export E2E_VIEWER_PASSWORD="${SEED_VIEWER_PASSWORD:?SEED_VIEWER_PASSWORD required}"

mkdir -p "$ROOT_DIR/artifacts/project-control"
cd "$ROOT_DIR/apps/web"
pnpm exec playwright test e2e/project-control-screenshots.spec.ts --reporter=list

REQUIRED=(
  control-overview-1920x1080.png
  wbs-editor-1920x1080.png
  import-manifest-1920x1080.png
  dashboard-1920x1080.png
  dashboard-1366x768.png
  dashboard-tablet-768x1024.png
  dashboard-mobile-390x844.png
  gantt-viewer-1920x1080.png
  gantt-editor-1920x1080.png
  phase-drilldown-1920x1080.png
)
for f in "${REQUIRED[@]}"; do
  [[ -f "$ROOT_DIR/artifacts/project-control/$f" ]] || die "Screenshot missing: $f"
  log "Screenshot OK: artifacts/project-control/$f"
done
log "Screenshots PASSED"
exit 0
