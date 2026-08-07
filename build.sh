#!/usr/bin/env bash
set -euo pipefail

# 输入 ./build.sh <repo-name> [theme-name] [sqlite|pg] [version]
DIALECT="${3:-sqlite}"

# 切换到项目根目录
cd "$(dirname "$0")"

# 主题 manifest/loader、Nuxt buildDir 与 .output 是一组共享构建状态。
# 整个脚本必须持有同一把跨进程锁；内部 npm/yarn build 识别环境标记后不重复加锁。
if [[ "${APAY_BUILD_LOCK_HELD:-}" != "1" ]]; then
  exec node scripts/run-with-build-lock.mjs -- bash "$0" "$@"
fi

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
BUILD_THEMES="${BUILD_THEMES:-${APAY_BUILD_THEMES:-}}"
BUILD_VERSION="${4:-${APAY_BUILD_VERSION:-}}"
OUTPUT_DIR="${OUTPUT_DIR:-}"
THEME_MANIFEST_FILE="${THEME_MANIFEST_FILE:-app/generated/theme-manifest.json}"
RELEASE_MANIFEST_FILE="${RELEASE_MANIFEST_FILE:-}"

if [[ "${BUILD_VERSION}" =~ ^[vV][0-9] ]]; then
  BUILD_VERSION="${BUILD_VERSION:1}"
fi

SELECTED_THEMES=",${BUILD_THEMES// /},"
if [[ "${THEME_NAME}" == "qingpu" || "${SELECTED_THEMES}" == *",qingpu,"* ]]; then
  if [[ -z "${BUILD_VERSION}" ]]; then
    echo "missing Qingpu build version"
    echo "usage: ./build.sh <repo-name> qingpu [sqlite|pg] <version>"
    echo "   or: APAY_BUILD_VERSION=<version> ./build.sh <repo-name> qingpu [sqlite|pg]"
    exit 1
  fi
fi

if [[ -n "${BUILD_VERSION}" ]]; then
  if [[ ! "${BUILD_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+.-][0-9A-Za-z.-]+)*$ ]]; then
    echo "invalid build version: ${BUILD_VERSION} (expected SemVer, for example 1.2.3)"
    exit 1
  fi
  export APAY_BUILD_VERSION="${BUILD_VERSION}"
fi

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
  unset APAY_BUILD_THEMES || true
  unset APAY_THEME_MANIFEST || true

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
  export APAY_THEME_MANIFEST="${THEME_MANIFEST_FILE}"
  write_theme_manifest "${allow}"

  if [[ -n "${allow}" ]]; then
    export APAY_BUILD_THEMES="${allow}"
    echo "==> Generating theme build loader: ${allow}"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "+ $(mask_cmd node scripts/generate-theme-build.mjs --themes "${allow}" --manifest "${THEME_MANIFEST_FILE}")"
    else
      node scripts/generate-theme-build.mjs --themes "${allow}" --manifest "${THEME_MANIFEST_FILE}"
    fi
  else
    unset APAY_BUILD_THEMES || true
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
  echo "usage: ./build.sh <repo-name> [theme-name] [sqlite|pg] [version]"
  exit 1
fi

REPO_NAME="${REPO_NAME%.git}"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="../apay-build/${REPO_NAME}"
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
  local version_suffix=""
  if [[ -n "${BUILD_VERSION}" ]]; then
    version_suffix=" v${BUILD_VERSION}"
  fi
  local commit_msg="build: ${REPO_NAME} ${THEME_NAME:-core}${version_suffix} $(date -u +%Y-%m-%dT%H:%M:%SZ)"

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
echo "    APP_VERSION=${BUILD_VERSION:-package.json}"
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

if [[ -f ".output/server/node_modules/libsql/package.json" ]]; then
  echo "==> Verifying standalone libsql runtime"
  run node -e "require('./.output/server/node_modules/libsql')"
fi

echo "==> Restoring default theme build loader"
restore_theme_build_loader
trap - EXIT

echo "==> Preparing output dir: ${OUTPUT_DIR}"
run mkdir -p "${OUTPUT_DIR}"

echo "==> Copying .output"
copy_dir ".output" "${OUTPUT_DIR}/.output"

if [[ -f "resource/GeoLite2-City.mmdb" ]]; then
  echo "==> Copying GeoLite2 database"
  copy_file "resource/GeoLite2-City.mmdb" "${OUTPUT_DIR}/resource/GeoLite2-City.mmdb"
fi

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

# 主题自带的部署资产:主题在自己的 theme.json 里用 deployAssets 声明「哪些文件必须
# 随产物一起发布」(典型:私有表的建表 SQL 与其应用器),核心只按清单原样复制,不认识
# 任何主题的具体内容——与 theme.admin.json 注册后台扩展页是同一套思路。
#
# 路径语义:相对主题根 → 原样落到产物根。qingpu 声明 database + scripts/apply-*.mjs,
# 产物里就是 <artifact>/database 与 <artifact>/scripts/,两者仍是兄弟目录,应用器的
# `__dirname/../database` 相对解析在主题内和产物内都成立,无需按环境改路径。
#
# 为什么必须有这一步:build.sh 产出的是纯产物包(只含 .output/public/资源文件),
# 源码树不在里面。2026-08 事故——qingpu 的建表 SQL 从未随产物发布,线上根本没有
# 文件可执行,任务队列因缺表长期静默停摆。
if [[ -n "${THEME_NAME}" && -f "app/themes/${THEME_NAME}/theme.json" ]]; then
  THEME_DEPLOY_ASSETS="$(node -e '
    const fs = require("node:fs")
    try {
      const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
      const assets = Array.isArray(manifest.deployAssets) ? manifest.deployAssets : []
      // 拒绝绝对路径与向上穿越:清单来自主题,不能让它写到产物目录之外
      process.stdout.write(assets
        .map(entry => String(entry || "").trim())
        .filter(entry => entry && !entry.startsWith("/") && !entry.split("/").includes(".."))
        .join("\n"))
    } catch { process.stdout.write("") }
  ' "app/themes/${THEME_NAME}/theme.json")"
  if [[ -n "${THEME_DEPLOY_ASSETS}" ]]; then
    echo "==> Copying theme deploy assets (${THEME_NAME})"
    while IFS= read -r asset; do
      [[ -n "${asset}" ]] || continue
      src="app/themes/${THEME_NAME}/${asset}"
      dst="${OUTPUT_DIR}/${asset}"
      if [[ -d "${src}" ]]; then
        copy_dir "${src}" "${dst}"
      elif [[ -f "${src}" ]]; then
        run mkdir -p "$(dirname "${dst}")"
        copy_file "${src}" "${dst}"
      else
        echo "ERROR: theme.json deployAssets 声明了不存在的路径: ${src}" >&2
        exit 1
      fi
    done <<< "${THEME_DEPLOY_ASSETS}"
  fi
fi

if [[ -n "${RELEASE_MANIFEST_FILE}" ]]; then
  if [[ ! -f "${RELEASE_MANIFEST_FILE}" ]]; then
    echo "release manifest not found: ${RELEASE_MANIFEST_FILE}"
    exit 1
  fi
  echo "==> Copying release manifest"
  copy_file "${RELEASE_MANIFEST_FILE}" "${OUTPUT_DIR}/release.json"
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
