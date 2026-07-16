#!/usr/bin/env bash
# Import Fixture روی Server — بدون pnpm/npm روی Host.
# JSON با node داخل کانتینر API پارس می‌شود (Host به registry.npmjs.org نیاز ندارد).
set -Eeuo pipefail

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

node_in_api() {
  docker exec -i ppm_pc_staging_api node -e "$1"
}

STAGING_ENV_FILE="${STAGING_ENV_FILE:-/opt/ppm/secrets/.env.staging}"
FIXTURE="${FIXTURE:?FIXTURE path required}"
BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
API="${BASE_URL}/api/v1"
ARTIFACT_DIR="${ARTIFACT_DIR:-.}"
mkdir -p "${ARTIFACT_DIR}"

[[ -f "$FIXTURE" && -s "$FIXTURE" ]] || die "Fixture missing/empty: $FIXTURE"
[[ -f "$STAGING_ENV_FILE" ]] || die "Missing $STAGING_ENV_FILE"
# shellcheck disable=SC1090
set -a; source "$STAGING_ENV_FILE"; set +a

EDITOR_USER="${SEED_EDITOR_USERNAME:-editor}"
EDITOR_PASS="${SEED_EDITOR_PASSWORD:?SEED_EDITOR_PASSWORD required}"

COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

log "Login editor..."
curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -X POST "${API}/auth/login" \
  -d "{\"username\":\"${EDITOR_USER}\",\"password\":\"${EDITOR_PASS}\"}" >/dev/null
CSRF="$(awk '$6=="csrf_token"{print $7}' "$COOKIE_JAR" | tail -1)"
[[ -n "$CSRF" ]] || die "csrf_token missing"

PROJECTS="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" "${API}/projects")"
PROJECT_ID="$(printf '%s' "$PROJECTS" | node_in_api '
  let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
    const arr=JSON.parse(d);
    const hit=(arr||[]).find(p=>p && p.projectCode==="STG-PC-001");
    process.stdout.write(hit && hit.id ? hit.id : "");
  });
')"

if [[ -z "$PROJECT_ID" ]]; then
  log "Creating STG-PC-001..."
  CREATE="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: ${CSRF}" \
    -X POST "${API}/projects" \
    -d '{
      "titleFa":"Staging Control Project",
      "titleEn":"Staging Control",
      "projectCode":"STG-PC-001",
      "projectManager":"Staging Editor",
      "budgetBillionRial":1,
      "projectType":"زیرساختی",
      "description":"Staging fixture project for Advanced Project Control",
      "startDate":"1404/09/01",
      "plannedEndDate":"1406/12/10",
      "reportDate":"1405/04/25"
    }')"
  PROJECT_ID="$(printf '%s' "$CREATE" | node_in_api '
    let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).id||""));
  ')"
fi
[[ -n "$PROJECT_ID" ]] || die "PROJECT_ID unresolved"
log "Fixture project=${PROJECT_ID}"

set +e
ENABLE_HTTP="$(curl -sS -o /tmp/enable.json -w '%{http_code}' \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: ${CSRF}" \
  -X POST "${API}/projects/${PROJECT_ID}/control/enable" \
  -d '{"title":"Staging Control Plan","statusDate":"1405/04/25"}')"
set -e
if [[ "$ENABLE_HTTP" != "200" && "$ENABLE_HTTP" != "201" && "$ENABLE_HTTP" != "409" ]]; then
  die "Enable failed HTTP ${ENABLE_HTTP}"
fi
log "Enable HTTP=${ENABLE_HTTP}"

docker exec ppm_pc_staging_api mkdir -p /tmp/ppm-import
docker cp "$FIXTURE" ppm_pc_staging_api:/tmp/ppm-import/gantt-fixture.xlsx

log "Dry-run import..."
set +e
DRY_OUT="$(docker exec ppm_pc_staging_api node dist/modules/project-control/import/cli/import.cli.js \
  --project-id "$PROJECT_ID" \
  --excel /tmp/ppm-import/gantt-fixture.xlsx \
  --dry-run 2>&1)"
DRY_CODE=$?
set -e
echo "$DRY_OUT" | grep -q 'Manifest' || die "Manifest missing in dry-run"
echo "$DRY_OUT" | grep -E '✗' >/dev/null && die "Manifest has failed rows"
[[ "$DRY_CODE" -eq 0 ]] || die "Dry-run failed exit=${DRY_CODE}"
log "Dry-run OK"

log "Commit import..."
docker exec ppm_pc_staging_api node dist/modules/project-control/import/cli/import.cli.js \
  --project-id "$PROJECT_ID" \
  --excel /tmp/ppm-import/gantt-fixture.xlsx \
  --commit --allow-warnings

echo "$PROJECT_ID" >"${ARTIFACT_DIR}/staging-project-id.txt"
log "Import Fixture PASSED — wrote ${ARTIFACT_DIR}/staging-project-id.txt"
echo "PROJECT_ID=${PROJECT_ID}"
