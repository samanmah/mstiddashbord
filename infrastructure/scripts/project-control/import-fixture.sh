#!/usr/bin/env bash
# Import Fixture Sanitized در Staging — بدون فایل محرمانه.
# Manifest CRITICAL → Commit ممنوع و Exit 2.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

DRY_RUN_ONLY=0
has_flag --dry-run-only "$@" && DRY_RUN_ONLY=1
has_flag --dry-run "$@" && DRY_RUN_ONLY=1

BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
API="${BASE_URL}/api/v1"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

# shellcheck disable=SC1091
[[ -f "$ROOT_DIR/.env.staging" ]] && { set -a; source "$ROOT_DIR/.env.staging"; set +a; }

EDITOR_USER="${SEED_EDITOR_USERNAME:-editor}"
EDITOR_PASS="${SEED_EDITOR_PASSWORD:-}"
[[ -n "$EDITOR_PASS" ]] || die "SEED_EDITOR_PASSWORD تنظیم نشده (از .env.staging)."

log "Generating sanitized fixture..."
pnpm --filter @ppm/api build >/dev/null
node "$ROOT_DIR/infrastructure/scripts/project-control/generate-fixture.mjs"
FIXTURE="$ROOT_DIR/artifacts/project-control/gantt-fixture.xlsx"
[[ -f "$FIXTURE" ]] || die "Fixture تولید نشد."

log "Login editor..."
LOGIN_JSON="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -X POST "${API}/auth/login" \
  -d "{\"username\":\"${EDITOR_USER}\",\"password\":\"${EDITOR_PASS}\"}")"
CSRF="$(awk '$6=="csrf_token"{print $7}' "$COOKIE_JAR" | tail -1)"
[[ -n "$CSRF" ]] || die "csrf_token دریافت نشد."

log "Create or select staging project..."
PROJECTS="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" "${API}/projects")"
PROJECT_ID="$(printf '%s' "$PROJECTS" | node -e '
  let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
    const arr=JSON.parse(d); const p=arr.find(x=>String(x.titleFa||"").includes("Staging Control"))||arr[0];
    if(!p) process.exit(2); process.stdout.write(p.id);
  });
')" || true

if [[ -z "${PROJECT_ID:-}" ]]; then
  CREATE="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: ${CSRF}" \
    -X POST "${API}/projects" \
    -d '{"titleFa":"Staging Control Project","titleEn":"Staging Control","projectCode":"STG-PC-001","projectManager":"Staging Editor","budgetBillionRial":1}')"
  PROJECT_ID="$(printf '%s' "$CREATE" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).id))')"
fi
log "ProjectId=${PROJECT_ID}"

log "Enable Project Control (idempotent)..."
curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: ${CSRF}" \
  -X POST "${API}/projects/${PROJECT_ID}/control/enable" \
  -d '{"title":"Staging Control Plan","statusDate":"1405/04/25"}' >/dev/null \
  || log "Enable ممکن است قبلاً انجام شده باشد — ادامه."

log "Copy fixture into API container..."
docker cp "$FIXTURE" ppm_pc_staging_api:/tmp/ppm-import/gantt-fixture.xlsx

log "Dry-Run Import (CLI compiled JS)..."
set +e
DRY_OUT="$(docker exec ppm_pc_staging_api node dist/modules/project-control/import/cli/import.cli.js \
  --project-id "$PROJECT_ID" \
  --excel /tmp/ppm-import/gantt-fixture.xlsx \
  --dry-run 2>&1)"
DRY_CODE=$?
set -e
printf '%s\n' "$DRY_OUT"

# Assert Manifest keys
assert_manifest() {
  local key="$1" expected="$2"
  echo "$DRY_OUT" | grep -E "${key}.*${expected}|${expected}.*${key}|انتظار ${expected}" >/dev/null \
    || die "Manifest mismatch for ${key} expected=${expected}"
}

# بررسی خروجی Manifest (برچسب‌های فارسی CLI)
echo "$DRY_OUT" | grep -q 'Manifest' || die "خروجی Manifest دیده نشد."
echo "$DRY_OUT" | grep -E '✗' >/dev/null && die "Manifest دارای ردیف ناموفق (✗) است — Commit ممنوع. RC مردود."
[[ "$DRY_CODE" -eq 0 ]] || die "Dry-Run با exit=${DRY_CODE} شکست خورد — Commit ممنوع."

log "Manifest dry-run OK"

if [[ "$DRY_RUN_ONLY" == "1" ]]; then
  log "فقط Dry-Run درخواست شده بود."
  exit 0
fi

log "Commit Import..."
set +e
COMMIT_OUT="$(docker exec ppm_pc_staging_api node dist/modules/project-control/import/cli/import.cli.js \
  --project-id "$PROJECT_ID" \
  --excel /tmp/ppm-import/gantt-fixture.xlsx \
  --commit --allow-warnings 2>&1)"
COMMIT_CODE=$?
set -e
printf '%s\n' "$COMMIT_OUT"
[[ "$COMMIT_CODE" -eq 0 ]] || die "Commit Import شکست خورد (exit=${COMMIT_CODE})."

# Post checks
PHASES="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/analytics/phase-rollup")"
PHASE_COUNT="$(printf '%s' "$PHASES" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(d).length)))')"
[[ "$PHASE_COUNT" == "7" ]] || die "انتظار ۷ فاز؛ دریافت شد: ${PHASE_COUNT}"

DASH="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}/control/dashboard")"
printf '%s' "$DASH" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); if(!j.phaseRollups||j.phaseRollups.length!==7) process.exit(2);})' \
  || die "Dashboard Aggregation هفت فاز را برنگرداند."

echo "$PROJECT_ID" >"$ROOT_DIR/artifacts/project-control/staging-project-id.txt"
log "Import Fixture PASSED — project=${PROJECT_ID}"
exit 0
