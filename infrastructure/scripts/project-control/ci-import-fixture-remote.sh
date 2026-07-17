#!/usr/bin/env bash
# Import Fixture روی Server — بدون pnpm/npm روی Host.
# Enable به‌صورت idempotent/state-aware؛ Commit فقط وقتی تعداد نود فعال ≠ 174.
set -Eeuo pipefail

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

command -v python3 >/dev/null 2>&1 || die "python3 برای پارس امن JSON لازم است."
command -v curl >/dev/null 2>&1 || die "curl لازم است."
command -v docker >/dev/null 2>&1 || die "docker لازم است."

STAGING_ENV_FILE="${STAGING_ENV_FILE:-/opt/ppm/secrets/.env.staging}"
FIXTURE="${FIXTURE:?FIXTURE path required}"
BASE_URL="${STAGING_URL:-http://127.0.0.1:18080}"
API="${BASE_URL}/api/v1"
ARTIFACT_DIR="${ARTIFACT_DIR:-.}"
EXPECTED_NODES_WITH_ROOT="${EXPECTED_NODES_WITH_ROOT:-174}"
FIXTURE_CODE="STG-PC-001"
ENABLE_PATH="unknown"
mkdir -p "${ARTIFACT_DIR}"

TMP_DIR="$(mktemp -d)"
COOKIE_JAR="${TMP_DIR}/cookies.txt"
PROJECT_JSON="${TMP_DIR}/project.json"
ENABLE_BODY="${TMP_DIR}/enable.json"
WBS_JSON="${TMP_DIR}/wbs.json"
trap 'rm -rf "$TMP_DIR"' EXIT

[[ -f "$FIXTURE" && -s "$FIXTURE" ]] || die "Fixture missing/empty: $FIXTURE"
[[ -f "$STAGING_ENV_FILE" ]] || die "Missing $STAGING_ENV_FILE"
# shellcheck disable=SC1090
set -a; source "$STAGING_ENV_FILE"; set +a

EDITOR_USER="${SEED_EDITOR_USERNAME:-editor}"
EDITOR_PASS="${SEED_EDITOR_PASSWORD:?SEED_EDITOR_PASSWORD required}"

# چاپ امن status/code/message از body خطا (بدون Secret)
py_log_error_body() {
  local file="$1" status="$2"
  python3 -c '
import json, re, sys
path, status = sys.argv[1], sys.argv[2]
code, message = "", ""
try:
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    if raw:
        data = json.loads(raw)
        if isinstance(data, dict):
            code = str(data.get("code") or "")
            message = str(data.get("message") or "")
except Exception:
    code, message = "PARSE_ERROR", "response body unreadable"
message = re.sub(r"(?i)Bearer\s+\S+", "Bearer [redacted]", message)
message = re.sub(r"(?i)cookie[s]?\s*[:=]\s*[^;\s]+", "cookie=[redacted]", message)
message = message[:500]
print(f"status={status} code={code} message={message}")
' "$file" "$status"
}

validate_project_state() {
  local file="$1" expected_id="$2"
  python3 -c '
import json, sys
path, expected_id, expected_code = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    print(f"پاسخ GET پروژه JSON نامعتبر است: {e}", file=sys.stderr)
    sys.exit(1)
if not isinstance(data, dict):
    print("پاسخ GET پروژه باید object باشد.", file=sys.stderr)
    sys.exit(1)
if data.get("id") != expected_id:
    print("id پروژه با انتخاب Fixture هم‌خوان نیست.", file=sys.stderr)
    sys.exit(1)
if data.get("projectCode") != expected_code:
    print(f"projectCode باید {expected_code} باشد.", file=sys.stderr)
    sys.exit(1)
enabled = data.get("projectControlEnabled")
if not isinstance(enabled, bool):
    print("projectControlEnabled باید Boolean معتبر باشد.", file=sys.stderr)
    sys.exit(1)
print("true" if enabled else "false")
' "$file" "$expected_id" "$FIXTURE_CODE"
}

fetch_project() {
  local out="$1"
  curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
    "${API}/projects/${PROJECT_ID}" >"$out"
}

count_wbs_nodes() {
  curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" \
    "${API}/projects/${PROJECT_ID}/control/wbs" >"$WBS_JSON"
  python3 -c '
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
if not isinstance(data, list):
    print("پاسخ WBS باید آرایه باشد.", file=sys.stderr)
    sys.exit(1)
print(len(data))
' "$WBS_JSON"
}

log "Login editor..."
curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -X POST "${API}/auth/login" \
  -d "{\"username\":\"${EDITOR_USER}\",\"password\":\"${EDITOR_PASS}\"}" >/dev/null
CSRF="$(awk '$6=="csrf_token"{print $7}' "$COOKIE_JAR" | tail -1)"
[[ -n "$CSRF" ]] || die "csrf_token missing"

PROJECTS="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF}" "${API}/projects")"
PROJECT_ID="$(printf '%s' "$PROJECTS" | python3 -c '
import json, sys
arr = json.load(sys.stdin)
if not isinstance(arr, list):
    sys.exit(0)
hit = next((p for p in arr if isinstance(p, dict) and p.get("projectCode") == "STG-PC-001"), None)
if hit and hit.get("id"):
    print(hit["id"])
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
  PROJECT_ID="$(printf '%s' "$CREATE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id") or "")')"
fi
[[ -n "$PROJECT_ID" ]] || die "PROJECT_ID unresolved"
log "Fixture project=${PROJECT_ID}"

# ─── 1) GET قبل از Enable ───
log "GET project state before enable..."
fetch_project "$PROJECT_JSON" || die "GET پروژه قبل از Enable شکست خورد."
ENABLED_BEFORE="$(validate_project_state "$PROJECT_JSON" "$PROJECT_ID")" \
  || die "اعتبارسنجی وضعیت پروژه قبل از Enable شکست خورد."

if [[ "$ENABLED_BEFORE" == "true" ]]; then
  log "Project Control already enabled — skip enable."
  ENABLE_PATH="skipped"
else
  # ─── 2) فقط اگر false بود Enable کن ───
  log "Project Control disabled — calling enable..."
  set +e
  ENABLE_HTTP="$(curl -sS -o "$ENABLE_BODY" -w '%{http_code}' \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: ${CSRF}" \
    -X POST "${API}/projects/${PROJECT_ID}/control/enable" \
    -d '{"title":"Staging Control Plan","statusDate":"1405/04/25"}')"
  ENABLE_CURL_RC=$?
  set -e
  [[ "$ENABLE_CURL_RC" -eq 0 ]] || die "Enable: درخواست HTTP شکست خورد (curl exit=${ENABLE_CURL_RC})."

  if [[ "$ENABLE_HTTP" == "200" || "$ENABLE_HTTP" == "201" || "$ENABLE_HTTP" == "204" ]]; then
    fetch_project "$PROJECT_JSON" || die "GET پس از Enable موفق شکست خورد."
    ENABLED_AFTER="$(validate_project_state "$PROJECT_JSON" "$PROJECT_ID")" \
      || die "اعتبارسنجی پس از Enable شکست خورد."
    [[ "$ENABLED_AFTER" == "true" ]] || die "Enable 2xx بود اما projectControlEnabled هنوز true نیست."
    ENABLE_PATH="enabled"
    log "Enable path=enabled HTTP=${ENABLE_HTTP}"
  elif [[ "$ENABLE_HTTP" == "400" || "$ENABLE_HTTP" == "409" ]]; then
    # ─── 3) Race/Conflict شناخته‌شده فقط با تأیید GET ───
    SAFE_ERR="$(py_log_error_body "$ENABLE_BODY" "$ENABLE_HTTP")"
    log "Enable Conflict candidate: ${SAFE_ERR}"
    if ! fetch_project "$PROJECT_JSON"; then
      die "Enable Conflict و GET مجدد پروژه شکست خورد. ${SAFE_ERR}"
    fi
    ENABLED_AFTER="$(validate_project_state "$PROJECT_JSON" "$PROJECT_ID" 2>/dev/null || true)"
    if [[ "$ENABLED_AFTER" == "true" ]]; then
      ENABLE_PATH="conflict-verified"
      log "Enable path=conflict-verified — projectControlEnabled=true پس از Conflict."
    else
      die "Enable Conflict بود ولی کنترل پروژه هنوز غیرفعال است. ${SAFE_ERR}"
    fi
  else
    SAFE_ERR="$(py_log_error_body "$ENABLE_BODY" "$ENABLE_HTTP")"
    die "Enable failed HTTP ${ENABLE_HTTP}. ${SAFE_ERR}"
  fi
fi

log "Enable path=${ENABLE_PATH}"

# ─── 6) Fixture copy + Dry-run + Manifest ───
docker exec ppm_pc_staging_api mkdir -p /tmp/ppm-import
docker cp "$FIXTURE" ppm_pc_staging_api:/tmp/ppm-import/gantt-fixture.xlsx

log "Dry-run import (strict fixture manifest)..."
set +e
DRY_OUT="$(docker exec ppm_pc_staging_api node dist/modules/project-control/import/cli/import.cli.js \
  --project-id "$PROJECT_ID" \
  --excel /tmp/ppm-import/gantt-fixture.xlsx \
  --dry-run --strict-fixture-manifest --report-json 2>&1)"
DRY_CODE=$?
set -e
echo "$DRY_OUT" | grep -q 'Manifest' || die "Manifest missing in dry-run"
echo "$DRY_OUT" | grep -E '✗' >/dev/null && die "Manifest has failed rows"
[[ "$DRY_CODE" -eq 0 ]] || die "Dry-run failed exit=${DRY_CODE}"

# Parse machine-readable report (not Persian grep for critical counts)
REPORT_JSON="$(printf '%s\n' "$DRY_OUT" | sed -n 's/^IMPORT_PREVIEW_JSON=//p' | tail -n 1)"
[[ -n "$REPORT_JSON" ]] || die "IMPORT_PREVIEW_JSON missing from dry-run output"

python3 - "$REPORT_JSON" <<'PY' || die "Strict fixture manifest validation failed"
import json, sys
report = json.loads(sys.argv[1])
if not report.get("strictFixtureManifest"):
    print("Strict fixture manifest was not produced", file=sys.stderr)
    sys.exit(1)
required_keys = [
    "phaseCount", "break1Count", "sourceRowCount", "periodCount",
    "budgetTotal", "dateMin", "dateMax",
]
keys = set(report.get("manifestCheckKeys") or [])
missing = [k for k in required_keys if k not in keys]
if missing:
    print(
        "Strict fixture manifest was not produced (missing check keys: "
        + ",".join(missing) + ")",
        file=sys.stderr,
    )
    sys.exit(1)
expected = {
    ("manifest", "phaseCount"): 7,
    ("manifest", "break1Count"): 24,
    ("manifest", "sourceRowCount"): 142,
    ("manifest", "periodCount"): 147,
    ("manifest", "budgetTotal"): 929875000000,
    ("manifest", "dateMin"): "1404/09/01",
    ("manifest", "dateMax"): "1406/12/10",
    ("counts", "tasks"): 142,
    ("counts", "totalNodes"): 173,
    ("orphanCount",): 0,
    ("criticalCount",): 0,
}
for path, exp in expected.items():
    cur = report
    for p in path:
        cur = cur[p]
    if cur != exp:
        print(f"Manifest mismatch for {'.'.join(path)} expected={exp} actual={cur}", file=sys.stderr)
        sys.exit(1)
if report.get("canCommit") is not True:
    print("canCommit expected true", file=sys.stderr)
    sys.exit(1)
print("Strict fixture report OK")
PY
log "Dry-run OK — Strict Fixture Manifest counts validated"

# ─── 7) جلوگیری از Duplicate: Skip Commit اگر 174 نود فعال ───
log "Checking active WBS node count before commit..."
ACTIVE_BEFORE="$(count_wbs_nodes)" || die "خواندن WBS قبل از Commit شکست خورد."
log "Active WBS nodes (with root)=${ACTIVE_BEFORE}"

if [[ "$ACTIVE_BEFORE" == "$EXPECTED_NODES_WITH_ROOT" ]]; then
  log "Fixture already committed (active nodes=${ACTIVE_BEFORE}) — skip commit to avoid duplicates."
  COMMIT_PATH="skipped"
else
  log "Commit import (strict fixture + allow-warnings)..."
  set +e
  COMMIT_OUT="$(docker exec ppm_pc_staging_api node dist/modules/project-control/import/cli/import.cli.js \
    --project-id "$PROJECT_ID" \
    --excel /tmp/ppm-import/gantt-fixture.xlsx \
    --commit --allow-warnings --strict-fixture-manifest --report-json 2>&1)"
  COMMIT_CODE=$?
  set -e
  printf '%s\n' "$COMMIT_OUT"
  [[ "$COMMIT_CODE" -eq 0 ]] || die "Commit Import شکست خورد (exit=${COMMIT_CODE})."
  COMMIT_PATH="committed"
fi

ACTIVE_AFTER="$(count_wbs_nodes)" || die "خواندن WBS پس از Commit/Skip شکست خورد."
log "Active WBS nodes after=${ACTIVE_AFTER}"
[[ "$ACTIVE_AFTER" == "$EXPECTED_NODES_WITH_ROOT" ]] \
  || die "انتظار ${EXPECTED_NODES_WITH_ROOT} نود فعال (شامل Root)؛ دریافت شد: ${ACTIVE_AFTER}"

echo "$PROJECT_ID" >"${ARTIFACT_DIR}/staging-project-id.txt"
log "Import Fixture PASSED — enable=${ENABLE_PATH} commit=${COMMIT_PATH} nodes=${ACTIVE_AFTER}"
log "Wrote ${ARTIFACT_DIR}/staging-project-id.txt"
echo "PROJECT_ID=${PROJECT_ID}"
echo "ENABLE_PATH=${ENABLE_PATH}"
echo "COMMIT_PATH=${COMMIT_PATH}"
echo "ACTIVE_NODES=${ACTIVE_AFTER}"
