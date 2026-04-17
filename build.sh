#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

LOAD_ENV="${LOAD_ENV:-1}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ "${LOAD_ENV}" == "1" && -f "${ENV_FILE}" ]]; then
  set +e
  set +u
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  set -u
  set -e
fi

DRY_RUN="${DRY_RUN:-0}"
REPO_NAME="${1:-${REPO_NAME:-${CODEUP_REPO_NAME:-}}}"
THEME_NAME="${2:-${THEME_NAME:-${BUILD_THEME:-}}}"
BUILD_THEMES="${BUILD_THEMES:-${APAYSHOP_BUILD_THEMES:-}}"
OUTPUT_DIR="${OUTPUT_DIR:-}"

mask_cmd() {
  local s="$*"
  echo "${s}" | sed -E 's#(https?://)([^/@:]+):([^@]+)@#\1\2:***@#g'
}

restore_themes() {
  if [[ -n "${PUBLISH_EXCLUDED_THEMES_DIR:-}" && -d "${PUBLISH_EXCLUDED_THEMES_DIR}" ]]; then
    shopt -s nullglob
    for d in "${PUBLISH_EXCLUDED_THEMES_DIR}"/*; do
      if [[ -d "${d}" ]]; then
        mv "${d}" "app/themes/"
      fi
    done
    shopt -u nullglob
    rmdir "${PUBLISH_EXCLUDED_THEMES_DIR}" 2>/dev/null || true
  fi
}

filter_themes_for_build() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    return 0
  fi

  local themes_dir="app/themes"
  if [[ ! -d "${themes_dir}" ]]; then
    return 0
  fi

  local allow="${BUILD_THEMES}"
  if [[ -z "${allow}" && -n "${THEME_NAME}" ]]; then
    allow="default,${THEME_NAME}"
  fi

  if [[ -z "${allow}" ]]; then
    return 0
  fi

  allow="${allow// /}"
  if [[ ",${allow}," != *",default,"* ]]; then
    allow="default,${allow}"
  fi

  local excluded_dir=".publish_excluded_themes.$$"
  mkdir -p "${excluded_dir}"
  PUBLISH_EXCLUDED_THEMES_DIR="${excluded_dir}"
  trap restore_themes EXIT

  local keep_csv=",${allow},"
  shopt -s nullglob
  for d in "${themes_dir}"/*; do
    local name
    name="$(basename "${d}")"
    if [[ "${keep_csv}" != *",${name},"* ]]; then
      mv "${d}" "${excluded_dir}/"
    fi
  done
  shopt -u nullglob
}

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "+ $(mask_cmd "$*")"
    return 0
  fi
  "$@"
}

if [[ -z "${REPO_NAME}" ]]; then
  echo "missing repo name"
  echo "usage: ./build.sh <repo-name> [theme-name]"
  exit 1
fi

REPO_NAME="${REPO_NAME%.git}"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="build/${REPO_NAME}"
fi

copy_dir() {
  local src="$1"
  local dst="$2"

  if command -v rsync >/dev/null 2>&1; then
    run rsync -a --delete "${src%/}/" "${dst%/}/"
    return 0
  fi

  run rm -rf "${dst}"
  run mkdir -p "$(dirname "${dst}")"
  run cp -R "${src}" "${dst}"
}

copy_file() {
  local src="$1"
  local dst="$2"
  run mkdir -p "$(dirname "${dst}")"
  run cp -f "${src}" "${dst}"
}

echo "==> Building project"
filter_themes_for_build
run npm run build

if [[ ! -d ".output" ]]; then
  echo ".output not found after build"
  exit 1
fi

echo "==> Preparing output dir: ${OUTPUT_DIR}"
run mkdir -p "${OUTPUT_DIR}"

echo "==> Copying .output"
copy_dir ".output" "${OUTPUT_DIR}/.output"

if [[ -f "Dockerfile" ]]; then
  echo "==> Copying Dockerfile"
  copy_file "Dockerfile" "${OUTPUT_DIR}/Dockerfile"
else
  echo "WARN: Dockerfile not found, skip copy"
fi

if [[ -d "public" ]]; then
  echo "==> Copying public/* to output root"
  run mkdir -p "${OUTPUT_DIR}"
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a "public/" "${OUTPUT_DIR}/"
  else
    run cp -R "public/." "${OUTPUT_DIR}/"
  fi
else
  echo "WARN: public not found, skip copy"
fi

echo "==> Done"
echo "Output: ${OUTPUT_DIR}"
