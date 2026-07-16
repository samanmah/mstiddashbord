#!/usr/bin/env bash
# توابع مشترک اسکریپت‌های Release کنترل پروژه — Secret چاپ نمی‌شود.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

RELEASE_COMMIT_DEFAULT="f39c712c8355b53960d3813ee5107e3853abe7a"
RELEASE_SHORT_DEFAULT="f39c712"
REGISTRY_API_DEFAULT="ghcr.io/samanmah/mstiddashbord-api"
REGISTRY_WEB_DEFAULT="ghcr.io/samanmah/mstiddashbord-web"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
err() { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { err "$*"; exit 1; }

on_error() {
  local line="${1:-?}"
  err "شکست در خط ${line}. Exit."
}
trap 'on_error $LINENO' ERR

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "دستور لازم یافت نشد: $1"
}

confirm_or_die() {
  local prompt="$1"
  if [[ "${ASSUME_YES:-0}" == "1" ]]; then
    log "ASSUME_YES=1 — تأیید خودکار: ${prompt}"
    return 0
  fi
  read -r -p "${prompt} [yes/NO]: " answer
  [[ "${answer}" == "yes" ]] || die "لغو شد."
}

has_flag() {
  local name="$1"
  shift
  for a in "$@"; do
    [[ "$a" == "$name" ]] && return 0
  done
  return 1
}

get_flag_value() {
  local name="$1"
  shift
  local prev=""
  for a in "$@"; do
    if [[ "$prev" == "$name" ]]; then
      printf '%s' "$a"
      return 0
    fi
    prev="$a"
  done
  return 1
}

current_commit() {
  git -C "$ROOT_DIR" rev-parse HEAD
}

current_commit_short() {
  git -C "$ROOT_DIR" rev-parse --short=7 HEAD
}

working_tree_clean() {
  [[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]]
}

mask_secret() {
  # هرگز Secret را چاپ نکن — فقط طول را نشان بده
  local v="${1:-}"
  if [[ -z "$v" ]]; then
    printf '(empty)'
  else
    printf '(set, len=%s)' "${#v}"
  fi
}
