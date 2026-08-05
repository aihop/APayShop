#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="${PROJECT_ROOT}/app/themes/qingpu"
cd "${PROJECT_ROOT}"

for env_file in "${PROJECT_ROOT}/.env" "${PROJECT_ROOT}/.env.publish"; do
  if [[ -f "${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi
done

VERSION="${1:-}"
BUILD_DIALECT="${2:-${BUILD_DIALECT:-pg}}"
DRY_RUN="${DRY_RUN:-0}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"
ALLOW_EMPTY_CHANGELOG="${ALLOW_EMPTY_CHANGELOG:-0}"
CHANGELOG_MAX="${CHANGELOG_MAX:-50}"
OUTPUT_REPO_NAME="${OUTPUT_REPO_NAME:-qingpu-site}"
OUTPUT_DIR="${OUTPUT_DIR:-${PROJECT_ROOT}/../apay-build/${OUTPUT_REPO_NAME}}"
OUTPUT_REMOTE="${OUTPUT_REMOTE:-origin}"
OUTPUT_BRANCH="${OUTPUT_BRANCH:-}"
POSTS_URL="${QINGPU_ADMIN_POSTS_URL:-${QINGPU_SITE_URL:-https://qingpu.ai}/api/admin/posts}"
ADMIN_TOKEN="${QINGPU_ADMIN_TOKEN:-${APAY_ADMIN_TOKEN:-}}"
SLUG_PREFIX="${QINGPU_RELEASE_SLUG_PREFIX:-qingpu-site-}"
PUBLISH_POST="${PUBLISH_POST:-1}"
PUBLISH_PUSH="${PUBLISH_PUSH:-1}"

usage() {
  echo "usage: ./publish.sh <version> [sqlite|pg]"
  echo "example: ./publish.sh 1.2.3 pg"
  echo
  echo "required for version registration: QINGPU_ADMIN_TOKEN"
  echo "optional: OUTPUT_DIR, OUTPUT_REMOTE, OUTPUT_BRANCH, QINGPU_ADMIN_POSTS_URL"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ ! "${CHANGELOG_MAX}" =~ ^[1-9][0-9]*$ ]]; then
  fail "CHANGELOG_MAX must be a positive integer"
fi

if [[ "${ALLOW_DIRTY}" == "1" && "${DRY_RUN}" != "1" ]]; then
  fail "ALLOW_DIRTY=1 is only available with DRY_RUN=1"
fi

if [[ -z "${VERSION}" ]]; then
  usage
  exit 1
fi

if [[ "${VERSION}" =~ ^[vV][0-9] ]]; then
  VERSION="${VERSION:1}"
fi

if [[ ! "${VERSION}" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)([+.-][0-9A-Za-z.-]+)*$ ]]; then
  fail "invalid version '${VERSION}', expected SemVer such as 1.2.3"
fi

VERSION_MAJOR="${BASH_REMATCH[1]}"
VERSION_MINOR="${BASH_REMATCH[2]}"
VERSION_PATCH="${BASH_REMATCH[3]}"
if (( 10#${VERSION_MINOR} > 999 || 10#${VERSION_PATCH} > 999 )); then
  fail "minor and patch versions must be <= 999"
fi
VERSION_CODE=$((10#${VERSION_MAJOR} * 1000000 + 10#${VERSION_MINOR} * 1000 + 10#${VERSION_PATCH}))

case "${BUILD_DIALECT}" in
  sqlite|pg) ;;
  *) fail "build dialect must be sqlite or pg" ;;
esac

for command_name in git jq curl node npm; do
  command -v "${command_name}" >/dev/null 2>&1 || fail "missing required command: ${command_name}"
done

[[ -d "${THEME_DIR}/.git" || -f "${THEME_DIR}/.git" ]] || fail "Qingpu theme is not a Git repository: ${THEME_DIR}"
[[ -d "${OUTPUT_DIR}/.git" ]] || fail "output Git repository not found: ${OUTPUT_DIR}"

if [[ "${ALLOW_DIRTY}" != "1" ]]; then
  ROOT_STATUS="$(git status --porcelain=v1 --untracked-files=all --ignore-submodules=dirty)"
  THEME_STATUS="$(git -C "${THEME_DIR}" status --porcelain=v1 --untracked-files=all)"
  if [[ -n "${ROOT_STATUS}" ]]; then
    echo "APay worktree has uncommitted changes:" >&2
    echo "${ROOT_STATUS}" >&2
    fail "commit APay changes before publishing (or set ALLOW_DIRTY=1 explicitly)"
  fi
  if [[ -n "${THEME_STATUS}" ]]; then
    echo "Qingpu theme worktree has uncommitted changes:" >&2
    echo "${THEME_STATUS}" >&2
    fail "commit Qingpu theme changes before publishing (or set ALLOW_DIRTY=1 explicitly)"
  fi
fi

if [[ -n "$(git -C "${OUTPUT_DIR}" status --porcelain=v1 --untracked-files=all)" ]]; then
  fail "output repository has uncommitted changes: ${OUTPUT_DIR}"
fi

if [[ "${DRY_RUN}" != "1" && "${PUBLISH_PUSH}" == "1" ]]; then
  git -C "${OUTPUT_DIR}" fetch "${OUTPUT_REMOTE}" "${OUTPUT_BRANCH:-$(git -C "${OUTPUT_DIR}" branch --show-current)}"
  REMOTE_HEAD="$(git -C "${OUTPUT_DIR}" rev-parse FETCH_HEAD)"
  LOCAL_HEAD="$(git -C "${OUTPUT_DIR}" rev-parse HEAD)"
  if ! git -C "${OUTPUT_DIR}" merge-base --is-ancestor "${REMOTE_HEAD}" "${LOCAL_HEAD}"; then
    fail "output repository is behind or diverged from ${OUTPUT_REMOTE}; update it before publishing"
  fi
fi

THEME_COMMIT="$(git -C "${THEME_DIR}" rev-parse HEAD)"
APAY_COMMIT="$(git rev-parse HEAD)"
THEME_UPSTREAM="$(git -C "${THEME_DIR}" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [[ -n "${THEME_UPSTREAM}" ]] && ! git -C "${THEME_DIR}" merge-base --is-ancestor "${THEME_COMMIT}" "${THEME_UPSTREAM}"; then
  if [[ "${ALLOW_UNPUSHED_THEME:-0}" != "1" ]]; then
    fail "Qingpu HEAD is not present on ${THEME_UPSTREAM}; push it first or set ALLOW_UNPUSHED_THEME=1"
  fi
fi

PREVIOUS_RELEASE_JSON="$(git -C "${OUTPUT_DIR}" show HEAD:release.json 2>/dev/null || true)"
PREVIOUS_VERSION="$(jq -r '.version // empty' <<< "${PREVIOUS_RELEASE_JSON}" 2>/dev/null || true)"
PREVIOUS_VERSION_CODE="$(jq -r '.versionCode // empty' <<< "${PREVIOUS_RELEASE_JSON}" 2>/dev/null || true)"
PREVIOUS_THEME_COMMIT="$(jq -r '.themeSourceCommit // empty' <<< "${PREVIOUS_RELEASE_JSON}" 2>/dev/null || true)"

if [[ "${PREVIOUS_VERSION_CODE}" =~ ^[0-9]+$ ]] && (( VERSION_CODE < PREVIOUS_VERSION_CODE )); then
  fail "version v${VERSION} is older than the last published v${PREVIOUS_VERSION}"
fi

if [[ "${PREVIOUS_VERSION}" == "${VERSION}" && -n "${PREVIOUS_THEME_COMMIT}" && "${PREVIOUS_THEME_COMMIT}" != "${THEME_COMMIT}" ]]; then
  if [[ "${ALLOW_REPUBLISH_VERSION:-0}" != "1" ]]; then
    fail "v${VERSION} already points to theme commit ${PREVIOUS_THEME_COMMIT}; use a new version or set ALLOW_REPUBLISH_VERSION=1"
  fi
fi

CHANGELOG_FROM="${CHANGELOG_FROM:-}"
CHANGELOG_SOURCE="explicit CHANGELOG_FROM"
if [[ -z "${CHANGELOG_FROM}" ]]; then
  if [[ "${PREVIOUS_VERSION}" == "${VERSION}" ]]; then
    CHANGELOG_FROM="$(jq -r '.changelogFrom // empty' <<< "${PREVIOUS_RELEASE_JSON}" 2>/dev/null || true)"
    CHANGELOG_SOURCE="same-version release retry"
  else
    CHANGELOG_FROM="${PREVIOUS_THEME_COMMIT}"
    CHANGELOG_SOURCE="previous release.json"
  fi
fi

if [[ -z "${CHANGELOG_FROM}" ]]; then
  LAST_OUTPUT_TIME="$(git -C "${OUTPUT_DIR}" log -1 --format='%cI' 2>/dev/null || true)"
  if [[ -n "${LAST_OUTPUT_TIME}" ]]; then
    CHANGELOG_FROM="$(git -C "${THEME_DIR}" rev-list -1 --before="${LAST_OUTPUT_TIME}" HEAD 2>/dev/null || true)"
    CHANGELOG_SOURCE="last output commit time (${LAST_OUTPUT_TIME})"
  fi
fi

if [[ -z "${CHANGELOG_FROM}" ]]; then
  CHANGELOG_FROM="$(git -C "${THEME_DIR}" rev-list --max-count=1 --skip="${CHANGELOG_MAX}" HEAD 2>/dev/null || true)"
  CHANGELOG_SOURCE="latest ${CHANGELOG_MAX} commits fallback"
fi

if [[ -n "${CHANGELOG_FROM}" ]]; then
  git -C "${THEME_DIR}" cat-file -e "${CHANGELOG_FROM}^{commit}" 2>/dev/null \
    || fail "changelog base commit does not exist: ${CHANGELOG_FROM}"
  git -C "${THEME_DIR}" merge-base --is-ancestor "${CHANGELOG_FROM}" "${THEME_COMMIT}" \
    || fail "changelog base ${CHANGELOG_FROM} is not an ancestor of ${THEME_COMMIT}"
  CHANGELOG_RANGE="${CHANGELOG_FROM}..${THEME_COMMIT}"
else
  CHANGELOG_RANGE="${THEME_COMMIT}"
fi

TOTAL_COMMITS="$(git -C "${THEME_DIR}" rev-list --count --no-merges "${CHANGELOG_RANGE}")"
if [[ "${TOTAL_COMMITS}" == "0" && "${ALLOW_EMPTY_CHANGELOG}" != "1" ]]; then
  fail "no Qingpu commits found after ${CHANGELOG_FROM:-repository start}; nothing to publish"
fi

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/apay-qingpu-publish.XXXXXX")"
cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

COMMITS_FILE="${TEMP_DIR}/commits.jsonl"
NOTES_FILE="${TEMP_DIR}/release-notes.txt"
CONTENT_FILE="${TEMP_DIR}/release-content.html"
: > "${COMMITS_FILE}"
: > "${NOTES_FILE}"
: > "${CONTENT_FILE}"

while IFS=$'\x1f' read -r commit_hash short_hash committed_at subject; do
  [[ -n "${commit_hash}" ]] || continue
  jq -cn \
    --arg hash "${commit_hash}" \
    --arg shortHash "${short_hash}" \
    --arg committedAt "${committed_at}" \
    --arg subject "${subject}" \
    '{hash:$hash,shortHash:$shortHash,committedAt:$committedAt,subject:$subject}' >> "${COMMITS_FILE}"
  printf -- '- %s (%s)\n' "${subject}" "${short_hash}" >> "${NOTES_FILE}"
  escaped_subject="$(printf '%s' "${subject}" | jq -Rr '@html')"
  printf '<p>%s (%s)</p>\n' "${escaped_subject}" "${short_hash}" >> "${CONTENT_FILE}"
done < <(git -C "${THEME_DIR}" log --no-merges -n "${CHANGELOG_MAX}" --pretty=tformat:'%H%x1f%h%x1f%cI%x1f%s' "${CHANGELOG_RANGE}")

if [[ ! -s "${NOTES_FILE}" ]]; then
  printf -- '- 常规构建更新\n' > "${NOTES_FILE}"
  printf '<p>常规构建更新</p>\n' > "${CONTENT_FILE}"
fi

if (( TOTAL_COMMITS > CHANGELOG_MAX )); then
  printf -- '- 另有 %d 条较早提交未展开\n' "$((TOTAL_COMMITS - CHANGELOG_MAX))" >> "${NOTES_FILE}"
  printf '<p>另有 %d 条较早提交未展开</p>\n' "$((TOTAL_COMMITS - CHANGELOG_MAX))" >> "${CONTENT_FILE}"
fi

COMMITS_JSON="$(jq -s '.' "${COMMITS_FILE}")"
PUBLISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RELEASE_MANIFEST="${TEMP_DIR}/release.json"
jq -n \
  --arg version "${VERSION}" \
  --argjson versionCode "${VERSION_CODE}" \
  --arg theme "qingpu" \
  --arg themeSourceCommit "${THEME_COMMIT}" \
  --arg apaySourceCommit "${APAY_COMMIT}" \
  --arg changelogFrom "${CHANGELOG_FROM}" \
  --arg changelogSource "${CHANGELOG_SOURCE}" \
  --arg publishedAt "${PUBLISHED_AT}" \
  --argjson commits "${COMMITS_JSON}" \
  '{version:$version,versionCode:$versionCode,theme:$theme,themeSourceCommit:$themeSourceCommit,apaySourceCommit:$apaySourceCommit,changelogFrom:(if ($changelogFrom | length) > 0 then $changelogFrom else null end),changelogSource:$changelogSource,publishedAt:$publishedAt,commits:$commits}' \
  > "${RELEASE_MANIFEST}"

OUTPUT_REMOTE_URL="$(git -C "${OUTPUT_DIR}" remote get-url "${OUTPUT_REMOTE}" 2>/dev/null || true)"
[[ -n "${OUTPUT_REMOTE_URL}" ]] || fail "output remote '${OUTPUT_REMOTE}' is not configured"
if [[ -z "${OUTPUT_BRANCH}" ]]; then
  OUTPUT_BRANCH="$(git -C "${OUTPUT_DIR}" branch --show-current)"
fi
[[ -n "${OUTPUT_BRANCH}" ]] || fail "cannot determine output branch; set OUTPUT_BRANCH"

echo "==========================================="
echo "Qingpu site release v${VERSION}"
echo "Theme commit:   ${THEME_COMMIT}"
echo "Changelog base: ${CHANGELOG_FROM:-<repository start>} (${CHANGELOG_SOURCE})"
echo "Build target:   ${OUTPUT_DIR} (${BUILD_DIALECT})"
echo "Push target:    ${OUTPUT_REMOTE_URL} ${OUTPUT_BRANCH}"
echo "Version post:   ${POSTS_URL} (${SLUG_PREFIX}v${VERSION})"
echo "-------------------------------------------"
cat "${NOTES_FILE}"
echo "==========================================="

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "+ OUTPUT_DIR=${OUTPUT_DIR} RELEASE_MANIFEST_FILE=<temp>/release.json ./build.sh ${OUTPUT_REPO_NAME} qingpu ${BUILD_DIALECT} ${VERSION}"
  if [[ "${PUBLISH_PUSH}" == "1" ]]; then
    echo "+ git -C ${OUTPUT_DIR} push ${OUTPUT_REMOTE} ${OUTPUT_BRANCH}"
  fi
  if [[ "${PUBLISH_POST}" == "1" ]]; then
    echo "+ upsert ${POSTS_URL}/${SLUG_PREFIX}v${VERSION}"
  fi
  echo "DRY_RUN complete; no build, push, or API write was performed"
  exit 0
fi

if [[ "${PUBLISH_POST}" == "1" && -z "${ADMIN_TOKEN}" ]]; then
  fail "QINGPU_ADMIN_TOKEN is required to register the version post"
fi

if [[ "${PUBLISH_CONFIRM:-0}" != "1" && -t 0 ]]; then
  read -r -p "Build, push artifact, and register this release? [y/N] " confirm
  case "${confirm:-}" in
    y|Y|yes|YES) ;;
    *) echo "Cancelled"; exit 0 ;;
  esac
elif [[ "${PUBLISH_CONFIRM:-0}" != "1" ]]; then
  fail "non-interactive publish requires PUBLISH_CONFIRM=1"
fi

POSTS_RESPONSE="${TEMP_DIR}/posts-response.json"
EXISTING_POST_ID=""
if [[ "${PUBLISH_POST}" == "1" ]]; then
  HTTP_STATUS="$(curl -sS -o "${POSTS_RESPONSE}" -w '%{http_code}' \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${POSTS_URL}?type=changelog&pageSize=500")"
  [[ "${HTTP_STATUS}" == 2* ]] || {
    cat "${POSTS_RESPONSE}" >&2 || true
    fail "version API preflight returned HTTP ${HTTP_STATUS}"
  }
  jq -e '.data | type == "array"' "${POSTS_RESPONSE}" >/dev/null \
    || fail "unexpected version API response"
  EXISTING_POST_ID="$(jq -r --arg slug "${SLUG_PREFIX}v${VERSION}" '.data[] | select(.slug == $slug) | .id' "${POSTS_RESPONSE}" | head -n 1)"
fi

echo ">>> Building v${VERSION}"
OUTPUT_DIR="${OUTPUT_DIR}" RELEASE_MANIFEST_FILE="${RELEASE_MANIFEST}" \
  "${PROJECT_ROOT}/build.sh" "${OUTPUT_REPO_NAME}" qingpu "${BUILD_DIALECT}" "${VERSION}"

BUILD_COMMIT="$(git -C "${OUTPUT_DIR}" rev-parse HEAD)"
if [[ "${PUBLISH_PUSH}" == "1" ]]; then
  echo ">>> Pushing artifact ${BUILD_COMMIT}"
  git -C "${OUTPUT_DIR}" push "${OUTPUT_REMOTE}" "${OUTPUT_BRANCH}"
fi

if [[ "${PUBLISH_POST}" == "1" ]]; then
  RELEASE_NOTES="$(cat "${NOTES_FILE}")"
  RELEASE_CONTENT="$(cat "${CONTENT_FILE}")"
  META_DATA="$(jq -n \
    --arg releaseKind "site" \
    --arg themeSourceCommit "${THEME_COMMIT}" \
    --arg apaySourceCommit "${APAY_COMMIT}" \
    --arg siteBuildCommit "${BUILD_COMMIT}" \
    --arg changelogFrom "${CHANGELOG_FROM}" \
    --arg artifactRemote "${OUTPUT_REMOTE_URL}" \
    '{releaseKind:$releaseKind,themeSourceCommit:$themeSourceCommit,apaySourceCommit:$apaySourceCommit,siteBuildCommit:$siteBuildCommit,changelogFrom:(if ($changelogFrom | length) > 0 then $changelogFrom else null end),artifactRemote:$artifactRemote}')"
  POST_BODY="$(jq -n \
    --arg title "轻铺AI 网页版 v${VERSION}" \
    --arg slug "${SLUG_PREFIX}v${VERSION}" \
    --arg key "${VERSION}" \
    --argjson sort "${VERSION_CODE}" \
    --arg description "${RELEASE_NOTES}" \
    --arg content "${RELEASE_CONTENT}" \
    --argjson metaData "${META_DATA}" \
    '{title:$title,slug:$slug,key:$key,sort:$sort,type:"changelog",description:$description,content:$content,isActive:true,metaData:$metaData}')"

  if [[ -n "${EXISTING_POST_ID}" ]]; then
    POST_METHOD="PUT"
    POST_URL="${POSTS_URL}/${EXISTING_POST_ID}"
  else
    POST_METHOD="POST"
    POST_URL="${POSTS_URL}"
  fi

  WRITE_RESPONSE="${TEMP_DIR}/write-response.json"
  HTTP_STATUS="$(curl -sS -o "${WRITE_RESPONSE}" -w '%{http_code}' \
    -X "${POST_METHOD}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${POST_BODY}" \
    "${POST_URL}")"
  [[ "${HTTP_STATUS}" == 2* ]] || {
    cat "${WRITE_RESPONSE}" >&2 || true
    fail "version registration returned HTTP ${HTTP_STATUS}; artifact was already pushed as ${BUILD_COMMIT}"
  }
  jq -e '.code == 0' "${WRITE_RESPONSE}" >/dev/null || {
    cat "${WRITE_RESPONSE}" >&2 || true
    fail "version registration failed; artifact was already pushed as ${BUILD_COMMIT}"
  }
fi

echo "==========================================="
echo "Published Qingpu site v${VERSION}"
echo "Artifact commit: ${BUILD_COMMIT}"
echo "Theme commit:    ${THEME_COMMIT}"
echo "Version slug:    ${SLUG_PREFIX}v${VERSION}"
echo "==========================================="
