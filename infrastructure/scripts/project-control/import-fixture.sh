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
ENABLE_BODY=""
ENABLE_HEADERS=""
cleanup_import_temps() {
  # هرگز از EXIT trap وضعیت غیرصفر برنگردان (وگرنه exit 0 اسکریپت ۱ می‌شود).
  set +e
  rm -f "${COOKIE_JAR:-}" "${ENABLE_BODY:-}" "${ENABLE_HEADERS:-}"
  set -e
  return 0
}
trap cleanup_import_temps EXIT

# shellcheck disable=SC1091
[[ -f "$ROOT_DIR/.env.staging" ]] && { set -a; source "$ROOT_DIR/.env.staging"; set +a; }

EDITOR_USER="${SEED_EDITOR_USERNAME:-editor}"
EDITOR_PASS="${SEED_EDITOR_PASSWORD:-}"
[[ -n "$EDITOR_PASS" ]] || die "SEED_EDITOR_PASSWORD تنظیم نشده (از .env.staging)."

# آماده‌سازی Artifact روی Host — وابسته به باقیمانده CI/Docker نیست.
require_cmd pnpm
require_cmd node
[[ -d "$ROOT_DIR/node_modules" ]] \
  || die "node_modules یافت نشد. ابتدا CI=true pnpm install --frozen-lockfile را اجرا کنید (اسکریپت Dependency نصب نمی‌کند)."

log "Building contracts"
pnpm --filter @ppm/contracts build

log "Generating Prisma client"
pnpm --filter @ppm/api prisma:generate

log "Building API"
pnpm --filter @ppm/api build

log "Generating sanitized fixture..."
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

log "Create or select staging fixture project (deterministic STG-PC-001)..."
PROJECTS="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" "${API}/projects")"
SELECT_JSON="$(printf '%s' "$PROJECTS" | node --input-type=module -e '
  import { selectStagingFixtureProject, FIXTURE_PROJECT_CREATE } from "./infrastructure/scripts/project-control/select-staging-fixture-project.mjs";
  let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
    try {
      const arr=JSON.parse(d);
      const result=selectStagingFixtureProject(arr);
      if (result.action==="reuse") {
        process.stdout.write(JSON.stringify({ action:"reuse", id: result.project.id }));
      } else {
        process.stdout.write(JSON.stringify({ action:"create", create: FIXTURE_PROJECT_CREATE }));
      }
    } catch (e) {
      console.error(String(e && e.message ? e.message : e));
      process.exit(2);
    }
  });
')" || die "انتخاب پروژه Fixture شکست خورد."

SELECT_ACTION="$(printf '%s' "$SELECT_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).action))')"
if [[ "$SELECT_ACTION" == "reuse" ]]; then
  PROJECT_ID="$(printf '%s' "$SELECT_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).id))')"
  log "Reuse fixture project id=${PROJECT_ID}"
else
  CREATE_BODY="$(printf '%s' "$SELECT_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(d).create)))')"
  CREATE="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: ${CSRF}" \
    -X POST "${API}/projects" \
    -d "$CREATE_BODY")"
  PROJECT_ID="$(printf '%s' "$CREATE" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).id))')"
  [[ -n "$PROJECT_ID" ]] || die "ساخت پروژه Fixture ناموفق بود."
  log "Created fixture project id=${PROJECT_ID}"
fi

log "Verify fixture project contract via GET..."
PROJECT_JSON="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
  "${API}/projects/${PROJECT_ID}")"
printf '%s' "$PROJECT_JSON" | EXPECTED_PROJECT_ID="$PROJECT_ID" node --input-type=module -e '
  import { assertFixtureProjectContract, FIXTURE_PROJECT_CODE, FIXTURE_PROJECT_CREATE } from "./infrastructure/scripts/project-control/select-staging-fixture-project.mjs";
  let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
    const p=JSON.parse(d);
    if (p.id !== process.env.EXPECTED_PROJECT_ID) {
      console.error(`id mismatch: expected ${process.env.EXPECTED_PROJECT_ID}, got ${p.id}`);
      process.exit(2);
    }
    assertFixtureProjectContract(p);
    if (p.projectCode !== FIXTURE_PROJECT_CODE || p.titleFa !== FIXTURE_PROJECT_CREATE.titleFa) process.exit(2);
  });
' || die "Assert قرارداد پروژه Fixture پس از GET شکست خورد."
log "ProjectId=${PROJECT_ID} projectCode=STG-PC-001 titleFa=Staging Control Project"

log "Enable Project Control..."
ENABLE_BODY="$(mktemp)"
ENABLE_HEADERS="$(mktemp)"
set +e
ENABLE_HTTP="$(curl -sS -o "$ENABLE_BODY" -D "$ENABLE_HEADERS" -w '%{http_code}' \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: ${CSRF}" \
  -X POST "${API}/projects/${PROJECT_ID}/control/enable" \
  -d '{"title":"Staging Control Plan","statusDate":"1405/04/25"}')"
ENABLE_CURL_RC=$?
set -e
[[ "$ENABLE_CURL_RC" -eq 0 ]] || die "Enable: درخواست HTTP شکست خورد (curl exit=${ENABLE_CURL_RC})."

ENABLE_CLASSIFY="$(ENABLE_HTTP="$ENABLE_HTTP" node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { classifyEnableControlResponse } from "./infrastructure/scripts/project-control/classify-enable-response.mjs";
  const status = Number(process.env.ENABLE_HTTP);
  let body = null;
  try { body = JSON.parse(readFileSync(process.argv[1], "utf8")); } catch { body = null; }
  const result = classifyEnableControlResponse(status, body);
  process.stdout.write(JSON.stringify(result));
' "$ENABLE_BODY")" || die "Enable: طبقه‌بندی پاسخ شکست خورد."

ENABLE_OK="$(printf '%s' "$ENABLE_CLASSIFY" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(d).ok)))')"
ENABLE_KIND="$(printf '%s' "$ENABLE_CLASSIFY" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(d).kind||"")))')"
if [[ "$ENABLE_OK" != "true" ]]; then
  ENABLE_ERR_STATUS="$(printf '%s' "$ENABLE_CLASSIFY" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(d).status||"")))')"
  ENABLE_ERR_CODE="$(printf '%s' "$ENABLE_CLASSIFY" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(d).code||"")))')"
  ENABLE_ERR_MSG="$(printf '%s' "$ENABLE_CLASSIFY" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(d).message||"")))')"
  die "Enable شکست خورد: status=${ENABLE_ERR_STATUS} code=${ENABLE_ERR_CODE} message=${ENABLE_ERR_MSG}"
fi
if [[ "$ENABLE_KIND" == "already-enabled" ]]; then
  log "Enable: Conflict شناخته‌شده — کنترل پروژه قبلاً فعال بود؛ ادامه."
else
  log "Enable: موفق (HTTP ${ENABLE_HTTP})."
fi
rm -f "$ENABLE_BODY" "$ENABLE_HEADERS"
ENABLE_BODY=""
ENABLE_HEADERS=""

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
  cleanup_import_temps
  trap - EXIT
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
cleanup_import_temps
trap - EXIT
log "Import Fixture PASSED — project=${PROJECT_ID}"
exit 0
