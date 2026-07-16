#!/usr/bin/env bash
# Deploy Staging از GitHub Actions روی سرور — بدون Build محلی، بدون latest.
# ورودی‌های محیطی (از SSH/CI):
#   FULL_SHA, API_IMAGE, WEB_IMAGE, GHCR_READ_TOKEN, GHCR_USERNAME
#   DEPLOY_PATH (کلون Git), STAGING_ENV_FILE (پیش‌فرض /opt/ppm/secrets/.env.staging)
#   API_DIGEST / WEB_DIGEST (اختیاری — ترجیح Digest)
set -Eeuo pipefail

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
err() { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { err "$*"; exit 1; }

FULL_SHA="${FULL_SHA:?FULL_SHA required}"
[[ "${#FULL_SHA}" -eq 40 ]] || die "FULL_SHA باید ۴۰ کاراکتر Commit کامل باشد (نه short SHA)."

DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH required}"
STAGING_ENV_FILE="${STAGING_ENV_FILE:-/opt/ppm/secrets/.env.staging}"
WORKTREES_ROOT="${WORKTREES_ROOT:-/opt/ppm/releases/worktrees}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ppm_project_control_staging}"
GHCR_USERNAME="${GHCR_USERNAME:-samanmah}"
STATE_ROOT="${STAGING_RELEASE_STATE_DIR:-/tmp/ppm-releases/project-control}"

API_IMAGE="${API_IMAGE:-ghcr.io/samanmah/mstiddashbord-api:${FULL_SHA}}"
WEB_IMAGE="${WEB_IMAGE:-ghcr.io/samanmah/mstiddashbord-web:${FULL_SHA}}"

# ترجیح Digest در صورت ارسال
if [[ -n "${API_DIGEST:-}" ]]; then
  API_IMAGE="ghcr.io/samanmah/mstiddashbord-api@${API_DIGEST}"
fi
if [[ -n "${WEB_DIGEST:-}" ]]; then
  WEB_IMAGE="ghcr.io/samanmah/mstiddashbord-web@${WEB_DIGEST}"
fi

[[ "${API_IMAGE}" != *":latest" ]] || die "Deploy با latest ممنوع است."
[[ "${WEB_IMAGE}" != *":latest" ]] || die "Deploy با latest ممنوع است."
[[ -f "${STAGING_ENV_FILE}" ]] || die "Staging secrets یافت نشد: ${STAGING_ENV_FILE}"
[[ -d "${DEPLOY_PATH}/.git" ]] || die "DEPLOY_PATH Git repository نیست: ${DEPLOY_PATH}"
[[ -n "${GHCR_READ_TOKEN:-}" ]] || die "GHCR_READ_TOKEN لازم است."

export COMPOSE_PROJECT_NAME
export API_IMAGE WEB_IMAGE
export APP_VERSION="${FULL_SHA}" GIT_SHA="${FULL_SHA}"

log "Staging deploy FULL_SHA=${FULL_SHA}"
log "API_IMAGE=${API_IMAGE}"
log "WEB_IMAGE=${WEB_IMAGE}"
log "ENV_FILE=${STAGING_ENV_FILE}"

# 1) fetch دقیق — بدون pull مبهم روی HEAD
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
  # پاکسازی ناقص قبلی
  rm -rf "${WORKTREE}"
  git -C "${DEPLOY_PATH}" worktree add --detach "${WORKTREE}" "${FULL_SHA}"
  log "Created worktree ${WORKTREE}"
fi

[[ -f "${WORKTREE}/compose.production.yml" ]] || die "compose.production.yml در worktree نیست."
[[ -f "${WORKTREE}/compose.staging.yml" ]] || die "compose.staging.yml در worktree نیست."

COMPOSE_FILES=(
  -f "${WORKTREE}/compose.production.yml"
  -f "${WORKTREE}/compose.staging.yml"
)

# 3) ثبت Image قبلی برای Rollback
PREV_API="$(docker inspect --format='{{.Image}}' ppm_pc_staging_api 2>/dev/null || true)"
PREV_WEB="$(docker inspect --format='{{.Image}}' ppm_pc_staging_web 2>/dev/null || true)"
PREV_API_REF="$(docker inspect --format='{{index .Config.Image}}' ppm_pc_staging_api 2>/dev/null || true)"
PREV_WEB_REF="$(docker inspect --format='{{index .Config.Image}}' ppm_pc_staging_web 2>/dev/null || true)"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
STATE_DIR="${STATE_ROOT}/${TS}"
mkdir -p "${STATE_DIR}"

# 4) docker login GHCR (توکن در log چاپ نمی‌شود)
echo "${GHCR_READ_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null
log "GHCR login OK"

# 5) Pull فقط Imageهای این Release
docker pull "${API_IMAGE}"
docker pull "${WEB_IMAGE}"
PULLED_API_ID="$(docker image inspect --format='{{.Id}}' "${API_IMAGE}")"
PULLED_WEB_ID="$(docker image inspect --format='{{.Id}}' "${WEB_IMAGE}")"
log "Pulled API Id=${PULLED_API_ID}"
log "Pulled WEB Id=${PULLED_WEB_ID}"

# 6) Up بدون down -v — Volume Staging حفظ می‌شود
# shellcheck disable=SC1090
set -a; source "${STAGING_ENV_FILE}"; set +a
export API_IMAGE WEB_IMAGE APP_VERSION GIT_SHA COMPOSE_PROJECT_NAME

docker compose "${COMPOSE_FILES[@]}" --env-file "${STAGING_ENV_FILE}" up -d --remove-orphans
# هرگز: docker compose down -v

# 7) Health / Liveness exact SHA
log "Waiting for readiness..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:18080/api/v1/health/readiness" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    docker compose "${COMPOSE_FILES[@]}" --env-file "${STAGING_ENV_FILE}" logs --tail=100 api || true
    die "Staging readiness FAILED"
  fi
  sleep 3
done
log "readiness PASS"

LIVE="$(curl -fsS "http://127.0.0.1:18080/api/v1/health/liveness")"
echo "${LIVE}" | grep -q '"status":"ok"' || die "liveness status not ok: ${LIVE}"
echo "${LIVE}" | grep -Fq "\"gitSha\":\"${FULL_SHA}\"" \
  || die "liveness gitSha باید دقیقاً ${FULL_SHA} باشد. got=${LIVE}"
log "liveness PASS gitSha=${FULL_SHA}"

# 8) Image ID کانتینر = Image Pull‌شده
RUNNING_API_ID="$(docker inspect --format='{{.Image}}' ppm_pc_staging_api)"
RUNNING_WEB_ID="$(docker inspect --format='{{.Image}}' ppm_pc_staging_web)"
[[ "${RUNNING_API_ID}" == "${PULLED_API_ID}" ]] || die "API container Image Id mismatch"
[[ "${RUNNING_WEB_ID}" == "${PULLED_WEB_ID}" ]] || die "WEB container Image Id mismatch"
log "container Image Id match PASS"

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
