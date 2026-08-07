#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
if [[ "${APAY_BUILD_LOCK_HELD:-}" != "1" ]]; then
    exec node scripts/run-with-build-lock.mjs -- bash "$0" "$@"
fi

# 配置变量
DEFAULT_PROJECT_NAME="apay"
DEFAULT_DB_NAME="apay"
BINDING_NAME="DB"
MIGRATIONS_DIR="server/db/migrations/sqlite"
THEME_NAME="${1:-${BUILD_THEME:-}}"
BUILD_THEMES="${BUILD_THEMES:-${APAY_BUILD_THEMES:-}}"
THEME_MANIFEST_FILE="${THEME_MANIFEST_FILE:-app/generated/theme-manifest.json}"

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

    mkdir -p "${manifest_dir}"
    printf '%s\n' "${manifest_json}" > "${THEME_MANIFEST_FILE}"
}

restore_theme_build_loader() {
    unset APAY_BUILD_THEMES || true
    unset APAY_THEME_MANIFEST || true
    write_theme_manifest ""
    node scripts/generate-theme-build.mjs --manifest "${THEME_MANIFEST_FILE}" >/dev/null
}

prepare_theme_build_loader() {
    local allow
    allow="$(resolve_build_themes)"
    export APAY_THEME_MANIFEST="${THEME_MANIFEST_FILE}"
    write_theme_manifest "${allow}"

    if [[ -n "${allow}" ]]; then
        export APAY_BUILD_THEMES="${allow}"
        echo "🎨 本次仅构建模板: ${allow}"
        node scripts/generate-theme-build.mjs --themes "${allow}" --manifest "${THEME_MANIFEST_FILE}"
    else
        unset APAY_BUILD_THEMES || true
        echo "🎨 本次仅构建核心主题"
        node scripts/generate-theme-build.mjs --manifest "${THEME_MANIFEST_FILE}"
    fi

    trap restore_theme_build_loader EXIT
}

# 1. 用户输入交互
read -p "请输入项目名称 ($DEFAULT_PROJECT_NAME): " PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-$DEFAULT_PROJECT_NAME}

read -p "请输入数据库名称 ($DEFAULT_DB_NAME): " DB_NAME
DB_NAME=${DB_NAME:-$DEFAULT_DB_NAME}

# --- 数据库处理 ---
echo "🔍 检查 D1 数据库状态..."
# 统一使用 jq 提取 UUID
DB_ID=$(npx wrangler d1 list --json | jq -r ".[] | select(.name == \"$DB_NAME\") | .uuid" 2>/dev/null)

if [ -z "$DB_ID" ] || [ "$DB_ID" == "null" ]; then
    echo "🆕 数据库不存在，正在创建 $DB_NAME..."
    CREATE_RES=$(npx wrangler d1 create $DB_NAME --json)
    DB_ID=$(echo $CREATE_RES | jq -r '.uuid // .[0].uuid')
    echo "✅ 数据库创建成功，ID: $DB_ID"
else
    echo "✅ 数据库已存在，ID: $DB_ID"
fi

# --- 动态生成配置文件 (这是核心，解决 project edit 失效的问题) ---
echo "📝 [Step 2] 正在动态生成 wrangler.toml..."
cat <<EOF > wrangler.toml
#:schema node_modules/wrangler/config-schema.json
name = "$PROJECT_NAME"
compatibility_date = "2024-11-01"
pages_build_output_dir = "dist"
compatibility_flags = ["nodejs_compat_v2"]

[[d1_databases]]
binding = "$BINDING_NAME"
database_name = "$DB_NAME"
database_id = "$DB_ID"
migrations_dir = "$MIGRATIONS_DIR"
EOF

# --- 数据库迁移 ---
echo "🗄️ 同步数据库结构与初始化..."
# 修正：D1 迁移在新版中对参数非常敏感，确保在 migrations 文件夹的父目录下运行
if [ -d "server/db/migrations" ]; then
    cd server/db && npx wrangler d1 migrations apply $DB_NAME --remote
    cd ../../
else
    # 如果在根目录
    npx wrangler d1 migrations apply $DB_NAME --remote
fi

echo "🧩 检查 Qingpu PostgreSQL 结构..."
if [[ -n "${QINGPU_DATABASE_URL:-${DATABASE_URL:-}}" ]]; then
    node scripts/apply-qingpu-sql.mjs
else
    echo "ℹ️ 未配置 QINGPU_DATABASE_URL / DATABASE_URL，跳过 Qingpu SQL 初始化"
fi

# --- 是否迁移本地数据库记录，如果是，就将本地 .data/db/sqlite.db 文件上传到 D1 数据库中 ---
read -p "是否迁移本地数据库记录到D1数据库中？ (y/n): " MIGRATE_CONFIRM

if [ "${MIGRATE_CONFIRM:-y}" == "y" ]; then
  echo "🗄️ 正在执行数据库结构迁移..."
  # 移除可能导致报错的参数，确保迁移成功
  npx wrangler d1 migrations apply $DB_NAME --remote

  echo "📦 导出并处理本地数据 (解决冲突忽略)..."

  if [ -f ".data/db/sqlite.db" ]; then
    # 1. 导出数据并进行清洗
    sqlite3 .data/db/sqlite.db .dump \
    | grep -E "^INSERT INTO" \
    | sed '/sqlite_sequence/d' \
    | node -e "
      const fs = require('fs');
      const data = fs.readFileSync(0, 'utf-8');

      // 1. 在最前面加上禁用外键检查
      process.stdout.write('PRAGMA foreign_keys = OFF;\n');

      const replaced = data
        .replace(/^INSERT INTO/gm, 'INSERT OR IGNORE INTO')
        .replace(/unistr\('((?:[^']|'')*)'\)/g, (match, p1) => {
          let unescaped = p1.replace(/\\\\u([0-9a-fA-F]{4})/g,
            (m, g1) => String.fromCharCode(parseInt(g1, 16))
          );
          return \"'\" + unescaped + \"'\";
        })
        .replace(/\r?\n/g, '\n');

      process.stdout.write(replaced);
      
      // 2. 在最后面恢复外键检查
      process.stdout.write('\nPRAGMA foreign_keys = ON;');
    " > local_db_data.sql

    echo "⬆️ 分批导入 D1..."

    # 分割文件以防单次请求过大
    split -l 500 local_db_data.sql chunk_

    for file in chunk_*; do
      if [ -s "$file" ]; then # 确保文件不为空
        echo "正在导入 $file..."
        # 使用 --remote 确保推送到生产 D1
        npx wrangler d1 execute $DB_NAME --remote --file "$file"
      fi
    done

    # 清理临时文件
    rm -f chunk_* local_db_data.sql

    echo "✅ 数据迁移与同步完成"
  else
    echo "⚠️ 未找到本地数据库 (.data/db/sqlite.db)"
  fi
fi


# --- 项目检查与创建 ---
echo "🛠️ 检查 Pages 项目 $PROJECT_NAME..."
# 修正：新版 JSON 结构中键名带空格，使用 grep 更稳健
if ! npx wrangler pages project list --json | grep -q "\"Project Name\": \"$PROJECT_NAME\""; then
    echo "🆕 项目不存在，正在初始化 Pages 项目..."
    npx wrangler pages project create $PROJECT_NAME --production-branch main
fi

# --- 环境变量 (Secrets) ---
echo "🔑 检查环境变量配置..."
# 注意：secret put 是交互式的，使用 <<< 自动输入
SESSION_SECRET=$(openssl rand -base64 32)
npx wrangler pages secret put NUXT_SESSION_PASSWORD --project-name $PROJECT_NAME <<< "$SESSION_SECRET"

# --- 构建与部署 ---
read -p "确认重新编译 $PROJECT_NAME 吗？ (y/n): " DEPLOY_CONFIRM
if [ "${DEPLOY_CONFIRM:-y}" = "y" ]; then
    echo "📦 开始构建产物..."
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
    echo "🧠 NODE_OPTIONS=${NODE_OPTIONS}"
    prepare_theme_build_loader
    rm -rf .output .nuxt dist .wrangler/deploy
    # 强制指定预设
    NITRO_PRESET=cloudflare-pages npx nuxi build
    node scripts/patch-cloudflare-worker.mjs
    restore_theme_build_loader
    trap - EXIT
fi

if [ ! -d "dist" ] || [ -z "$(find dist -mindepth 1 -print -quit 2>/dev/null)" ]; then
    echo "❌ dist 目录不存在或为空，构建未成功，停止部署。"
    exit 1
fi

# 删除 .DS_Store 文件
echo "🧹 删除 .DS_Store 文件..."
find dist -name ".DS_Store" -delete

# 清理本地残留的 Wrangler deploy 重定向配置，避免指向旧的 dist/_worker.js/wrangler.json
rm -rf .wrangler/deploy

echo "🚀 推送代码并部署..."
npx wrangler pages deploy dist --project-name $PROJECT_NAME --branch main

# 如何查看推送的进度和文件列表
echo "🔍 查看推送的进度和文件列表..."
npx wrangler pages deployment list --project-name $PROJECT_NAME --environment production

echo "------------------------------------------------"
echo "✅ 全部部署完成！"
echo "🔗 访问地址: https://$PROJECT_NAME.pages.dev"
