#!/usr/bin/env bash
# Smoke Test روی Staging واقعی — فقط Fixture deterministic (STG-PC-001).
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
API="${BASE_URL}/api/v1"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

# shellcheck disable=SC1091
[[ -f "$ROOT_DIR/.env.staging" ]] && { set -a; source "$ROOT_DIR/.env.staging"; set +a; }

EDITOR_USER="${SEED_EDITOR_USERNAME:-editor}"
EDITOR_PASS="${SEED_EDITOR_PASSWORD:-}"
VIEWER_USER="${SEED_VIEWER_USERNAME:-viewer}"
VIEWER_PASS="${SEED_VIEWER_PASSWORD:-}"
[[ -n "$EDITOR_PASS" && -n "$VIEWER_PASS" ]] || die "رمز Seed در .env.staging تنظیم نشده."

fail=0
check() {
  local name="$1"
  shift
  if "$@"; then
    log "OK  ${name}"
  else
    err "FAIL ${name}"
    fail=1
  fi
}

check "containers not restarting" bash -c '
  bad=$(docker ps --filter name=ppm_pc_staging --format "{{.Names}} {{.Status}}" | grep -ci restarting || true)
  [[ "$bad" -eq 0 ]]
'

check "postgres healthy" docker exec ppm_pc_staging_postgres pg_isready -U "${POSTGRES_USER:-ppm_staging_user}" -d "${POSTGRES_DB:-ppm_project_control_staging}"
check "nginx no 502 on health" bash -c "code=\$(curl -s -o /dev/null -w '%{http_code}' ${API}/health/liveness); [[ \$code == 200 ]]"

LIVE="$(curl -fsS "${API}/health/liveness")"
check "health liveness has version" bash -c "printf '%s' '$LIVE' | grep -q version"
check "health readiness" curl -fsS "${API}/health/readiness" >/dev/null

csrf_login() {
  local user="$1" pass="$2"
  curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
    -X POST "${API}/auth/login" \
    -d "{\"username\":\"${user}\",\"password\":\"${pass}\"}" >/dev/null
  awk '$6=="csrf_token"{print $7}' "$COOKIE_JAR" | tail -1
}

CSRF="$(csrf_login "$EDITOR_USER" "$EDITOR_PASS")"
check "login editor" bash -c "[[ -n '$CSRF' ]]"

ARTIFACT_FILE="$ROOT_DIR/artifacts/project-control/staging-project-id.txt"
[[ -f "$ARTIFACT_FILE" ]] || die "Artifact یافت نشد: ${ARTIFACT_FILE}"
PROJECT_ID="$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { readFixtureProjectIdFromArtifact } from "./infrastructure/scripts/project-control/smoke-fixture-project.mjs";
  process.stdout.write(readFixtureProjectIdFromArtifact(readFileSync(process.argv[1], "utf8")));
' "$ARTIFACT_FILE")" || die "خواندن Artifact project ID شکست خورد."
log "Smoke fixture projectId=${PROJECT_ID}"

PROJECT_JSON="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}")"
printf '%s' "$PROJECT_JSON" | EXPECTED_PROJECT_ID="$PROJECT_ID" node --input-type=module -e '
  import { assertSmokeFixtureProject } from "./infrastructure/scripts/project-control/smoke-fixture-project.mjs";
  let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
    try {
      assertSmokeFixtureProject(JSON.parse(d), process.env.EXPECTED_PROJECT_ID);
    } catch (e) {
      console.error(String(e && e.message ? e.message : e));
      process.exit(2);
    }
  });
' || die "قرارداد Smoke برای Fixture نقض شد (بدون fallback به پروژه اول)."

check "legacy dashboard (fixture)" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/dashboard" >/dev/null
check "risks" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/risks" >/dev/null
check "decisions" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/decisions" >/dev/null

# Advanced Project Control — الزامی برای Fixture فعال
check "control plan" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/plan" >/dev/null
check "control dashboard / overview" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/dashboard" >/dev/null
check "wbs tree" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/wbs" >/dev/null
check "gantt" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/gantt" >/dev/null
check "s-curve analytics" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/analytics/s-curve" >/dev/null
check "phase-rollup analytics" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/analytics/phase-rollup" >/dev/null
check "critical-path" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/analytics/critical-path" >/dev/null
check "data-quality" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/analytics/data-quality" >/dev/null
check "imports list" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/imports" >/dev/null

rm -f "$COOKIE_JAR"
COOKIE_JAR="$(mktemp)"
CSRF_V="$(csrf_login "$VIEWER_USER" "$VIEWER_PASS")"
check "login viewer" bash -c "[[ -n '$CSRF_V' ]]"
check "viewer control dashboard" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF_V}" \
  "${API}/projects/${PROJECT_ID}/control/dashboard" >/dev/null
check "viewer legacy dashboard" curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF_V}" \
  "${API}/projects/${PROJECT_ID}/dashboard" >/dev/null

# Migration pending
STATUS="$(docker exec ppm_pc_staging_api node node_modules/prisma/build/index.js migrate status 2>&1 || true)"
check "no pending migrations" bash -c "printf '%s' '$STATUS' | grep -Eqi 'up to date|No pending'"

# Import temp leftovers (best-effort)
LEFTOVER="$(docker exec ppm_pc_staging_api sh -c 'ls /tmp/ppm-import 2>/dev/null | wc -l' || echo 0)"
log "Import temp entries: ${LEFTOVER}"

# Critical error logs (best-effort)
ERRS="$(docker logs ppm_pc_staging_api 2>&1 | tail -200 | grep -ciE 'FATAL|Unhandled|ECONNREFUSED' || true)"
check "no critical api log spam" bash -c "[[ '${ERRS}' -lt 5 ]]"

[[ "$fail" -eq 0 ]] || die "Smoke Test FAILED"
log "Smoke Test PASSED"
exit 0
