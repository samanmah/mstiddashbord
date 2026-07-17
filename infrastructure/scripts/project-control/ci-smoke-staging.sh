#!/usr/bin/env bash
# Smoke Staging برای CI — فقط curl + docker (بدون pnpm/node روی Host).
set -Eeuo pipefail

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
err() { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { err "$*"; exit 1; }

STAGING_ENV_FILE="${STAGING_ENV_FILE:-/opt/ppm/secrets/.env.staging}"
BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
API="${BASE_URL}/api/v1"
FULL_SHA="${FULL_SHA:-}"
ARTIFACT="${ARTIFACT:-}"
if [[ -z "$ARTIFACT" && -n "${FULL_SHA}" ]]; then
  ARTIFACT="/opt/ppm/releases/worktrees/${FULL_SHA}/artifacts/project-control/staging-project-id.txt"
fi
[[ -n "$ARTIFACT" && -f "$ARTIFACT" ]] || die "staging-project-id.txt required"
PROJECT_ID="$(tr -d '[:space:]' <"$ARTIFACT")"
[[ -n "$PROJECT_ID" ]] || die "empty project id"

# shellcheck disable=SC1090
set -a; source "$STAGING_ENV_FILE"; set +a
EDITOR_USER="${SEED_EDITOR_USERNAME:-editor}"
EDITOR_PASS="${SEED_EDITOR_PASSWORD:?}"
VIEWER_USER="${SEED_VIEWER_USERNAME:-viewer}"
VIEWER_PASS="${SEED_VIEWER_PASSWORD:?}"

fail=0
check() {
  local name="$1"; shift
  if "$@"; then log "OK  ${name}"; else err "FAIL ${name}"; fail=1; fi
}

check "containers not restarting" bash -c '
  bad=$(docker ps --filter name=ppm_pc_staging --format "{{.Names}} {{.Status}}" | grep -ci restarting || true)
  [[ "$bad" -eq 0 ]]
'
check "postgres healthy" docker exec ppm_pc_staging_postgres pg_isready \
  -U "${POSTGRES_USER:-ppm_staging_user}" -d "${POSTGRES_DB:-ppm_project_control_staging}"

curl -fsS "${API}/health/liveness" >/tmp/stg-live.json
check "liveness 200" grep -q '"status":"ok"' /tmp/stg-live.json
if [[ -n "$FULL_SHA" ]]; then
  check "liveness exact FULL_SHA" grep -Fq "\"gitSha\":\"${FULL_SHA}\"" /tmp/stg-live.json
fi
check "readiness" curl -fsS "${API}/health/readiness"

COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

csrf_login() {
  local user="$1" pass="$2"
  curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
    -X POST "${API}/auth/login" \
    -d "{\"username\":\"${user}\",\"password\":\"${pass}\"}" >/dev/null
  awk '$6=="csrf_token"{print $7}' "$COOKIE_JAR" | tail -1
}

CSRF="$(csrf_login "$EDITOR_USER" "$EDITOR_PASS")"
check "login editor" bash -c "[[ -n '$CSRF' ]]"

api_ok() {
  local url="$1" csrf="${2:-}"
  if [[ -n "$csrf" ]]; then
    curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${csrf}" "$url" >/dev/null
  else
    curl -fsS "$url" >/dev/null
  fi
}

# قرارداد Fixture: GET project باید 200 و id مطابق artifact باشد
curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}" >/tmp/stg-project.json
check "fixture project id match" grep -Fq "\"id\":\"${PROJECT_ID}\"" /tmp/stg-project.json
check "fixture projectCode STG-PC-001" grep -Fq '"projectCode":"STG-PC-001"' /tmp/stg-project.json

for path in \
  "dashboard" \
  "risks" \
  "decisions" \
  "control/plan" \
  "control/dashboard" \
  "control/wbs" \
  "control/gantt" \
  "control/analytics/s-curve" \
  "control/analytics/phase-rollup" \
  "control/analytics/critical-path" \
  "control/analytics/data-quality" \
  "control/imports"
do
  check "$path" api_ok "${API}/projects/${PROJECT_ID}/${path}" "$CSRF"
done

# MPP capability (نباید Crash کند)
MPP_CODE="$(curl -sS -o /tmp/mpp.json -w '%{http_code}' -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/imports/mpp-check" || true)"
check "mpp-check reachable" bash -c "[[ '$MPP_CODE' == '200' ]]"
if [[ "$MPP_CODE" == "200" ]]; then
  check "mpp javaAvailable" bash -c "grep -q '\"javaAvailable\":true' /tmp/mpp.json"
  check "mpp mpxjAvailable" bash -c "grep -q '\"mpxjAvailable\":true' /tmp/mpp.json"
fi

rm -f "$COOKIE_JAR"
COOKIE_JAR="$(mktemp)"
CSRF_V="$(csrf_login "$VIEWER_USER" "$VIEWER_PASS")"
check "login viewer" bash -c "[[ -n '$CSRF_V' ]]"
check "viewer control dashboard" api_ok "${API}/projects/${PROJECT_ID}/control/dashboard" "$CSRF_V"

STATUS="$(docker exec ppm_pc_staging_api node node_modules/prisma/build/index.js migrate status 2>&1 || true)"
check "no pending migrations" bash -c "printf '%s' '$STATUS' | grep -Eqi 'up to date|No pending'"

[[ "$fail" -eq 0 ]] || die "Smoke Test FAILED"
log "Smoke Test PASSED"
exit 0
