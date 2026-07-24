#!/usr/bin/env bash
set -euo pipefail

# 输入 ./build.sh <repo-name> [theme-name] sqlite|pg
DIALECT="${3:-sqlite}"

# 切换到项目根目录
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
THEME_MANIFEST_FILE="${THEME_MANIFEST_FILE:-app/generated/theme-manifest.json}"

mask_cmd() {
  local s="$*"
  echo "${s}" | sed -E 's#(https?://)([^/@:]+):([^@]+)@#\1\2:***@#g'
}

resolve_build_themes() {
  local allow="${BUILD_THEMES}"
  if [[ -z "${allow}" && -n "${THEME_NAME}" ]]; then
    allow="${THEME_NAME}"
  fi

  allow="${allow// /}"
  allow="${allow#,}"
  allow="${allow%,}"

  echo "${allow}"
}

restore_theme_build_loader() {
  unset APAYSHOP_BUILD_THEMES || true
  unset APAYSHOP_THEME_MANIFEST || true

  write_theme_manifest ""

  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "+ $(mask_cmd node scripts/generate-theme-build.mjs --manifest "${THEME_MANIFEST_FILE}")"
    return 0
  fi

  node scripts/generate-theme-build.mjs --manifest "${THEME_MANIFEST_FILE}" >/dev/null
}

write_theme_manifest() {
  local allow="$1"
  local manifest_dir
  manifest_dir="$(dirname "${THEME_MANIFEST_FILE}")"

  local manifest_json
  if [[ -n "${allow}" ]]; then
    manifest_json="$(node -e "const themes=(process.argv[1]||'').split(',').map(v=>v.trim()).filter(Boolean); console.log(JSON.stringify({ coreTheme: 'core', publishedOptionalThemes: themes, buildMode: 'filtered', generatedAt: new Date().toISOString() }, null, 2))" "${allow}")"
  else
    manifest_json="$(node -e "console.log(JSON.stringify({ coreTheme: 'core', publishedOptionalThemes: [], buildMode: 'core-only', generatedAt: new Date().toISOString() }, null, 2))")"
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "+ mkdir -p ${manifest_dir}"
    echo "+ write ${THEME_MANIFEST_FILE}"
    echo "${manifest_json}"
    return 0
  fi

  mkdir -p "${manifest_dir}"
  printf '%s\n' "${manifest_json}" > "${THEME_MANIFEST_FILE}"
}

prepare_theme_build_loader() {
  local allow
  allow="$(resolve_build_themes)"
  export APAYSHOP_THEME_MANIFEST="${THEME_MANIFEST_FILE}"
  write_theme_manifest "${allow}"

  if [[ -n "${allow}" ]]; then
    export APAYSHOP_BUILD_THEMES="${allow}"
    echo "==> Generating theme build loader: ${allow}"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "+ $(mask_cmd node scripts/generate-theme-build.mjs --themes "${allow}" --manifest "${THEME_MANIFEST_FILE}")"
    else
      node scripts/generate-theme-build.mjs --themes "${allow}" --manifest "${THEME_MANIFEST_FILE}"
    fi
  else
    unset APAYSHOP_BUILD_THEMES || true
    echo "==> Generating theme build loader: core only"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "+ $(mask_cmd node scripts/generate-theme-build.mjs --manifest "${THEME_MANIFEST_FILE}")"
    else
      node scripts/generate-theme-build.mjs --manifest "${THEME_MANIFEST_FILE}"
    fi
  fi

  trap restore_theme_build_loader EXIT
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
  echo "    Copying directory: ${src} -> ${dst}"

  if command -v rsync >/dev/null 2>&1; then
    run rsync -a --delete -v "${src%/}/" "${dst%/}/"
    return 0
  fi

  run rm -rf "${dst}"
  run mkdir -p "$(dirname "${dst}")"
  run cp -R -v "${src}" "${dst}"
}

copy_file() {
  local src="$1"
  local dst="$2"
  echo "    Copying file: ${src} -> ${dst}"
  run mkdir -p "$(dirname "${dst}")"
  run cp -f -v "${src}" "${dst}"
}

commit_output_repo() {
  local dir="$1"
  local commit_msg="build: ${REPO_NAME} ${THEME_NAME:-core} $(date -u +%Y-%m-%dT%H:%M:%SZ)"

  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "+ $(mask_cmd git -C "${dir}" init) (skipped if already a repo)"
    echo "+ $(mask_cmd git -C "${dir}" add -A)"
    echo "+ $(mask_cmd git -C "${dir}" commit -m "${commit_msg}") (skipped if nothing changed)"
    return 0
  fi

  if [[ ! -d "${dir}/.git" ]]; then
    git -C "${dir}" init -q
    echo "    Initialized git repo: ${dir}"
  fi

  git -C "${dir}" add -A

  if git -C "${dir}" diff --cached --quiet; then
    echo "    No changes to commit"
    return 0
  fi

  git -C "${dir}" commit -q -m "${commit_msg}"
  echo "    Committed: ${commit_msg}"
}

echo "==> Building project (dialect: ${DIALECT})"
# Node 默认 old space 上限约 4GB,构建 Nitro server 时会撞上并 OOM
# (FATAL ERROR: Ineffective mark-compacts near heap limit)。这里给一个可覆盖的
# 默认值:内存小的 CI 可用 NODE_OPTIONS=--max-old-space-size=4096 覆盖。
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
echo "    NODE_OPTIONS=${NODE_OPTIONS}"
prepare_theme_build_loader
if [[ "${DIALECT}" == "pg" ]]; then
  run npm run build-pg
else
  run npm run build
fi

if [[ ! -d ".output" ]]; then
  echo ".output not found after build"
  exit 1
fi

echo "==> Restoring default theme build loader"
restore_theme_build_loader
trap - EXIT

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

if [[ -f "${THEME_MANIFEST_FILE}" ]]; then
  echo "==> Copying theme manifest"
  copy_file "${THEME_MANIFEST_FILE}" "${OUTPUT_DIR}/theme-manifest.json"
else
  echo "WARN: theme manifest not found, skip copy"
fi

if [[ -d "public" ]]; then
  echo "==> Copying public/* to output root"
  run mkdir -p "${OUTPUT_DIR}"
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a -v "public/" "${OUTPUT_DIR}/"
  else
    run cp -R -v "public/." "${OUTPUT_DIR}/"
  fi
else
  echo "WARN: public not found, skip copy"
fi

echo "==> Committing build output (${OUTPUT_DIR})"
commit_output_repo "${OUTPUT_DIR}"

echo "==> Done!"
echo "Output directory: ${OUTPUT_DIR}"
echo
echo "You can now preview the build:"
echo "  cd ${OUTPUT_DIR}"
echo "  node .output/server/index.mjs"
