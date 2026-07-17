#!/usr/bin/env bash
# Deploy Staging از GitHub Actions روی سرور — بدون Build محلی، بدون latest.
#
# فایل ثابت /opt/ppm/secrets/.env.staging فقط Secret است.
# مقادیر Release-specific (API_IMAGE/WEB_IMAGE/APP_VERSION/GIT_SHA/...) از طریق
# Release env موقت Override می‌شوند و فایل ثابت ویرایش نمی‌شود.
#
# ورودی‌ها: FULL_SHA, API_DIGEST, WEB_DIGEST, GHCR_READ_TOKEN, GHCR_USERNAME,
#           DEPLOY_PATH, STAGING_ENV_FILE
set -Eeuo pipefail

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
err() { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { err "$*"; exit 1; }

FULL_SHA="${FULL_SHA:?FULL_SHA required}"
[[ "${#FULL_SHA}" -eq 40 ]] || die "FULL_SHA باید ۴۰ کاراکتر Commit کامل باشد (نه short SHA)."
API_DIGEST="${API_DIGEST:?API_DIGEST required}"
WEB_DIGEST="${WEB_DIGEST:?WEB_DIGEST required}"
# normalize digest prefix
[[ "${API_DIGEST}" == sha256:* ]] || API_DIGEST="sha256:${API_DIGEST}"
[[ "${WEB_DIGEST}" == sha256:* ]] || WEB_DIGEST="sha256:${WEB_DIGEST}"

DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH required}"
STAGING_ENV_FILE="${STAGING_ENV_FILE:-/opt/ppm/secrets/.env.staging}"
WORKTREES_ROOT="${WORKTREES_ROOT:-/opt/ppm/releases/worktrees}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ppm_project_control_staging}"
GHCR_USERNAME="${GHCR_USERNAME:-samanmah}"
STATE_ROOT="${STAGING_RELEASE_STATE_DIR:-/tmp/ppm-releases/project-control}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

API_IMAGE="ghcr.io/samanmah/mstiddashbord-api@${API_DIGEST}"
WEB_IMAGE="ghcr.io/samanmah/mstiddashbord-web@${WEB_DIGEST}"

[[ "${API_IMAGE}" != *":latest" ]] || die "Deploy با latest ممنوع است."
[[ "${WEB_IMAGE}" != *":latest" ]] || die "Deploy با latest ممنوع است."
[[ -f "${STAGING_ENV_FILE}" ]] || die "Staging secrets یافت نشد: ${STAGING_ENV_FILE}"
[[ -d "${DEPLOY_PATH}/.git" ]] || die "DEPLOY_PATH Git repository نیست: ${DEPLOY_PATH}"
[[ -n "${GHCR_READ_TOKEN:-}" ]] || die "GHCR_READ_TOKEN لازم است."
command -v python3 >/dev/null 2>&1 || die "python3 برای build-release-env لازم است."

export COMPOSE_PROJECT_NAME

log "Staging deploy FULL_SHA=${FULL_SHA}"
log "API_IMAGE=${API_IMAGE}"
log "WEB_IMAGE=${WEB_IMAGE}"
log "SECRET_ENV_FILE=${STAGING_ENV_FILE} (not mutated)"

# 1) fetch دقیق
git -C "${DEPLOY_PATH}" fetch --prune origin
git -C "${DEPLOY_PATH}" cat-file -t "${FULL_SHA}" >/dev/null 2>&1 \
  || die "Commit ${FULL_SHA} در مخزن سرور یافت نشد (fetch لازم است)."

# 2) worktree دقیق همان SHA
WORKTREE="${WORKTREES_ROOT}/${FULL_SHA}"
mkdir -p "${WORKTREES_ROOT}"
if [[ -d "${WORKTREE}/.git" ]] || [[ -f "${WORKTREE}/.git" ]]; then
  CURRENT="$(git -C "${WORKTREE}" rev-parse HEAD)"
  [[ "${CURRENT}" == "${FULL_SHA}" ]] || die "Worktree موجود با SHA متفاوت است: ${CURRENT}"
  log "Reusing worktree ${WORKTREE}"
else
  rm -rf "${WORKTREE}"
  git -C "${DEPLOY_PATH}" worktree add --detach "${WORKTREE}" "${FULL_SHA}"
  log "Created worktree ${WORKTREE}"
fi

[[ -f "${WORKTREE}/compose.production.yml" ]] || die "compose.production.yml در worktree نیست."
[[ -f "${WORKTREE}/compose.staging.yml" ]] || die "compose.staging.yml در worktree نیست."

HELPER_DIR="${WORKTREE}/infrastructure/scripts/project-control"
[[ -f "${HELPER_DIR}/build-release-env.py" ]] || HELPER_DIR="${SCRIPT_DIR}"
[[ -f "${HELPER_DIR}/assert-compose-release.py" ]] || die "assert-compose-release.py یافت نشد"

# Release env موقت — فایل ثابت Secret ویرایش نمی‌شود
RELEASE_ENV="$(mktemp)"
chmod 600 "${RELEASE_ENV}"
cleanup() { rm -f "${RELEASE_ENV}"; }
trap cleanup EXIT

BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 "${HELPER_DIR}/build-release-env.py" \
  --base "${STAGING_ENV_FILE}" \
  --out "${RELEASE_ENV}" \
  --set "API_IMAGE=${API_IMAGE}" \
  --set "WEB_IMAGE=${WEB_IMAGE}" \
  --set "APP_VERSION=${FULL_SHA}" \
  --set "GIT_SHA=${FULL_SHA}" \
  --set "BUILD_DATE=${BUILD_DATE}" \
  --set "RUN_SEED_ON_START=false" \
  >/dev/null

COMPOSE_FILES=(
  -f "${WORKTREE}/compose.production.yml"
  -f "${WORKTREE}/compose.staging.yml"
)

compose() {
  docker compose "${COMPOSE_FILES[@]}" --env-file "${RELEASE_ENV}" "$@"
}

# 3) ثبت Image قبلی برای Rollback
PREV_API="$(docker inspect --format='{{.Image}}' ppm_pc_staging_api 2>/dev/null || true)"
PREV_WEB="$(docker inspect --format='{{.Image}}' ppm_pc_staging_web 2>/dev/null || true)"
PREV_API_REF="$(docker inspect --format='{{index .Config.Image}}' ppm_pc_staging_api 2>/dev/null || true)"
PREV_WEB_REF="$(docker inspect --format='{{index .Config.Image}}' ppm_pc_staging_web 2>/dev/null || true)"

TS="$(date -u +%Y%m%dT%H:%M%SZ)"
STATE_DIR="${STATE_ROOT}/${TS}"
mkdir -p "${STATE_DIR}"

# 4) docker login GHCR
echo "${GHCR_READ_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null
log "GHCR login OK"

# 5) Pull digest images
docker pull "${API_IMAGE}"
docker pull "${WEB_IMAGE}"
PULLED_API_ID="$(docker image inspect --format='{{.Id}}' "${API_IMAGE}")"
PULLED_WEB_ID="$(docker image inspect --format='{{.Id}}' "${WEB_IMAGE}")"
log "Pulled API Id=${PULLED_API_ID}"
log "Pulled WEB Id=${PULLED_WEB_ID}"

# 6) Assert effective compose config BEFORE changing containers
log "Asserting compose effective config..."
compose config --format json \
  | python3 "${HELPER_DIR}/assert-compose-release.py" \
    --api-image "${API_IMAGE}" \
    --web-image "${WEB_IMAGE}" \
    --full-sha "${FULL_SHA}"
log "compose config ASSERT PASS"

# 7) Ensure postgres healthy (volumes preserved — never down -v)
compose up -d --no-deps postgres
for i in $(seq 1 40); do
  if docker exec ppm_pc_staging_postgres pg_isready >/dev/null 2>&1; then
    break
  fi
  [[ "$i" -eq 40 ]] && die "Staging postgres not healthy"
  sleep 2
done
log "postgres healthy"

# 8) Force recreate API + WEB
log "Force recreating api + web..."
compose up -d --no-deps --force-recreate api web
# nginx در صورت نیاز
compose up -d --no-deps --force-recreate nginx
# هرگز: docker compose down -v

# 9) Runtime env داخل کانتینر (بدون Secret)
RUNTIME_APP="$(docker exec ppm_pc_staging_api sh -lc 'printf %s "$APP_VERSION"')"
RUNTIME_SHA="$(docker exec ppm_pc_staging_api sh -lc 'printf %s "$GIT_SHA"')"
log "container APP_VERSION=${RUNTIME_APP}"
log "container GIT_SHA=${RUNTIME_SHA}"
[[ "${RUNTIME_APP}" == "${FULL_SHA}" ]] || die "container APP_VERSION != FULL_SHA"
[[ "${RUNTIME_SHA}" == "${FULL_SHA}" ]] || die "container GIT_SHA != FULL_SHA"

# 10) Image ID + Config.Image digest
RUNNING_API_ID="$(docker inspect --format='{{.Image}}' ppm_pc_staging_api)"
RUNNING_WEB_ID="$(docker inspect --format='{{.Image}}' ppm_pc_staging_web)"
[[ "${RUNNING_API_ID}" == "${PULLED_API_ID}" ]] || die "API container Image Id mismatch"
[[ "${RUNNING_WEB_ID}" == "${PULLED_WEB_ID}" ]] || die "WEB container Image Id mismatch"

API_CFG_IMAGE="$(docker inspect --format='{{index .Config.Image}}' ppm_pc_staging_api)"
WEB_CFG_IMAGE="$(docker inspect --format='{{index .Config.Image}}' ppm_pc_staging_web)"
[[ "${API_CFG_IMAGE}" == *"${API_DIGEST}"* || "${API_CFG_IMAGE}" == "${API_IMAGE}" ]] \
  || die "API Config.Image does not reference expected digest"
[[ "${WEB_CFG_IMAGE}" == *"${WEB_DIGEST}"* || "${WEB_CFG_IMAGE}" == "${WEB_IMAGE}" ]] \
  || die "WEB Config.Image does not reference expected digest"
log "container Image Id + Config.Image PASS"

# 11) Health gate
log "Waiting for readiness..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:18080/api/v1/health/readiness" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    compose logs --tail=100 api || true
    die "Staging readiness FAILED"
  fi
  sleep 3
done
log "readiness PASS"

LIVE="$(curl -fsS "http://127.0.0.1:18080/api/v1/health/liveness")"
echo "${LIVE}" | grep -q '"status":"ok"' || die "liveness status not ok: ${LIVE}"
echo "${LIVE}" | grep -Fq "\"gitSha\":\"${FULL_SHA}\"" \
  || die "liveness gitSha باید دقیقاً ${FULL_SHA} باشد. got=${LIVE}"
echo "${LIVE}" | grep -Fq "\"version\":\"${FULL_SHA}\"" \
  || die "liveness version باید دقیقاً ${FULL_SHA} باشد. got=${LIVE}"
log "liveness PASS version=gitSha=${FULL_SHA}"

cat >"${STATE_DIR}/release.env" <<EOF
RELEASE_COMMIT=${FULL_SHA}
API_IMAGE=${API_IMAGE}
WEB_IMAGE=${WEB_IMAGE}
API_IMAGE_ID=${PULLED_API_ID}
WEB_IMAGE_ID=${PULLED_WEB_ID}
PREVIOUS_API_IMAGE=${PREV_API_REF}
PREVIOUS_WEB_IMAGE=${PREV_WEB_REF}
PREVIOUS_API_IMAGE_ID=${PREV_API}
PREVIOUS_WEB_IMAGE_ID=${PREV_WEB}
STAGING_ENV_FILE=${STAGING_ENV_FILE}
WORKTREE=${WORKTREE}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DEPLOYED_BY=github-actions
EOF
log "Release state: ${STATE_DIR}/release.env"
log "Staging Deploy PASSED"
echo "STATE_DIR=${STATE_DIR}"
