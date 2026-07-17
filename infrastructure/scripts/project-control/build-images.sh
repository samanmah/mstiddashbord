#!/usr/bin/env bash
# ساخت Imageهای نسخه‌دار Commit-based برای Release Candidate.
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

DRY_RUN=0
has_flag --dry-run "$@" && DRY_RUN=1

COMMIT="${RELEASE_COMMIT:-$(get_flag_value --commit "$@" || true)}"
COMMIT="${COMMIT:-$(current_commit)}"
SHORT="$(printf '%s' "$COMMIT" | cut -c1-7)"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
API_TAG="${REGISTRY_API_DEFAULT}:project-control-${SHORT}"
WEB_TAG="${REGISTRY_WEB_DEFAULT}:project-control-${SHORT}"
OUT_DIR="${ROOT_DIR}/artifacts/project-control"
mkdir -p "$OUT_DIR"
STATE_FILE="${OUT_DIR}/images-${SHORT}.env"

log "Build images for commit=${COMMIT} short=${SHORT}"
[[ "$(current_commit)" == "$COMMIT" ]] || die "HEAD ($(current_commit)) با --commit=${COMMIT} یکی نیست. Checkout کنید."
working_tree_clean || die "Working tree تمیز نیست."

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY-RUN: docker build API -> ${API_TAG}"
  log "DRY-RUN: docker build WEB -> ${WEB_TAG}"
  exit 0
fi

require_cmd docker

log "Building API..."
docker build \
  -f apps/api/Dockerfile \
  --build-arg "APP_VERSION=${COMMIT}" \
  --build-arg "GIT_SHA=${COMMIT}" \
  --build-arg "BUILD_DATE=${BUILD_DATE}" \
  -t "${API_TAG}" \
  -t "${REGISTRY_API_DEFAULT}:${SHORT}" \
  .

log "Building Web..."
docker build \
  -f apps/web/Dockerfile \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=/api/v1" \
  --build-arg "APP_VERSION=${COMMIT}" \
  --build-arg "GIT_SHA=${COMMIT}" \
  --build-arg "BUILD_DATE=${BUILD_DATE}" \
  -t "${WEB_TAG}" \
  -t "${REGISTRY_WEB_DEFAULT}:${SHORT}" \
  .

API_ID="$(docker image inspect -f '{{.Id}}' "${API_TAG}")"
WEB_ID="$(docker image inspect -f '{{.Id}}' "${WEB_TAG}")"
API_SIZE="$(docker image inspect -f '{{.Size}}' "${API_TAG}")"
WEB_SIZE="$(docker image inspect -f '{{.Size}}' "${WEB_TAG}")"

cat >"$STATE_FILE" <<EOF
RELEASE_COMMIT=${COMMIT}
API_IMAGE=${API_TAG}
WEB_IMAGE=${WEB_TAG}
API_IMAGE_ID=${API_ID}
WEB_IMAGE_ID=${WEB_ID}
API_IMAGE_SIZE_BYTES=${API_SIZE}
WEB_IMAGE_SIZE_BYTES=${WEB_SIZE}
BUILD_DATE=${BUILD_DATE}
EOF

log "Wrote ${STATE_FILE}"
log "API_IMAGE=${API_TAG} id=${API_ID} size=${API_SIZE}"
log "WEB_IMAGE=${WEB_TAG} id=${WEB_ID} size=${WEB_SIZE}"
log "Build PASSED"
exit 0
