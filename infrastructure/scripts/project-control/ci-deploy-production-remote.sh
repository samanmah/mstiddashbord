#!/usr/bin/env bash
# Deploy Production از GitHub Actions روی سرور.
#
# /opt/ppm/.env فقط Secret/runtime پایه است؛ مقادیر Release-specific از طریق
# Release env موقت Override می‌شوند. پس از Health موفق، Release env به
# /opt/ppm/.env منتقل می‌شود.
#
# Compose الزامی:
#   <worktree>/compose.production.yml
#   /opt/ppm/compose.server.yml
#   /opt/ppm/compose.runtime-production.yml
#
# Backup/State زیر DEPLOY_PATH (بدون /var/backups، بدون sudo).
# ممنوع: down -v، latest، prune فوری، Rollback فقط API، حذف Backup قبلی
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

WORKTREE="${WORKTREES_ROOT}/${FULL_SHA}"
mkdir -p "${WORKTREES_ROOT}"
if [[ -d "${WORKTREE}/.git" ]] || [[ -f "${WORKTREE}/.git" ]]; then
  [[ "$(git -C "${WORKTREE}" rev-parse HEAD)" == "${FULL_SHA}" ]] \
    || die "Worktree SHA mismatch"
else
  rm -rf "${WORKTREE}"
  git -C "${DEPLOY_PATH}" worktree add --detach "${WORKTREE}" "${FULL_SHA}"
fi

PROD_COMPOSE="${WORKTREE}/compose.production.yml"
[[ -f "${PROD_COMPOSE}" ]] || die "compose.production.yml در worktree نیست."

if [[ ! -f "${SERVER_COMPOSE}" ]]; then
  [[ -f "${WORKTREE}/compose.server.yml" ]] || die "compose.server.yml نه روی سرور و نه در worktree"
  mkdir -p "$(dirname "${SERVER_COMPOSE}")"
  cp -a "${WORKTREE}/compose.server.yml" "${SERVER_COMPOSE}"
  log "Bootstrapped ${SERVER_COMPOSE} from worktree (first time only)"
fi
if [[ ! -f "${RUNTIME_COMPOSE}" ]]; then
  [[ -f "${WORKTREE}/compose.runtime-production.yml" ]] || die "compose.runtime-production.yml نه روی سرور و نه در worktree"
  mkdir -p "$(dirname "${RUNTIME_COMPOSE}")"
  cp -a "${WORKTREE}/compose.runtime-production.yml" "${RUNTIME_COMPOSE}"
  log "Bootstrapped ${RUNTIME_COMPOSE} from worktree (first time only)"
fi

HELPER_DIR="${WORKTREE}/infrastructure/scripts/project-control"
[[ -f "${HELPER_DIR}/build-release-env.py" ]] || HELPER_DIR="${SCRIPT_DIR}"
[[ -f "${HELPER_DIR}/assert-compose-release.py" ]] || die "assert-compose-release.py یافت نشد"

COMPOSE_FILES=(
  -f "${PROD_COMPOSE}"
  -f "${SERVER_COMPOSE}"
  -f "${RUNTIME_COMPOSE}"
)

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

compose() {
  docker compose "${COMPOSE_FILES[@]}" --env-file "${RELEASE_ENV}" "$@"
}

log "Capturing previous production state (no secrets logged)..."
API_CTN="$(docker ps --format '{{.Names}}' | grep -E '(^|_)api$' | grep -v staging | head -1 || true)"
WEB_CTN="$(docker ps --format '{{.Names}}' | grep -E '(^|_)web$' | grep -v staging | head -1 || true)"
[[ -n "${API_CTN}" ]] || API_CTN="$(docker ps --format '{{.Names}}' | grep -i api | grep -v staging | head -1 || true)"
[[ -n "${WEB_CTN}" ]] || WEB_CTN="$(docker ps --format '{{.Names}}' | grep -i web | grep -v staging | head -1 || true)"

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
printf '%s\n' "${PREV_API_REF}" >"${STATE_DIR}/previous-api-image.txt"
printf '%s\n' "${PREV_WEB_REF}" >"${STATE_DIR}/previous-web-image.txt"
cp -a "${PROD_ENV_FILE}" "${STATE_DIR}/previous-env"
chmod 600 "${STATE_DIR}/previous-env"
{
  printf '%s\n' "${PROD_COMPOSE}"
  printf '%s\n' "${SERVER_COMPOSE}"
  printf '%s\n' "${RUNTIME_COMPOSE}"
} >"${STATE_DIR}/compose-files.txt"
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
log "Previous API image ref captured (not logged with secrets)"
log "Previous WEB image ref captured (not logged with secrets)"

# خواندن PG_* از RELEASE_ENV بدون چاپ Secretها
PG_USER="$(python3 -c '
import sys
user, db = "ppm_user", "ppm_db"
for line in open(sys.argv[1], encoding="utf-8"):
    if line.startswith("POSTGRES_USER="):
        user = line.split("=", 1)[1].strip()
    elif line.startswith("POSTGRES_DB="):
        db = line.split("=", 1)[1].strip()
print(user)
' "${RELEASE_ENV}")"
PG_DB="$(python3 -c '
import sys
db = "ppm_db"
for line in open(sys.argv[1], encoding="utf-8"):
    if line.startswith("POSTGRES_DB="):
        db = line.split("=", 1)[1].strip()
print(db)
' "${RELEASE_ENV}")"

log "Creating PostgreSQL custom-format backup (previous backups retained)..."
compose exec -T postgres \
  pg_dump -U "${PG_USER}" -d "${PG_DB}" --format=custom --no-owner --no-acl \
  > "${BACKUP_FILE}" \
  || die "pg_dump custom-format FAILED"

test -s "${BACKUP_FILE}" || die "Backup خالی است."
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "${BACKUP_FILE}" >/dev/null \
    || die "pg_restore --list FAILED"
else
  docker run --rm -v "${BACKUP_FILE}:/tmp/backup.dump:ro" postgres:18-alpine \
    pg_restore --list /tmp/backup.dump >/dev/null \
    || die "pg_restore --list FAILED"
fi
BACKUP_SHA256="$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')"

# خطوط قابل استخراج برای GitHub Actions (حتی در میانهٔ Log)
echo "BACKUP_FILE=${BACKUP_FILE}"
echo "BACKUP_SHA256=${BACKUP_SHA256}"
echo "STATE_DIR=${STATE_DIR}"
log "pg_restore --list PASS"

rollback_full() {
  err "Health failure — full rollback (API+Web+env+compose)..."
  if [[ -n "${PREV_API_REF}" && -n "${PREV_WEB_REF}" ]]; then
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
    docker compose "${COMPOSE_FILES[@]}" --env-file "${ROLLBACK_ENV}" \
      up -d --no-deps --force-recreate api web || true
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
}

echo "${GHCR_READ_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null
docker pull "${API_IMAGE}"
docker pull "${WEB_IMAGE}"
PULLED_API_ID="$(docker image inspect --format='{{.Id}}' "${API_IMAGE}")"
PULLED_WEB_ID="$(docker image inspect --format='{{.Id}}' "${WEB_IMAGE}")"

log "Asserting compose effective config..."
compose config --format json \
  | python3 "${HELPER_DIR}/assert-compose-release.py" \
    --api-image "${API_IMAGE}" \
    --web-image "${WEB_IMAGE}" \
    --full-sha "${FULL_SHA}"
log "compose config ASSERT PASS"

log "Running prisma migrate deploy with new API image..."
compose run --rm --no-deps \
  api \
  node node_modules/prisma/build/index.js migrate deploy \
  || { rollback_full; die "migrate deploy FAILED"; }

log "Force recreating api + web..."
compose up -d --no-deps --force-recreate api web \
  || { rollback_full; die "compose up api/web FAILED"; }

# Runtime env داخل کانتینر
if [[ -n "${API_CTN}" ]] || docker ps --format '{{.Names}}' | grep -E '(^|_)api$' | grep -v staging >/dev/null; then
  NEW_API_CTN="$(docker ps --format '{{.Names}}' | grep -E '(^|_)api$' | grep -v staging | head -1)"
  RUNTIME_APP="$(docker exec "${NEW_API_CTN}" sh -lc 'printf %s "$APP_VERSION"')"
  RUNTIME_SHA="$(docker exec "${NEW_API_CTN}" sh -lc 'printf %s "$GIT_SHA"')"
  log "container APP_VERSION=${RUNTIME_APP}"
  log "container GIT_SHA=${RUNTIME_SHA}"
  [[ "${RUNTIME_APP}" == "${FULL_SHA}" ]] || { rollback_full; die "container APP_VERSION != FULL_SHA"; }
  [[ "${RUNTIME_SHA}" == "${FULL_SHA}" ]] || { rollback_full; die "container GIT_SHA != FULL_SHA"; }
fi

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

NEW_API_CTN="$(docker ps --format '{{.Names}}' | grep -E '(^|_)api$' | grep -v staging | head -1)"
NEW_WEB_CTN="$(docker ps --format '{{.Names}}' | grep -E '(^|_)web$' | grep -v staging | head -1)"
RUNNING_API_ID="$(docker inspect --format='{{.Image}}' "${NEW_API_CTN}")"
RUNNING_WEB_ID="$(docker inspect --format='{{.Image}}' "${NEW_WEB_CTN}")"
[[ "${RUNNING_API_ID}" == "${PULLED_API_ID}" ]] || { rollback_full; die "API Image Id mismatch"; }
[[ "${RUNNING_WEB_ID}" == "${PULLED_WEB_ID}" ]] || { rollback_full; die "WEB Image Id mismatch"; }

API_CFG_IMAGE="$(docker inspect --format='{{index .Config.Image}}' "${NEW_API_CTN}")"
WEB_CFG_IMAGE="$(docker inspect --format='{{index .Config.Image}}' "${NEW_WEB_CTN}")"
[[ "${API_CFG_IMAGE}" == *"${API_DIGEST}"* || "${API_CFG_IMAGE}" == "${API_IMAGE}" ]] \
  || { rollback_full; die "API Config.Image digest mismatch"; }
[[ "${WEB_CFG_IMAGE}" == *"${WEB_DIGEST}"* || "${WEB_CFG_IMAGE}" == "${WEB_IMAGE}" ]] \
  || { rollback_full; die "WEB Config.Image digest mismatch"; }
log "container Image Id + Config.Image PASS"

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
BACKUP_ROOT=${BACKUP_ROOT}
BACKUP_FILE=${BACKUP_FILE}
BACKUP_SHA256=${BACKUP_SHA256}
WORKTREE=${WORKTREE}
PROD_COMPOSE=${PROD_COMPOSE}
SERVER_COMPOSE=${SERVER_COMPOSE}
RUNTIME_COMPOSE=${RUNTIME_COMPOSE}
HEALTH_BASE=${HEALTH_BASE}
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DEPLOYED_BY=github-actions
EOF

log "Production Deploy PASSED"
log "BACKUP_ROOT=${BACKUP_ROOT}"
# تکرار خطوط قابل استخراج در انتهای Log
echo "BACKUP_FILE=${BACKUP_FILE}"
echo "BACKUP_SHA256=${BACKUP_SHA256}"
echo "STATE_DIR=${STATE_DIR}"
