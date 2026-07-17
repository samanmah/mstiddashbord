#!/usr/bin/env bash
# Deploy Production از GitHub Actions روی سرور.
#
# /opt/ppm/.env فقط Secret/runtime پایه است؛ مقادیر Release-specific از طریق
# Release env موقت Override می‌شوند. پس از Health موفق، Release env به
# /opt/ppm/.env منتقل می‌شود.
#
# Compose الزامی (همیشه با --project-name Pin‌شده):
#   <worktree>/compose.production.yml
#   /opt/ppm/compose.server.yml
#   /opt/ppm/compose.runtime-production.yml
#
# Backup/State زیر DEPLOY_PATH (بدون /var/backups، بدون sudo).
# ممنوع: down -v، latest، prune فوری، recreate/restart postgres، حذف Backup قبلی
set -Eeuo pipefail

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
err() { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { err "$*"; exit 1; }

FULL_SHA="${FULL_SHA:?FULL_SHA required}"
[[ "${#FULL_SHA}" -eq 40 ]] || die "FULL_SHA باید ۴۰ کاراکتر باشد."
API_DIGEST="${API_DIGEST:?API_DIGEST required}"
WEB_DIGEST="${WEB_DIGEST:?WEB_DIGEST required}"
[[ "${API_DIGEST}" == sha256:* ]] || API_DIGEST="sha256:${API_DIGEST}"
[[ "${WEB_DIGEST}" == sha256:* ]] || WEB_DIGEST="sha256:${WEB_DIGEST}"

DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH required}"
WORKTREES_ROOT="${WORKTREES_ROOT:-/opt/ppm/releases/worktrees}"
PROD_ENV_FILE="${PROD_ENV_FILE:-/opt/ppm/.env}"
PROD_ENV_RELEASE="${PROD_ENV_RELEASE:-/opt/ppm/releases/env/${FULL_SHA}.env}"
SERVER_COMPOSE="${SERVER_COMPOSE:-/opt/ppm/compose.server.yml}"
RUNTIME_COMPOSE="${RUNTIME_COMPOSE:-/opt/ppm/compose.runtime-production.yml}"
GHCR_USERNAME="${GHCR_USERNAME:-samanmah}"
HEALTH_BASE="${HEALTH_BASE:-http://127.0.0.1:1011}"
STAGING_COMPOSE_PROJECT="${STAGING_COMPOSE_PROJECT:-ppm_project_control_staging}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

API_IMAGE="ghcr.io/samanmah/mstiddashbord-api@${API_DIGEST}"
WEB_IMAGE="ghcr.io/samanmah/mstiddashbord-web@${WEB_DIGEST}"

[[ "${API_IMAGE}" != *":latest" ]] || die "Deploy با latest ممنوع است."
[[ "${WEB_IMAGE}" != *":latest" ]] || die "Deploy با latest ممنوع است."
[[ -n "${GHCR_READ_TOKEN:-}" ]] || die "GHCR_READ_TOKEN لازم است."
[[ -f "${PROD_ENV_FILE}" ]] || die "Production env یافت نشد: ${PROD_ENV_FILE}"
command -v python3 >/dev/null 2>&1 || die "python3 برای build-release-env لازم است."

# ─── مسیر Backup/State زیر DEPLOY_PATH (بدون /var/backups، بدون sudo) ───
test -d "${DEPLOY_PATH}" || die "DEPLOY_PATH موجود نیست: ${DEPLOY_PATH}"
test -w "${DEPLOY_PATH}" || die "DEPLOY_PATH قابل نوشتن نیست: ${DEPLOY_PATH}"

BACKUP_ROOT="${BACKUP_ROOT:-${DEPLOY_PATH}/backups/production}"
case "${BACKUP_ROOT}" in
  /var/backups|/var/backups/*)
    die "BACKUP_ROOT زیر /var/backups مجاز نیست (Permission denied روی کاربر Deploy)."
    ;;
esac

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}-${FULL_SHA}"
STATE_DIR="${DEPLOY_PATH}/releases/state/${FULL_SHA}/${TIMESTAMP}"
BACKUP_FILE="${BACKUP_DIR}/production-${FULL_SHA}.dump"

install -d -m 700 "${BACKUP_ROOT}"
install -d -m 700 "${BACKUP_DIR}"
install -d -m 700 "${STATE_DIR}"
install -d -m 700 "$(dirname "${PROD_ENV_RELEASE}")"

WRITE_TEST="${BACKUP_ROOT}/.write-test-${FULL_SHA}-$$"
: > "${WRITE_TEST}" || die "BACKUP_ROOT قابل نوشتن نیست — Deploy قبل از هر تغییر متوقف شد: ${BACKUP_ROOT}"
rm -f "${WRITE_TEST}"
log "Writable path ASSERT PASS backupRoot=${BACKUP_ROOT}"

git -C "${DEPLOY_PATH}" fetch --prune origin
git -C "${DEPLOY_PATH}" cat-file -t "${FULL_SHA}" >/dev/null 2>&1 \
  || die "Commit ${FULL_SHA} یافت نشد."

WT="${WORKTREES_ROOT}/${FULL_SHA}"
mkdir -p "${WORKTREES_ROOT}"
if [[ -d "${WT}/.git" ]] || [[ -f "${WT}/.git" ]]; then
  [[ "$(git -C "${WT}" rev-parse HEAD)" == "${FULL_SHA}" ]] \
    || die "Worktree SHA mismatch"
else
  rm -rf "${WT}"
  git -C "${DEPLOY_PATH}" worktree add --detach "${WT}" "${FULL_SHA}"
fi

PROD_COMPOSE="${WT}/compose.production.yml"
[[ -f "${PROD_COMPOSE}" ]] || die "compose.production.yml در worktree نیست."

if [[ ! -f "${SERVER_COMPOSE}" ]]; then
  [[ -f "${WT}/compose.server.yml" ]] || die "compose.server.yml نه روی سرور و نه در worktree"
  mkdir -p "$(dirname "${SERVER_COMPOSE}")"
  cp -a "${WT}/compose.server.yml" "${SERVER_COMPOSE}"
  log "Bootstrapped ${SERVER_COMPOSE} from worktree (first time only)"
fi
if [[ ! -f "${RUNTIME_COMPOSE}" ]]; then
  [[ -f "${WT}/compose.runtime-production.yml" ]] || die "compose.runtime-production.yml نه روی سرور و نه در worktree"
  mkdir -p "$(dirname "${RUNTIME_COMPOSE}")"
  cp -a "${WT}/compose.runtime-production.yml" "${RUNTIME_COMPOSE}"
  log "Bootstrapped ${RUNTIME_COMPOSE} from worktree (first time only)"
fi

HELPER_DIR="${WT}/infrastructure/scripts/project-control"
[[ -f "${HELPER_DIR}/build-release-env.py" ]] || HELPER_DIR="${SCRIPT_DIR}"
[[ -f "${HELPER_DIR}/assert-compose-release.py" ]] || die "assert-compose-release.py یافت نشد"

# Release env موقت از /opt/ppm/.env + Overrideهای Release
RELEASE_ENV="$(mktemp)"
chmod 600 "${RELEASE_ENV}"
cleanup() { rm -f "${RELEASE_ENV}"; }
trap cleanup EXIT

BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Runtime فعلی HTTP را صریحاً حفظ کن (تا HTTPS cutover جداگانه)
python3 "${HELPER_DIR}/build-release-env.py" \
  --base "${PROD_ENV_FILE}" \
  --out "${RELEASE_ENV}" \
  --set "API_IMAGE=${API_IMAGE}" \
  --set "WEB_IMAGE=${WEB_IMAGE}" \
  --set "APP_VERSION=${FULL_SHA}" \
  --set "GIT_SHA=${FULL_SHA}" \
  --set "BUILD_DATE=${BUILD_DATE}" \
  --set "RUN_SEED_ON_START=false" \
  --set "NODE_ENV=development" \
  --set "COOKIE_SECURE=false" \
  >/dev/null

# ─── 1) تشخیص Production Compose Project (قطعیت؛ بدون حدس) ───
read_env_key() {
  # usage: read_env_key FILE KEY — مقدار را چاپ می‌کند؛ caller نباید Secret را log کند
  python3 - "$1" "$2" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
val = ""
for line in open(path, encoding="utf-8"):
    if line.startswith(key + "="):
        val = line.split("=", 1)[1].strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
print(val)
PY
}

discover_compose_project_from_postgres_labels() {
  local cid project service running existing
  local -a projects=()

  while IFS= read -r cid; do
    [[ -n "${cid}" ]] || continue
    running="$(docker inspect --format='{{.State.Running}}' "${cid}" 2>/dev/null || echo false)"
    [[ "${running}" == "true" ]] || continue
    service="$(docker inspect --format='{{index .Config.Labels "com.docker.compose.service"}}' "${cid}" 2>/dev/null || true)"
    [[ "${service}" == "postgres" ]] || continue
    project="$(docker inspect --format='{{index .Config.Labels "com.docker.compose.project"}}' "${cid}" 2>/dev/null || true)"
    [[ -n "${project}" ]] || continue
    [[ "${project}" == "${STAGING_COMPOSE_PROJECT}" ]] && continue
    existing=0
    for existing_project in "${projects[@]+"${projects[@]}"}"; do
      if [[ "${existing_project}" == "${project}" ]]; then
        existing=1
        break
      fi
    done
    [[ "${existing}" -eq 1 ]] && continue
    projects+=("${project}")
  done < <(docker ps -q --filter 'label=com.docker.compose.service=postgres' --filter 'status=running' 2>/dev/null || true)

  if [[ "${#projects[@]}" -eq 0 ]]; then
    die "هیچ PostgreSQL Production در حال اجرا با label service=postgres یافت نشد."
  fi
  if [[ "${#projects[@]}" -gt 1 ]]; then
    die "بیش از یک Production Compose Project محتمل: ${projects[*]} — حدس ممنوع است."
  fi
  printf '%s\n' "${projects[0]}"
}

resolve_production_compose_project() {
  local from_base discovered
  if [[ -n "${PRODUCTION_COMPOSE_PROJECT:-}" ]]; then
    printf '%s\n' "${PRODUCTION_COMPOSE_PROJECT}"
    return 0
  fi
  from_base="$(read_env_key "${PROD_ENV_FILE}" "COMPOSE_PROJECT_NAME")"
  if [[ -n "${from_base}" ]]; then
    printf '%s\n' "${from_base}"
    return 0
  fi
  discovered="$(discover_compose_project_from_postgres_labels)"
  printf '%s\n' "${discovered}"
}

PRODUCTION_COMPOSE_PROJECT="$(resolve_production_compose_project)"
[[ -n "${PRODUCTION_COMPOSE_PROJECT}" ]] || die "PRODUCTION_COMPOSE_PROJECT قطعی نیست."
echo "PRODUCTION_COMPOSE_PROJECT=${PRODUCTION_COMPOSE_PROJECT}"

# ─── 2) Wrapper واحد Compose — تمام عملیات Production فقط از این آرایه ───
COMPOSE=(
  docker compose
  --project-name "${PRODUCTION_COMPOSE_PROJECT}"
  --project-directory "${DEPLOY_PATH}"
  --env-file "${RELEASE_ENV}"
  -f "${WT}/compose.production.yml"
  -f "${DEPLOY_PATH}/compose.server.yml"
  -f "${DEPLOY_PATH}/compose.runtime-production.yml"
)

# ─── 3) Preflight PostgreSQL واقعی (قبل از Backup/Pull/Migration/Recreate) ───
assert_postgres_preflight() {
  local cid="$1"
  local running health project service mounts
  [[ -n "${cid}" ]] || die "POSTGRES_CID خالی است — service postgres در Compose Project یافت نشد."
  docker inspect "${cid}" >/dev/null 2>&1 || die "docker inspect برای postgres شکست خورد."
  running="$(docker inspect --format='{{.State.Running}}' "${cid}")"
  [[ "${running}" == "true" ]] || die "PostgreSQL Running نیست — Deploy قبل از Backup متوقف شد."
  health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{end}}' "${cid}")"
  if [[ -n "${health}" && "${health}" != "healthy" ]]; then
    die "PostgreSQL Health ناسالم است: ${health}"
  fi
  project="$(docker inspect --format='{{index .Config.Labels "com.docker.compose.project"}}' "${cid}")"
  service="$(docker inspect --format='{{index .Config.Labels "com.docker.compose.service"}}' "${cid}")"
  [[ "${project}" == "${PRODUCTION_COMPOSE_PROJECT}" ]] \
    || die "label project mismatch: expected=${PRODUCTION_COMPOSE_PROJECT} got=${project}"
  [[ "${service}" == "postgres" ]] || die "label service اشتباه است: expected=postgres got=${service}"
  # Mount/Volume فقط خوانده می‌شود — تغییر نمی‌کند
  mounts="$(docker inspect --format='{{range .Mounts}}{{.Name}}={{.Destination}};{{end}}' "${cid}" 2>/dev/null || true)"
  log "postgres mounts (read-only inspect)=${mounts}"
  echo "POSTGRES_CONTAINER_ID=${cid}"
  echo "POSTGRES_PROJECT=${project}"
  echo "POSTGRES_SERVICE=${service}"
  echo "POSTGRES_RUNNING=true"
  echo "POSTGRES_HEALTH=${health:-none}"
}

log "Preflight PostgreSQL on project=${PRODUCTION_COMPOSE_PROJECT}..."
POSTGRES_CID="$("${COMPOSE[@]}" ps -q postgres 2>/dev/null || true)"
assert_postgres_preflight "${POSTGRES_CID}"
PRE_DEPLOY_POSTGRES_CID="${POSTGRES_CID}"
POSTGRES_IMAGE="$(docker inspect --format='{{index .Config.Image}}' "${POSTGRES_CID}")"

# ─── 5) State قبل از Deploy ───
log "Capturing previous production state (no secrets logged)..."
API_CTN="$("${COMPOSE[@]}" ps -q api 2>/dev/null || true)"
WEB_CTN="$("${COMPOSE[@]}" ps -q web 2>/dev/null || true)"

PREV_API_REF=""
PREV_WEB_REF=""
PREV_API_ID=""
PREV_WEB_ID=""
if [[ -n "${API_CTN}" ]]; then
  PREV_API_REF="$(docker inspect --format='{{index .Config.Image}}' "${API_CTN}" 2>/dev/null || true)"
  PREV_API_ID="$(docker inspect --format='{{.Image}}' "${API_CTN}" 2>/dev/null || true)"
fi
if [[ -n "${WEB_CTN}" ]]; then
  PREV_WEB_REF="$(docker inspect --format='{{index .Config.Image}}' "${WEB_CTN}" 2>/dev/null || true)"
  PREV_WEB_ID="$(docker inspect --format='{{.Image}}' "${WEB_CTN}" 2>/dev/null || true)"
fi

printf '%s\n' "${PRODUCTION_COMPOSE_PROJECT}" >"${STATE_DIR}/production-compose-project.txt"
printf '%s\n' "${PRE_DEPLOY_POSTGRES_CID}" >"${STATE_DIR}/postgres-container-id.txt"
printf '%s\n' "${POSTGRES_IMAGE}" >"${STATE_DIR}/postgres-image.txt"
printf '%s\n' "${PREV_API_REF}" >"${STATE_DIR}/previous-api-image.txt"
printf '%s\n' "${PREV_WEB_REF}" >"${STATE_DIR}/previous-web-image.txt"
cp -a "${PROD_ENV_FILE}" "${STATE_DIR}/previous-env"
chmod 600 "${STATE_DIR}/previous-env"
{
  printf '%s\n' "${WT}/compose.production.yml"
  printf '%s\n' "${DEPLOY_PATH}/compose.server.yml"
  printf '%s\n' "${DEPLOY_PATH}/compose.runtime-production.yml"
} >"${STATE_DIR}/compose-config-files.txt"
if curl -fsS "${HEALTH_BASE}/api/v1/health/liveness" >"${STATE_DIR}/previous-liveness.json" 2>/dev/null; then
  log "previous-liveness.json captured"
else
  printf '%s\n' '{"status":"unavailable"}' >"${STATE_DIR}/previous-liveness.json"
  log "previous-liveness unavailable before deploy (recorded)"
fi
# سازگاری Rollback با نام‌های قبلی در release.env
cp -a "${STATE_DIR}/previous-env" "${STATE_DIR}/env.previous"
cp -a "${SERVER_COMPOSE}" "${STATE_DIR}/compose.server.yml.previous"
cp -a "${RUNTIME_COMPOSE}" "${STATE_DIR}/compose.runtime-production.yml.previous"
log "Previous API/WEB image refs captured (not logged with secrets)"

# PG_USER / PG_DATABASE فقط از RELEASE_ENV — در Log چاپ نشوند
PG_USER="$(read_env_key "${RELEASE_ENV}" "POSTGRES_USER")"
PG_DATABASE="$(read_env_key "${RELEASE_ENV}" "POSTGRES_DB")"
[[ -n "${PG_USER}" ]] || PG_USER="$(read_env_key "${RELEASE_ENV}" "PG_USER")"
[[ -n "${PG_DATABASE}" ]] || PG_DATABASE="$(read_env_key "${RELEASE_ENV}" "PG_DATABASE")"
[[ -n "${PG_USER}" ]] || die "PG_USER/POSTGRES_USER در RELEASE_ENV یافت نشد."
[[ -n "${PG_DATABASE}" ]] || die "PG_DATABASE/POSTGRES_DB در RELEASE_ENV یافت نشد."

# ─── 4) Backup واقعی Production (قبل از هر تغییر) ───
log "Creating PostgreSQL custom-format backup (previous backups retained)..."
"${COMPOSE[@]}" exec -T postgres \
  pg_dump \
    --username "${PG_USER}" \
    --dbname "${PG_DATABASE}" \
    --format=custom \
  > "${BACKUP_FILE}" \
  || die "pg_dump custom-format FAILED"

test -s "${BACKUP_FILE}" || die "Backup خالی است."

validate_backup_archive() {
  if "${COMPOSE[@]}" exec -T postgres pg_restore --list < "${BACKUP_FILE}" >/dev/null 2>&1; then
    return 0
  fi
  # Fallback: کپی موقت Read-only داخل همان container (Backup روی Host تغییر نمی‌کند)
  local remote="/tmp/ppm-backup-validate-${FULL_SHA}-$$.dump"
  docker cp "${BACKUP_FILE}" "${POSTGRES_CID}:${remote}" \
    || die "کپی موقت Backup برای اعتبارسنجی شکست خورد."
  if ! "${COMPOSE[@]}" exec -T postgres pg_restore --list "${remote}" >/dev/null; then
    "${COMPOSE[@]}" exec -T postgres rm -f "${remote}" >/dev/null 2>&1 || true
    die "pg_restore --list FAILED"
  fi
  "${COMPOSE[@]}" exec -T postgres rm -f "${remote}" >/dev/null 2>&1 || true
}

validate_backup_archive
BACKUP_SHA256="$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')"
printf '%s\n' "${BACKUP_FILE}" >"${STATE_DIR}/backup-file.txt"
printf '%s\n' "${BACKUP_SHA256}" >"${STATE_DIR}/backup-sha256.txt"

echo "BACKUP_FILE=${BACKUP_FILE}"
echo "BACKUP_SHA256=${BACKUP_SHA256}"
echo "BACKUP_VALID=true"
echo "STATE_DIR=${STATE_DIR}"
log "pg_restore --list PASS"

rollback_full() {
  err "Health failure — full rollback (API+Web+env+compose; postgres untouched)..."
  err "Migration may be forward-only — automatic DB restore NOT performed; backup retained."
  if [[ -n "${PREV_API_REF}" && -n "${PREV_WEB_REF}" ]]; then
    local ROLLBACK_ENV
    ROLLBACK_ENV="$(mktemp)"
    chmod 600 "${ROLLBACK_ENV}"
    python3 "${HELPER_DIR}/build-release-env.py" \
      --base "${STATE_DIR}/previous-env" \
      --out "${ROLLBACK_ENV}" \
      --set "API_IMAGE=${PREV_API_REF}" \
      --set "WEB_IMAGE=${PREV_WEB_REF}" \
      --set "RUN_SEED_ON_START=false" \
      --set "NODE_ENV=development" \
      --set "COOKIE_SECURE=false" \
      >/dev/null || true
    local -a ROLLBACK_COMPOSE=(
      docker compose
      --project-name "${PRODUCTION_COMPOSE_PROJECT}"
      --project-directory "${DEPLOY_PATH}"
      --env-file "${ROLLBACK_ENV}"
      -f "${WT}/compose.production.yml"
      -f "${DEPLOY_PATH}/compose.server.yml"
      -f "${DEPLOY_PATH}/compose.runtime-production.yml"
    )
    "${ROLLBACK_COMPOSE[@]}" up -d --no-deps --force-recreate api web || true
    rm -f "${ROLLBACK_ENV}"
    sleep 20
    if curl -fsS "${HEALTH_BASE}/api/v1/health/readiness" >/dev/null 2>&1; then
      log "Rollback readiness of previous version PASS"
    else
      err "Rollback readiness ALSO failed — manual intervention required"
    fi
  else
    err "Previous image refs missing — cannot auto-rollback"
  fi
  err "Backup retained: ${BACKUP_FILE}"
  err "Backup sha256: ${BACKUP_SHA256}"
  err "Postgres container left unchanged (no recreate/restore)."
}

echo "${GHCR_READ_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null

# ─── 6) Compose effective config (قبل از تغییر Containerها) ───
log "Asserting compose effective config..."
"${COMPOSE[@]}" config --format json \
  | python3 "${HELPER_DIR}/assert-compose-release.py" \
    --api-image "${API_IMAGE}" \
    --web-image "${WEB_IMAGE}" \
    --full-sha "${FULL_SHA}" \
    --project-name "${PRODUCTION_COMPOSE_PROJECT}"
log "compose config ASSERT PASS"

# ─── 8) Pull فقط api/web از همان Compose Project ───
log "Pulling api + web digests via compose..."
"${COMPOSE[@]}" pull api web \
  || { rollback_full; die "compose pull api/web FAILED"; }
PULLED_API_ID="$(docker image inspect --format='{{.Id}}' "${API_IMAGE}")"
PULLED_WEB_ID="$(docker image inspect --format='{{.Id}}' "${WEB_IMAGE}")"

# ─── 7) Migration فقط پس از Backup معتبر (postgres recreate نمی‌شود) ───
log "Running prisma migrate deploy with new API image..."
"${COMPOSE[@]}" run --rm --no-deps \
  api \
  node node_modules/prisma/build/index.js migrate deploy \
  || { rollback_full; die "migrate deploy FAILED"; }

# ─── 8) Deploy فقط API و Web (+ nginx در صورت نیاز) — هرگز postgres ───
log "Force recreating api + web (postgres untouched)..."
"${COMPOSE[@]}" up -d --no-deps --force-recreate api web \
  || { rollback_full; die "compose up api/web FAILED"; }

if [[ -n "$("${COMPOSE[@]}" ps -q nginx 2>/dev/null || true)" ]] \
  || "${COMPOSE[@]}" config --services 2>/dev/null | grep -qx nginx; then
  log "Force recreating nginx (no-deps)..."
  "${COMPOSE[@]}" up -d --no-deps --force-recreate nginx \
    || { rollback_full; die "compose up nginx FAILED"; }
fi

# Runtime env داخل کانتینر
API_CTN="$("${COMPOSE[@]}" ps -q api)"
[[ -n "${API_CTN}" ]] || { rollback_full; die "api container پس از Deploy یافت نشد"; }
RUNTIME_APP="$(docker exec "${API_CTN}" sh -lc 'printf %s "$APP_VERSION"')"
RUNTIME_SHA="$(docker exec "${API_CTN}" sh -lc 'printf %s "$GIT_SHA"')"
log "container APP_VERSION=${RUNTIME_APP}"
log "container GIT_SHA=${RUNTIME_SHA}"
[[ "${RUNTIME_APP}" == "${FULL_SHA}" ]] || { rollback_full; die "container APP_VERSION != FULL_SHA"; }
[[ "${RUNTIME_SHA}" == "${FULL_SHA}" ]] || { rollback_full; die "container GIT_SHA != FULL_SHA"; }

sleep 15
READY_OK=0
for i in $(seq 1 40); do
  if curl -fsS "${HEALTH_BASE}/api/v1/health/readiness" >/dev/null 2>&1; then
    READY_OK=1
    break
  fi
  sleep 3
done
if [[ "${READY_OK}" != "1" ]]; then
  "${COMPOSE[@]}" logs --tail=100 api || true
  rollback_full
  die "Production readiness FAILED after deploy"
fi

LIVE="$(curl -fsS "${HEALTH_BASE}/api/v1/health/liveness")"
if ! echo "${LIVE}" | grep -Fq "\"gitSha\":\"${FULL_SHA}\""; then
  rollback_full
  die "Production liveness gitSha mismatch. expected=${FULL_SHA}"
fi
if ! echo "${LIVE}" | grep -Fq "\"version\":\"${FULL_SHA}\""; then
  rollback_full
  die "Production liveness version mismatch. expected=${FULL_SHA}"
fi
log "Production liveness PASS version=gitSha=${FULL_SHA}"

# ─── 9) Runtime assertions ───
WEB_CTN="$("${COMPOSE[@]}" ps -q web)"
[[ -n "${WEB_CTN}" ]] || { rollback_full; die "web container پس از Deploy یافت نشد"; }
RUNNING_API_ID="$(docker inspect --format='{{.Image}}' "${API_CTN}")"
RUNNING_WEB_ID="$(docker inspect --format='{{.Image}}' "${WEB_CTN}")"
[[ "${RUNNING_API_ID}" == "${PULLED_API_ID}" ]] || { rollback_full; die "API Image Id mismatch"; }
[[ "${RUNNING_WEB_ID}" == "${PULLED_WEB_ID}" ]] || { rollback_full; die "WEB Image Id mismatch"; }

API_CFG_IMAGE="$(docker inspect --format='{{index .Config.Image}}' "${API_CTN}")"
WEB_CFG_IMAGE="$(docker inspect --format='{{index .Config.Image}}' "${WEB_CTN}")"
[[ "${API_CFG_IMAGE}" == *"${API_DIGEST}"* || "${API_CFG_IMAGE}" == "${API_IMAGE}" ]] \
  || { rollback_full; die "API Config.Image digest mismatch"; }
[[ "${WEB_CFG_IMAGE}" == *"${WEB_DIGEST}"* || "${WEB_CFG_IMAGE}" == "${WEB_IMAGE}" ]] \
  || { rollback_full; die "WEB Config.Image digest mismatch"; }

POST_DEPLOY_POSTGRES_CID="$("${COMPOSE[@]}" ps -q postgres 2>/dev/null || true)"
[[ "${POST_DEPLOY_POSTGRES_CID}" == "${PRE_DEPLOY_POSTGRES_CID}" ]] \
  || { rollback_full; die "PostgreSQL container changed: pre=${PRE_DEPLOY_POSTGRES_CID} post=${POST_DEPLOY_POSTGRES_CID}"; }
log "container Image Id + Config.Image PASS; postgres unchanged=${PRE_DEPLOY_POSTGRES_CID}"

# Promote Release env → /opt/ppm/.env (پس از Health موفق)
mkdir -p "$(dirname "${PROD_ENV_RELEASE}")"
cp -a "${RELEASE_ENV}" "${PROD_ENV_RELEASE}"
chmod 600 "${PROD_ENV_RELEASE}"
cp -a "${PROD_ENV_RELEASE}" "${PROD_ENV_FILE}"
chmod 600 "${PROD_ENV_FILE}"
log "Release env promoted to ${PROD_ENV_FILE}"

cat >"${STATE_DIR}/release.env" <<EOF
RELEASE_COMMIT=${FULL_SHA}
API_IMAGE=${API_IMAGE}
WEB_IMAGE=${WEB_IMAGE}
API_IMAGE_ID=${PULLED_API_ID}
WEB_IMAGE_ID=${PULLED_WEB_ID}
PREVIOUS_API_IMAGE=${PREV_API_REF}
PREVIOUS_WEB_IMAGE=${PREV_WEB_REF}
PREVIOUS_API_IMAGE_ID=${PREV_API_ID}
PREVIOUS_WEB_IMAGE_ID=${PREV_WEB_ID}
PREVIOUS_ENV_FILE=${STATE_DIR}/previous-env
PREVIOUS_SERVER_COMPOSE=${STATE_DIR}/compose.server.yml.previous
PREVIOUS_RUNTIME_COMPOSE=${STATE_DIR}/compose.runtime-production.yml.previous
PRODUCTION_COMPOSE_PROJECT=${PRODUCTION_COMPOSE_PROJECT}
PRE_DEPLOY_POSTGRES_CID=${PRE_DEPLOY_POSTGRES_CID}
POST_DEPLOY_POSTGRES_CID=${POST_DEPLOY_POSTGRES_CID}
BACKUP_ROOT=${BACKUP_ROOT}
BACKUP_FILE=${BACKUP_FILE}
BACKUP_SHA256=${BACKUP_SHA256}
WORKTREE=${WT}
PROD_COMPOSE=${PROD_COMPOSE}
SERVER_COMPOSE=${SERVER_COMPOSE}
RUNTIME_COMPOSE=${RUNTIME_COMPOSE}
HEALTH_BASE=${HEALTH_BASE}
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DEPLOYED_BY=github-actions
EOF

log "Production Deploy PASSED"
log "BACKUP_ROOT=${BACKUP_ROOT}"
echo "BACKUP_FILE=${BACKUP_FILE}"
echo "BACKUP_SHA256=${BACKUP_SHA256}"
echo "BACKUP_VALID=true"
echo "STATE_DIR=${STATE_DIR}"
echo "PRODUCTION_COMPOSE_PROJECT=${PRODUCTION_COMPOSE_PROJECT}"
