#!/usr/bin/env bash
# بررسی پیش‌نیازهای Release Candidate کنترل پروژه.
set -Eeuo pipefail
# shellcheck source=_common.sh
source "$(cd "$(dirname "$0")" && pwd)/_common.sh"

DRY_RUN=0
has_flag --dry-run "$@" && DRY_RUN=1

log "=== Preflight Advanced Project Control ==="
log "ROOT=${ROOT_DIR}"

warn() { printf '[%s] WARN: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

require_cmd git
require_cmd docker
require_cmd curl
require_cmd df
# free فقط روی Linux؛ نبودنش روی macOS Fail نیست (پایین بررسی اختیاری می‌شود).

COMMIT="$(current_commit)"
SHORT="$(current_commit_short)"
BRANCH="$(git -C "$ROOT_DIR" branch --show-current || true)"
if [[ -z "$BRANCH" ]]; then
  # Detached HEAD در Worktree Release یک حالت معتبر است.
  log "Branch=(detached HEAD) — معتبر برای Release Worktree"
else
  log "Branch=${BRANCH}"
fi
log "Commit=${COMMIT} (short=${SHORT})"

if [[ -n "$BRANCH" && "$BRANCH" != "feature/advanced-project-control-wbs-gantt" ]]; then
  warn "Branch مورد انتظار feature/advanced-project-control-wbs-gantt نیست (فعلی: ${BRANCH})."
fi

if working_tree_clean; then
  log "Working tree: CLEAN"
else
  die "Working tree تمیز نیست. قبل از Release Commit کنید یا stash کنید."
fi

docker info >/dev/null 2>&1 || die "Docker Daemon در دسترس نیست."
docker compose version >/dev/null 2>&1 || die "Docker Compose در دسترس نیست."
log "Docker: OK"

# Disk / Memory (بهترین تلاش)
DISK_AVAIL_GB="$(df -Pk "$ROOT_DIR" | awk 'NR==2 {printf "%.0f", $4/1024/1024}')"
log "Disk available (GB): ${DISK_AVAIL_GB}"
[[ "${DISK_AVAIL_GB}" -ge 5 ]] || die "فضای دیسک کمتر از ۵GB است."

if command -v free >/dev/null 2>&1; then
  MEM_MB="$(free -m | awk '/^Mem:/{print $7}')"
  log "Memory available (MB): ${MEM_MB}"
elif [[ "$(uname -s)" == "Darwin" ]]; then
  log "Memory: macOS (free CLI absent) — skipped numeric check"
fi

# Ports (Staging)
for p in 18080 18443 15432; do
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
    warn "پورت ${p} در حال استفاده است (ممکن است Staging قبلی باشد)."
  else
    log "Port ${p}: free (or uncheckable)"
  fi
done

# Env staging template
[[ -f "$ROOT_DIR/.env.staging.example" ]] || die ".env.staging.example یافت نشد."
if [[ -f "$ROOT_DIR/.env.staging" ]]; then
  log ".env.staging: present (values not printed)"
  # shellcheck disable=SC1091
  set -a; source "$ROOT_DIR/.env.staging"; set +a
  for v in POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET COOKIE_SECRET API_IMAGE WEB_IMAGE; do
    log "Env ${v}: $(mask_secret "${!v:-}")"
  done
  [[ "${API_IMAGE:-}" != *":latest" ]] || die "API_IMAGE نباید latest باشد."
  [[ "${WEB_IMAGE:-}" != *":latest" ]] || die "WEB_IMAGE نباید latest باشد."
else
  warn ".env.staging وجود ندارد — قبل از deploy-staging بسازید."
fi

# Java / MPXJ (اختیاری برای Excel-only) — نبود Java نباید Preflight را Fail کند
if command -v java >/dev/null 2>&1; then
  log "Java: $(java -version 2>&1 | head -1)"
else
  warn "Java یافت نشد — Import MPP در Staging محدود می‌شود؛ Excel مستقل مجاز است."
fi

# Current containers (اطلاعاتی)
log "Containers matching ppm_pc_staging / ppm:"
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'ppm|staging' || log "(none)"

# Backup dir
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/staging}"
mkdir -p "$BACKUP_DIR"
log "Backup dir: ${BACKUP_DIR}"

# DB connectivity (optional if staging up)
if docker ps --format '{{.Names}}' | grep -q 'ppm_pc_staging_postgres'; then
  log "Staging postgres container is running — connectivity check via docker exec"
  docker exec ppm_pc_staging_postgres pg_isready -U "${POSTGRES_USER:-ppm_staging_user}" \
    -d "${POSTGRES_DB:-ppm_project_control_staging}" >/dev/null \
    && log "PostgreSQL: ready" \
    || die "PostgreSQL Staging آماده نیست."
  PG_VER="$(docker exec ppm_pc_staging_postgres postgres --version || true)"
  log "PostgreSQL version: ${PG_VER}"
  echo "$PG_VER" | grep -q '18' || warn "نسخه PostgreSQL 18 تأیید نشد."
else
  log "Staging postgres هنوز بالا نیست (طبیعی قبل از deploy)."
fi

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY-RUN: preflight فقط گزارش داد."
fi

log "Preflight PASSED"
exit 0
