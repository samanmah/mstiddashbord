#!/usr/bin/env bash
# Deploy Production از GitHub Actions روی سرور.
# پیش‌شرط: Verify + Build + Staging + Smoke + E2E سبز + Environment approval.
#
# Compose الزامی (هر سه با هم — فقط compose.production.yml ممنوع):
#   <worktree>/compose.production.yml
#   /opt/ppm/compose.server.yml
#   /opt/ppm/compose.runtime-production.yml
#
# ممنوع: down -v، latest، prune فوری، Rollback فقط API، npm روی سرور.
set -Eeuo pipefail

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
err() { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { err "$*"; exit 1; }

FULL_SHA="${FULL_SHA:?FULL_SHA required}"
[[ "${#FULL_SHA}" -eq 40 ]] || die "FULL_SHA باید ۴۰ کاراکتر باشد."

DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH required}"
WORKTREES_ROOT="${WORKTREES_ROOT:-/opt/ppm/releases/worktrees}"
STATE_ROOT="${PRODUCTION_RELEASE_STATE_DIR:-/opt/ppm/releases/project-control}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ppm/releases}"
PROD_ENV_FILE="${PROD_ENV_FILE:-/opt/ppm/.env}"
PROD_ENV_RELEASE="${PROD_ENV_RELEASE:-/opt/ppm/releases/env/${FULL_SHA}.env}"
SERVER_COMPOSE="${SERVER_COMPOSE:-/opt/ppm/compose.server.yml}"
RUNTIME_COMPOSE="${RUNTIME_COMPOSE:-/opt/ppm/compose.runtime-production.yml}"
GHCR_USERNAME="${GHCR_USERNAME:-samanmah}"
HEALTH_BASE="${HEALTH_BASE:-http://127.0.0.1:1011}"

API_IMAGE="${API_IMAGE:-ghcr.io/samanmah/mstiddashbord-api:${FULL_SHA}}"
WEB_IMAGE="${WEB_IMAGE:-ghcr.io/samanmah/mstiddashbord-web:${FULL_SHA}}"
if [[ -n "${API_DIGEST:-}" ]]; then
  API_IMAGE="ghcr.io/samanmah/mstiddashbord-api@${API_DIGEST}"
fi
if [[ -n "${WEB_DIGEST:-}" ]]; then
  WEB_IMAGE="ghcr.io/samanmah/mstiddashbord-web@${WEB_DIGEST}"
fi

[[ "${API_IMAGE}" != *":latest" ]] || die "Deploy با latest ممنوع است."
[[ "${WEB_IMAGE}" != *":latest" ]] || die "Deploy با latest ممنوع است."
[[ -n "${GHCR_READ_TOKEN:-}" ]] || die "GHCR_READ_TOKEN لازم است."
[[ -f "${PROD_ENV_FILE}" ]] || die "Production env یافت نشد: ${PROD_ENV_FILE}"

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

# Bootstrap overlays فقط اگر روی سرور غایب‌اند — Runtime موجود را Override نکن
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

COMPOSE_FILES=(
  -f "${PROD_COMPOSE}"
  -f "${SERVER_COMPOSE}"
  -f "${RUNTIME_COMPOSE}"
)

TS="$(date -u +%Y%m%dT%H:%M:%SZ)"
STATE_DIR="${STATE_ROOT}/${TS}"
mkdir -p "${STATE_DIR}" "${BACKUP_DIR}" "$(dirname "${PROD_ENV_RELEASE}")"

# ---------- Backup قبل از هر تغییر ----------
log "Backing up current production environment/images..."
cp -a "${PROD_ENV_FILE}" "${STATE_DIR}/env.previous"
cp -a "${SERVER_COMPOSE}" "${STATE_DIR}/compose.server.yml.previous"
cp -a "${RUNTIME_COMPOSE}" "${STATE_DIR}/compose.runtime-production.yml.previous"

# تشخیص نام کانتینر API/Web Production
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
log "Previous API=${PREV_API_REF}"
log "Previous WEB=${PREV_WEB_REF}"

# PostgreSQL custom-format backup
# shellcheck disable=SC1090
set -a; source "${PROD_ENV_FILE}"; set +a
PG_USER="${POSTGRES_USER:-ppm_user}"
PG_DB="${POSTGRES_DB:-ppm_db}"
BACKUP_FILE="${BACKUP_DIR}/ppm_${PG_DB}_${FULL_SHA}_${TS}.dump"

log "Creating PostgreSQL custom-format backup..."
docker compose "${COMPOSE_FILES[@]}" --env-file "${PROD_ENV_FILE}" exec -T postgres \
  pg_dump -U "${PG_USER}" -d "${PG_DB}" -Fc --no-owner --no-acl \
  > "${BACKUP_FILE}" \
  || die "pg_dump custom-format FAILED"

[[ -s "${BACKUP_FILE}" ]] || die "Backup خالی است."
BACKUP_SHA256="$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')"
log "Backup path=${BACKUP_FILE}"
log "Backup sha256=${BACKUP_SHA256}"

# pg_restore --list باید موفق باشد (با Image همان Postgres، بدون وابستگی به ابزار میزبان)
docker run --rm -i postgres:18-alpine pg_restore --list - \
  < "${BACKUP_FILE}" >/tmp/pg_restore_list.txt \
  || die "pg_restore --list FAILED"
[[ -s /tmp/pg_restore_list.txt ]] || die "pg_restore --list خروجی خالی"
LIST_COUNT="$(wc -l < /tmp/pg_restore_list.txt | tr -d ' ')"
[[ "${LIST_COUNT}" -gt 5 ]] || die "Backup TOC خیلی کوچک است (${LIST_COUNT} lines)"
log "pg_restore --list PASS (lines=${LIST_COUNT})"

export API_IMAGE WEB_IMAGE
export APP_VERSION="${FULL_SHA}" GIT_SHA="${FULL_SHA}"
# Runtime فعلی سرور را از env موجود حفظ کن — Override ناگهانی HTTPS نکن
export NODE_ENV="${NODE_ENV:-development}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"

rollback_full() {
  err "Health failure — full rollback (API+Web+env references)..."
  if [[ -n "${PREV_API_REF}" && -n "${PREV_WEB_REF}" ]]; then
    export API_IMAGE="${PREV_API_REF}"
    export WEB_IMAGE="${PREV_WEB_REF}"
    docker compose "${COMPOSE_FILES[@]}" --env-file "${PROD_ENV_FILE}" \
      up -d --no-deps --force-recreate api web || true
    sleep 20
    if curl -fsS "${HEALTH_BASE}/api/v1/health/readiness" >/dev/null 2>&1; then
      log "Rollback readiness of previous version PASS"
    else
      err "Rollback readiness ALSO failed — manual intervention required"
    fi
  else
    err "Previous image refs missing — cannot auto-rollback"
  fi
  # Backup و Imageهای Rollback حذف/prune نمی‌شوند
  err "Backup retained: ${BACKUP_FILE}"
  err "Backup sha256: ${BACKUP_SHA256}"
}

# GHCR login + pull
echo "${GHCR_READ_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null
docker pull "${API_IMAGE}"
docker pull "${WEB_IMAGE}"
PULLED_API_ID="$(docker image inspect --format='{{.Id}}' "${API_IMAGE}")"
PULLED_WEB_ID="$(docker image inspect --format='{{.Id}}' "${WEB_IMAGE}")"

# Migration با همان API Image جدید — قبل از جایگزینی سرویس اصلی
log "Running prisma migrate deploy with new API image..."
docker compose "${COMPOSE_FILES[@]}" --env-file "${PROD_ENV_FILE}" \
  run --rm --no-deps \
  -e API_IMAGE="${API_IMAGE}" \
  api \
  node node_modules/prisma/build/index.js migrate deploy \
  || { rollback_full; die "migrate deploy FAILED"; }

# فقط api + web recreate — دیتابیس حذف نشود
log "Recreating api + web only..."
docker compose "${COMPOSE_FILES[@]}" --env-file "${PROD_ENV_FILE}" \
  up -d --no-deps --force-recreate api web \
  || { rollback_full; die "compose up api/web FAILED"; }

# Health
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
  die "Production liveness gitSha mismatch. expected=${FULL_SHA} got=${LIVE}"
fi
log "Production liveness PASS gitSha=${FULL_SHA}"

RUNNING_API_ID="$(docker inspect --format='{{.Image}}' "$(docker ps --format '{{.Names}}' | grep -E '(^|_)api$' | grep -v staging | head -1)")"
RUNNING_WEB_ID="$(docker inspect --format='{{.Image}}' "$(docker ps --format '{{.Names}}' | grep -E '(^|_)web$' | grep -v staging | head -1)")"
[[ "${RUNNING_API_ID}" == "${PULLED_API_ID}" ]] || { rollback_full; die "API Image Id mismatch"; }
[[ "${RUNNING_WEB_ID}" == "${PULLED_WEB_ID}" ]] || { rollback_full; die "WEB Image Id mismatch"; }

# Release env → /opt/ppm/.env (بدون از بین بردن secrets؛ فقط image/version pin)
{
  grep -vE '^(API_IMAGE|WEB_IMAGE|APP_VERSION|GIT_SHA)=' "${PROD_ENV_FILE}" || true
  echo "API_IMAGE=${API_IMAGE}"
  echo "WEB_IMAGE=${WEB_IMAGE}"
  echo "APP_VERSION=${FULL_SHA}"
  echo "GIT_SHA=${FULL_SHA}"
} > "${PROD_ENV_RELEASE}"
cp -a "${PROD_ENV_RELEASE}" "${PROD_ENV_FILE}"
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
PREVIOUS_ENV_FILE=${STATE_DIR}/env.previous
PREVIOUS_SERVER_COMPOSE=${STATE_DIR}/compose.server.yml.previous
PREVIOUS_RUNTIME_COMPOSE=${STATE_DIR}/compose.runtime-production.yml.previous
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

# هرگز docker image prune -f بلافاصله بعد از Deploy
log "Production Deploy PASSED"
log "STATE_DIR=${STATE_DIR}"
log "BACKUP_FILE=${BACKUP_FILE}"
log "BACKUP_SHA256=${BACKUP_SHA256}"
echo "STATE_DIR=${STATE_DIR}"
echo "BACKUP_FILE=${BACKUP_FILE}"
echo "BACKUP_SHA256=${BACKUP_SHA256}"
