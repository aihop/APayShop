#!/bin/bash

# ==============================================================================
# APayShop One-Click Deployment Script
# 
# Description: 
# This script is designed for a fresh Linux server (Ubuntu/Debian/CentOS).
# It will automatically install necessary dependencies (Node.js, PM2), 
# build the Nuxt application, and start it as a background service.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

APP_NAME="apayshop"
PORT=5400
NODE_VERSION="20"
SUPERVISOR_INI="/opt/gopanel/supervisord.ini"
USE_SUPERVISOR=false
if [ -f "$SUPERVISOR_INI" ] && command -v supervisorctl &> /dev/null; then
    USE_SUPERVISOR=true
fi

# Language Selection
echo -e "${CYAN}Please select a language / 请选择语言:${NC}"
echo "1) English"
echo "2) 中文 (Chinese)"
read -p "Enter choice (1/2) [Default: 1]: " LANG_CHOICE

if [ "$LANG_CHOICE" = "2" ]; then
    read -p "请输入 Node 启动端口 [默认: 5400]: " PORT_INPUT
else
    read -p "Enter Node startup port [Default: 5400]: " PORT_INPUT
fi

if [[ -n "$PORT_INPUT" ]]; then
    if [[ "$PORT_INPUT" =~ ^[0-9]+$ ]] && [ "$PORT_INPUT" -ge 1 ] && [ "$PORT_INPUT" -le 65535 ]; then
        PORT="$PORT_INPUT"
    else
        if [ "$LANG_CHOICE" = "2" ]; then
            echo -e "${YELLOW}端口输入无效，已使用默认端口 5400。${NC}"
        else
            echo -e "${YELLOW}Invalid port input, using default port 5400.${NC}"
        fi
        PORT=5400
    fi
fi

if [ "$LANG_CHOICE" = "2" ]; then
    MSG_WELCOME="      🚀 欢迎使用 APayShop 一键部署脚本         "
    MSG_STEP1="[1/6] 检查服务器环境..."
    MSG_NODE_INSTALL="Node.js 未安装或版本低于 18。正在通过 NVM 安装 Node.js v${NODE_VERSION}..."
    MSG_NODE_OK="✓ Node.js 已安装。"
    MSG_PM2_INSTALL="正在安装 PM2 进程管理器..."
    MSG_PM2_OK="✓ PM2 已安装。"
    MSG_STEP2="[2/6] 初始化环境变量..."
    MSG_ENV_CREATE="正在创建默认 .env 文件..."
    MSG_ENV_SEC="✓ 已生成高强度安全会话密钥。"
    MSG_ENV_OK="✓ .env 文件已存在。"
    MSG_STEP3="[3/6] 安装项目依赖..."
    MSG_NPM_OK="✓ NPM 依赖安装完成。"
    MSG_NPM_SKIP_OUTPUT_ONLY="检测到仅运行产物模式（无 package.json 且有 .output），跳过依赖安装。"
    MSG_OUTPUT_DEPS_RUN="检测到 .output/server/package.json，正在安装运行时依赖..."
    MSG_OUTPUT_DEPS_OK="✓ .output 运行时依赖安装完成。"
    MSG_OUTPUT_DEPS_SKIP="⚠ 未检测到 .output/server/package.json，无法自动补齐运行时依赖。"
    MSG_OUTPUT_DEPS_FAIL="❌ .output 运行时依赖安装失败。"
    MSG_PROJECT_MISSING="❌ 未检测到 package.json，且也没有可运行的 .output/server/index.mjs。请先上传完整项目源码或 .output 产物。"
    MSG_STEP4="[4/6] 编译 APayShop (这可能需要几分钟时间)..."
    MSG_BUILD_DETECT="检测到已有 .output 构建产物，跳过编译步骤。"
    MSG_BUILD_OK="✓ Nuxt 应用程序编译成功。"
    MSG_STEP5="[5/6] 启动应用服务..."
    MSG_PM2_RESTART="正在重启已存在的 PM2 进程..."
    MSG_PM2_START="正在端口 $PORT 启动新的 PM2 进程..."
    MSG_PM2_SAVE="✓ 已配置 PM2 开机自启。"
    MSG_PM2_VERIFY="正在检查服务启动状态..."
    MSG_PM2_OK_RUNNING="✓ 服务已成功启动并在线运行。"
    MSG_PM2_FAIL="❌ 服务启动失败，以下是最近日志："
    MSG_PORT_VERIFY="正在检查端口 ${PORT} 监听状态..."
    MSG_PORT_OK="✓ 端口 ${PORT} 已监听。"
    MSG_PORT_FAIL="❌ 进程状态正常但端口 ${PORT} 未监听，以下是最近日志："
    MSG_RUNTIME_USER="运行用户:"
    MSG_SUPERVISOR_MODE="ℹ 检测到 /opt/gopanel/supervisord.ini，使用 Supervisor 守护进程。"
    MSG_SUPERVISOR_RESTART="正在重启已存在的 Supervisor 进程..."
    MSG_SUPERVISOR_START="正在通过 Supervisor 启动新的进程..."
    MSG_SUPERVISOR_VERIFY="正在检查 Supervisor 服务状态..."
    MSG_SUPERVISOR_OK_RUNNING="✓ Supervisor 进程已成功启动并在线运行。"
    MSG_SUPERVISOR_FAIL="❌ Supervisor 启动失败，以下是最近日志："
    MSG_MIGRATE_RUN="正在自动执行数据库迁移..."
    MSG_MIGRATE_OK="✓ 数据库迁移完成。"
    MSG_MIGRATE_SKIP="ℹ 当前为产物模式（无 package.json），跳过自动迁移。"
    MSG_MIGRATE_FAIL="❌ 数据库迁移失败，以下是错误信息："
    MSG_STEP6="[6/6] 域名与反向代理配置"
    MSG_DOMAIN_PROMPT="您是否需要为本服务器绑定域名？(y/n): "
    MSG_DOMAIN_BIND_NOTICE="请先在域名 DNS 中添加 A 记录，并指向当前服务器 IP："
    MSG_DOMAIN_INPUT="请输入您的域名 (例如 apayshop.com): "
    MSG_NGINX_DETECT="ℹ 检测到 Nginx。正在生成 Nginx 配置..."
    MSG_NGINX_CREATED="✓ Nginx 配置文件已创建于 "
    MSG_NGINX_RELOAD="正在测试并重载 Nginx..."
    MSG_NGINX_OK="✓ Nginx 已重载。"
    MSG_NGINX_WARN="注意：您可能需要通过 Certbot 或您的服务器面板手动配置 SSL/HTTPS。"
    MSG_CADDY_DETECT="ℹ 检测到 Caddy。正在将配置追加到 Caddyfile..."
    MSG_CADDY_RELOAD="正在重载 Caddy..."
    MSG_CADDY_OK="✓ Caddy 已重载。HTTPS 证书将自动申请配置！"
    MSG_CADDY_DOMAIN_EXISTS="ℹ 该域名已存在于 Caddy 配置中，跳过追加。"
    MSG_CADDY_ERR="❌ 无法找到 Caddyfile，请手动配置。"
    MSG_NO_WEB_DETECT="ℹ 未检测到 Web 服务器。正在安装 Caddy (推荐，可自动配置 HTTPS)..."
    MSG_CADDY_INSTALL_PROMPT="未检测到 Caddy，是否现在安装并配置？(y/n): "
    MSG_CADDY_INSTALL_SKIP="已跳过安装 Caddy。"
    MSG_PORT_443_OCCUPIED="⚠ 检测到 443 端口已被占用，可能导致 Caddy 无法绑定 HTTPS。"
    MSG_PORT_443_PROMPT="是否仍继续安装 Caddy？(y/n): "
    MSG_PORT_443_SKIP="已取消 Caddy 安装。"
    MSG_CADDY_INSTALLED="✓ Caddy 已安装并配置完毕。HTTPS 证书将自动申请！"
    MSG_CADDY_OS_ERR="❌ 自动安装 Caddy 仅支持 Debian/Ubuntu 系统。"
    MSG_MANUAL_PROXY="请手动安装 Web 服务器并将请求反向代理至端口 ${PORT}。"
    MSG_SUCCESS="🎉 APayShop 部署成功！"
    MSG_RUNNING="您的独立站已在后台运行。"
    MSG_LOCAL_URL="本地地址: http://localhost:${PORT}"
    MSG_USEFUL_CMD="常用命令:"
    MSG_LOGS="- 查看实时日志: ${YELLOW}pm2 logs $APP_NAME${NC}"
    MSG_STOP="- 停止服务:    ${YELLOW}pm2 stop $APP_NAME${NC}"
else
    MSG_WELCOME="      🚀 Welcome to APayShop 1-Click Deployer         "
    MSG_STEP1="[1/6] Checking Server Environment..."
    MSG_NODE_INSTALL="Node.js is not installed or version is below 18. Installing Node.js v${NODE_VERSION} via NVM..."
    MSG_NODE_OK="✓ Node.js is installed."
    MSG_PM2_INSTALL="Installing PM2 process manager..."
    MSG_PM2_OK="✓ PM2 is already installed."
    MSG_STEP2="[2/6] Initializing Configuration..."
    MSG_ENV_CREATE="Creating default .env file..."
    MSG_ENV_SEC="✓ Generated secure session password."
    MSG_ENV_OK="✓ .env file exists."
    MSG_STEP3="[3/6] Installing Project Dependencies..."
    MSG_NPM_OK="✓ NPM packages installed."
    MSG_NPM_SKIP_OUTPUT_ONLY="Detected output-only mode (no package.json but .output exists), skipping dependency install."
    MSG_OUTPUT_DEPS_RUN="Detected .output/server/package.json, installing runtime dependencies..."
    MSG_OUTPUT_DEPS_OK="✓ .output runtime dependencies installed."
    MSG_OUTPUT_DEPS_SKIP="⚠ .output/server/package.json not found, cannot auto-install runtime dependencies."
    MSG_OUTPUT_DEPS_FAIL="❌ Failed to install .output runtime dependencies."
    MSG_PROJECT_MISSING="❌ package.json not found and no runnable .output/server/index.mjs detected. Please upload full project source or .output artifact first."
    MSG_STEP4="[4/6] Building APayShop (This will take a few minutes)..."
    MSG_BUILD_DETECT="Detected existing .output build artifact, skipping build step."
    MSG_BUILD_OK="✓ Nuxt application compiled successfully."
    MSG_STEP5="[5/6] Starting Application Server..."
    MSG_PM2_RESTART="Restarting existing PM2 process..."
    MSG_PM2_START="Starting new PM2 process on port $PORT..."
    MSG_PM2_SAVE="✓ Configured PM2 to startup on boot."
    MSG_PM2_VERIFY="Verifying service startup status..."
    MSG_PM2_OK_RUNNING="✓ Service is online and running."
    MSG_PM2_FAIL="❌ Service failed to start. Recent logs:"
    MSG_PORT_VERIFY="Checking listen status for port ${PORT}..."
    MSG_PORT_OK="✓ Port ${PORT} is listening."
    MSG_PORT_FAIL="❌ Process appears healthy but port ${PORT} is not listening. Recent logs:"
    MSG_RUNTIME_USER="Runtime user:"
    MSG_SUPERVISOR_MODE="ℹ Detected /opt/gopanel/supervisord.ini, using Supervisor process manager."
    MSG_SUPERVISOR_RESTART="Restarting existing Supervisor process..."
    MSG_SUPERVISOR_START="Starting new process via Supervisor..."
    MSG_SUPERVISOR_VERIFY="Verifying Supervisor service status..."
    MSG_SUPERVISOR_OK_RUNNING="✓ Supervisor process is online and running."
    MSG_SUPERVISOR_FAIL="❌ Supervisor failed to start. Recent logs:"
    MSG_MIGRATE_RUN="Running automatic database migrations..."
    MSG_MIGRATE_OK="✓ Database migrations completed."
    MSG_MIGRATE_SKIP="ℹ Output-only mode detected (no package.json), skipping automatic migrations."
    MSG_MIGRATE_FAIL="❌ Database migration failed. Error output:"
    MSG_STEP6="[6/6] Domain & Reverse Proxy Configuration"
    MSG_DOMAIN_PROMPT="Do you want to bind a domain to this server? (y/n): "
    MSG_DOMAIN_BIND_NOTICE="Before entering domain, point your DNS A record to this server IP:"
    MSG_DOMAIN_INPUT="Enter your domain name (e.g., shop.example.com): "
    MSG_NGINX_DETECT="ℹ Nginx detected. Generating Nginx configuration..."
    MSG_NGINX_CREATED="✓ Nginx config created at "
    MSG_NGINX_RELOAD="Testing and reloading Nginx..."
    MSG_NGINX_OK="✓ Nginx reloaded."
    MSG_NGINX_WARN="Note: You may need to configure SSL/HTTPS manually via Certbot or your panel."
    MSG_CADDY_DETECT="ℹ Caddy detected. Appending to Caddyfile..."
    MSG_CADDY_RELOAD="Reloading Caddy..."
    MSG_CADDY_OK="✓ Caddy reloaded. HTTPS will be provisioned automatically!"
    MSG_CADDY_DOMAIN_EXISTS="ℹ Domain already exists in Caddyfile, skipping append."
    MSG_CADDY_ERR="❌ Could not locate Caddyfile. Please configure manually."
    MSG_NO_WEB_DETECT="ℹ No Web Server detected. Installing Caddy (Recommended for automatic HTTPS)..."
    MSG_CADDY_INSTALL_PROMPT="Caddy not detected. Install and configure now? (y/n): "
    MSG_CADDY_INSTALL_SKIP="Skipped Caddy installation."
    MSG_PORT_443_OCCUPIED="⚠ Port 443 is already in use, Caddy may fail to bind HTTPS."
    MSG_PORT_443_PROMPT="Continue installing Caddy anyway? (y/n): "
    MSG_PORT_443_SKIP="Cancelled Caddy installation."
    MSG_CADDY_INSTALLED="✓ Caddy installed and configured. HTTPS will be provisioned automatically!"
    MSG_CADDY_OS_ERR="❌ Auto-installing Caddy is only supported on Debian/Ubuntu via this script."
    MSG_MANUAL_PROXY="Please install a web server manually and reverse proxy to port ${PORT}."
    MSG_SUCCESS="🎉 APayShop Deployment Successful!"
    MSG_RUNNING="Your store is now running in the background."
    MSG_LOCAL_URL="Local URL: http://localhost:${PORT}"
    MSG_USEFUL_CMD="Useful Commands:"
    MSG_LOGS="- View live logs: ${YELLOW}pm2 logs $APP_NAME${NC}"
    MSG_STOP="- Stop server:    ${YELLOW}pm2 stop $APP_NAME${NC}"
fi

if [ "$USE_SUPERVISOR" = true ]; then
    if [ "$LANG_CHOICE" = "2" ]; then
        MSG_LOGS="- 查看实时日志: ${YELLOW}tail -f /opt/gopanel/log/stdout_${APP_NAME}.log${NC}"
        MSG_STOP="- 停止服务:    ${YELLOW}sudo supervisorctl -c $SUPERVISOR_INI stop $APP_NAME${NC}"
    else
        MSG_LOGS="- View live logs: ${YELLOW}tail -f /opt/gopanel/log/stdout_${APP_NAME}.log${NC}"
        MSG_STOP="- Stop server:    ${YELLOW}sudo supervisorctl -c $SUPERVISOR_INI stop $APP_NAME${NC}"
    fi
fi

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}${MSG_WELCOME}${NC}"
echo -e "${CYAN}======================================================${NC}"

# 1. Environment Setup (Node.js & PM2)
echo -e "\n${YELLOW}${MSG_STEP1}${NC}"

if ! command -v curl &> /dev/null; then
    if command -v apt &> /dev/null; then
        sudo apt update
        sudo apt install -y curl ca-certificates
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y curl ca-certificates
    elif command -v yum &> /dev/null; then
        sudo yum install -y curl ca-certificates
    fi
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NEED_INSTALL_NODE=false
if ! command -v node &> /dev/null; then
    NEED_INSTALL_NODE=true
elif ! command -v npm &> /dev/null; then
    NEED_INSTALL_NODE=true
elif ! command -v npx &> /dev/null; then
    NEED_INSTALL_NODE=true
elif [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 18 ]; then
    NEED_INSTALL_NODE=true
fi

if [ "$NEED_INSTALL_NODE" = true ]; then
    echo -e "${MSG_NODE_INSTALL}"
    if ! command -v nvm &> /dev/null; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    nvm install $NODE_VERSION
    nvm use $NODE_VERSION
    nvm alias default $NODE_VERSION
    hash -r
fi

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null || ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Node.js/npm environment installation failed. Please install manually and rerun.${NC}"
    echo -e "${YELLOW}--- Node Diagnose ---${NC}"
    echo "whoami: $(whoami 2>/dev/null || echo '')"
    echo "HOME: ${HOME}"
    echo "SHELL: ${SHELL}"
    echo "PATH: ${PATH}"
    echo "NVM_DIR: ${NVM_DIR}"
    echo "node path: $(command -v node 2>/dev/null || echo 'NOT_FOUND')"
    echo "npm path: $(command -v npm 2>/dev/null || echo 'NOT_FOUND')"
    echo "npx path: $(command -v npx 2>/dev/null || echo 'NOT_FOUND')"
    if [ -f "$NVM_DIR/nvm.sh" ]; then
        echo "nvm.sh: FOUND"
    else
        echo "nvm.sh: NOT_FOUND"
    fi
    ls -la "$NVM_DIR" 2>/dev/null || true
    echo -e "${YELLOW}Try rerun with: bash deploy.sh${NC}"
    exit 1
fi

NODE_BIN_DIR="$(dirname "$(command -v node)")"
if [ -n "$NODE_BIN_DIR" ]; then
    export PATH="$NODE_BIN_DIR:$PATH"
    if [ -f "$HOME/.bashrc" ] && ! grep -q "APAYSHOP_NODE_PATH" "$HOME/.bashrc"; then
        {
            echo ""
            echo "# APAYSHOP_NODE_PATH"
            echo "export PATH=\"$NODE_BIN_DIR:\$PATH\""
        } >> "$HOME/.bashrc"
    fi
    if [ -f "$HOME/.profile" ] && ! grep -q "APAYSHOP_NODE_PATH" "$HOME/.profile"; then
        {
            echo ""
            echo "# APAYSHOP_NODE_PATH"
            echo "export PATH=\"$NODE_BIN_DIR:\$PATH\""
        } >> "$HOME/.profile"
    fi
    if [ -w "/usr/local/bin" ]; then
        ln -sf "$NODE_BIN_DIR/node" /usr/local/bin/node 2>/dev/null || true
        ln -sf "$NODE_BIN_DIR/npm" /usr/local/bin/npm 2>/dev/null || true
        ln -sf "$NODE_BIN_DIR/npx" /usr/local/bin/npx 2>/dev/null || true
    else
        sudo ln -sf "$NODE_BIN_DIR/node" /usr/local/bin/node 2>/dev/null || true
        sudo ln -sf "$NODE_BIN_DIR/npm" /usr/local/bin/npm 2>/dev/null || true
        sudo ln -sf "$NODE_BIN_DIR/npx" /usr/local/bin/npx 2>/dev/null || true
    fi
fi

echo -e "${GREEN}${MSG_NODE_OK} $(node -v)${NC}"

# Install PM2 globally if not present
if [ "$USE_SUPERVISOR" = true ]; then
    echo -e "${YELLOW}${MSG_SUPERVISOR_MODE}${NC}"
else
    if ! command -v pm2 &> /dev/null; then
        echo "${MSG_PM2_INSTALL}"
        npm install -g pm2
        hash -r
    else
        echo -e "${GREEN}${MSG_PM2_OK}${NC}"
    fi
fi

# 2. Environment Variables Initialization
echo -e "\n${YELLOW}${MSG_STEP2}${NC}"
if [ ! -f .env ]; then
    echo "${MSG_ENV_CREATE}"
    cp .env.example .env 2>/dev/null || touch .env
    
    # Auto-generate Auth Secret if missing
    if ! grep -q "NUXT_SESSION_PASSWORD" .env; then
        SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        echo "NUXT_SESSION_PASSWORD=$SECRET" >> .env
        echo -e "${GREEN}${MSG_ENV_SEC}${NC}"
    fi
else
    echo -e "${GREEN}${MSG_ENV_OK}${NC}"
fi

# 3. Install Project Dependencies
echo -e "\n${YELLOW}${MSG_STEP3}${NC}"
HAS_PACKAGE_JSON=false
HAS_OUTPUT_ARTIFACT=false
if [ -f "package.json" ]; then HAS_PACKAGE_JSON=true; fi
if [ -f ".output/server/index.mjs" ]; then HAS_OUTPUT_ARTIFACT=true; fi

if [ "$HAS_PACKAGE_JSON" = true ]; then
    npm install
    echo -e "${GREEN}${MSG_NPM_OK}${NC}"
elif [ "$HAS_OUTPUT_ARTIFACT" = true ]; then
    echo -e "${GREEN}${MSG_NPM_SKIP_OUTPUT_ONLY}${NC}"
    if [ -f ".output/server/package.json" ]; then
        echo -e "${YELLOW}${MSG_OUTPUT_DEPS_RUN}${NC}"
        if (cd .output/server && npm install --omit=dev --no-audit --no-fund); then
            echo -e "${GREEN}${MSG_OUTPUT_DEPS_OK}${NC}"
        else
            echo -e "${RED}${MSG_OUTPUT_DEPS_FAIL}${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}${MSG_OUTPUT_DEPS_SKIP}${NC}"
    fi
else
    echo -e "${RED}${MSG_PROJECT_MISSING}${NC}"
    exit 1
fi

# 4. Build Nuxt Application
echo -e "\n${YELLOW}${MSG_STEP4}${NC}"
if [ "$HAS_OUTPUT_ARTIFACT" = true ]; then
    echo -e "${GREEN}${MSG_BUILD_DETECT}${NC}"
else
    if [ "$HAS_PACKAGE_JSON" = true ]; then
        # Clean previous partial build outputs before building
        rm -rf .nuxt .output
        npm run build
        echo -e "${GREEN}${MSG_BUILD_OK}${NC}"
    else
        echo -e "${RED}${MSG_PROJECT_MISSING}${NC}"
        exit 1
    fi
fi

if [ "$HAS_PACKAGE_JSON" = true ]; then
    echo -e "${YELLOW}${MSG_MIGRATE_RUN}${NC}"
    if ./node_modules/.bin/nuxt-db migrate --dotenv .env; then
        echo -e "${GREEN}${MSG_MIGRATE_OK}${NC}"
    else
        echo -e "${RED}${MSG_MIGRATE_FAIL}${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}${MSG_MIGRATE_SKIP}${NC}"
fi

# 5. Start Service via PM2
echo -e "\n${YELLOW}${MSG_STEP5}${NC}"
if [ "$USE_SUPERVISOR" = true ]; then
    PROGRAM_BLOCK=$(cat <<EOF
[program:${APP_NAME}]
directory=$(pwd)
command=node .output/server/index.mjs
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/opt/gopanel/log/stdout_${APP_NAME}.log
environment=PORT="${PORT}",NODE_ENV="production"
EOF
)
    TMP_SUPERVISOR="$(mktemp)"
    sudo awk -v app="$APP_NAME" '
      BEGIN { skip=0 }
      $0 ~ "^\\[program:" app "\\]" { skip=1; next }
      skip && $0 ~ "^\\[" { skip=0 }
      !skip { print }
    ' "$SUPERVISOR_INI" > "$TMP_SUPERVISOR"
    cat "$TMP_SUPERVISOR" | sudo tee "$SUPERVISOR_INI" > /dev/null
    rm -f "$TMP_SUPERVISOR"
    echo "${MSG_SUPERVISOR_START}"
    echo "" | sudo tee -a "$SUPERVISOR_INI" > /dev/null
    echo "$PROGRAM_BLOCK" | sudo tee -a "$SUPERVISOR_INI" > /dev/null
    if ! sudo grep -q "^\[program:${APP_NAME}\]" "$SUPERVISOR_INI"; then
        echo -e "${RED}${MSG_SUPERVISOR_FAIL}${NC}"
        exit 1
    fi
    sudo supervisorctl -c "$SUPERVISOR_INI" reread
    sudo supervisorctl -c "$SUPERVISOR_INI" update
    sudo supervisorctl -c "$SUPERVISOR_INI" restart "$APP_NAME" || true
    echo -e "${MSG_SUPERVISOR_VERIFY}"
    sleep 3
    SUPERVISOR_STATUS=$(sudo supervisorctl -c "$SUPERVISOR_INI" status "$APP_NAME" 2>/dev/null | awk '{print $2}')
    if [ "$SUPERVISOR_STATUS" != "RUNNING" ]; then
        echo -e "${RED}${MSG_SUPERVISOR_FAIL}${NC}"
        if [ -f "/opt/gopanel/log/stdout_${APP_NAME}.log" ]; then
            tail -n 80 "/opt/gopanel/log/stdout_${APP_NAME}.log" || true
        fi
        exit 1
    fi
    echo -e "${GREEN}${MSG_SUPERVISOR_OK_RUNNING}${NC}"
else
    if pm2 describe $APP_NAME > /dev/null 2>&1; then
        echo "${MSG_PM2_RESTART}"
        pm2 restart $APP_NAME --update-env
    else
        echo "${MSG_PM2_START}"
        PORT=$PORT pm2 start .output/server/index.mjs --name $APP_NAME
        pm2 save
        echo -e "${GREEN}${MSG_PM2_SAVE}${NC}"
    fi
    echo -e "${MSG_PM2_VERIFY}"
    sleep 3
    PM2_STATUS=$(pm2 describe $APP_NAME 2>/dev/null | awk '/status/ {print $4; exit}')
    if [ "$PM2_STATUS" != "online" ]; then
        echo -e "${RED}${MSG_PM2_FAIL}${NC}"
        pm2 logs $APP_NAME --lines 80 --nostream || true
        exit 1
    fi
    echo -e "${GREEN}${MSG_PM2_OK_RUNNING}${NC}"
fi

echo -e "${MSG_PORT_VERIFY}"
PORT_LISTEN_OK=false
LISTEN_PID=""
LISTEN_USER=""
for _ in $(seq 1 10); do
    if command -v lsof &> /dev/null; then
        LISTEN_LINE=$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $2" "$3}')
        if [ -n "$LISTEN_LINE" ]; then
            LISTEN_PID=$(echo "$LISTEN_LINE" | awk '{print $1}')
            LISTEN_USER=$(echo "$LISTEN_LINE" | awk '{print $2}')
        fi
    elif command -v ss &> /dev/null; then
        SS_LINE=$(ss -ltnp 2>/dev/null | grep -E "[\:\.]${PORT}[[:space:]]" | head -n 1 || true)
        if [ -n "$SS_LINE" ]; then
            LISTEN_PID=$(echo "$SS_LINE" | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -n 1)
            if [ -n "$LISTEN_PID" ]; then
                LISTEN_USER=$(ps -o user= -p "$LISTEN_PID" 2>/dev/null | xargs)
            fi
        fi
    fi

    if [ -n "$LISTEN_PID" ]; then
        PORT_LISTEN_OK=true
        break
    fi
    sleep 1
done

if [ "$PORT_LISTEN_OK" != true ]; then
    echo -e "${RED}${MSG_PORT_FAIL}${NC}"
    if [ "$USE_SUPERVISOR" = true ]; then
        tail -n 80 "/opt/gopanel/log/stdout_${APP_NAME}.log" 2>/dev/null || true
    else
        pm2 logs $APP_NAME --lines 80 --nostream || true
    fi
    exit 1
fi

echo -e "${GREEN}${MSG_PORT_OK}${NC}"
if [ -n "$LISTEN_USER" ]; then
    echo -e "${MSG_RUNTIME_USER} ${GREEN}${LISTEN_USER}${NC} (pid: ${LISTEN_PID})"
fi

# 6. Domain & Reverse Proxy Setup
echo -e "\n${YELLOW}${MSG_STEP6}${NC}"
read -p "${MSG_DOMAIN_PROMPT}" SETUP_DOMAIN
if [[ "$SETUP_DOMAIN" =~ ^[Yy]$ ]]; then
    SERVER_IP=$(curl -4 -s --max-time 3 https://api.ipify.org 2>/dev/null || true)
    if [ -z "$SERVER_IP" ]; then
        SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    if [ -z "$SERVER_IP" ]; then
        SERVER_IP="YOUR_SERVER_IP"
    fi
    echo -e "${YELLOW}${MSG_DOMAIN_BIND_NOTICE}${NC} ${GREEN}${SERVER_IP}${NC}"
    read -p "${MSG_DOMAIN_INPUT}" DOMAIN_NAME
    
    # Check existing web servers
    HAS_NGINX=false
    HAS_CADDY=false
    
    if command -v nginx &> /dev/null || [ -d "/etc/nginx" ]; then HAS_NGINX=true; fi
    if command -v caddy &> /dev/null \
      || [ -f "/etc/caddy/Caddyfile" ] \
      || [ -f "/etc/Caddyfile" ] \
      || [ -f "/opt/gopanel/Caddyfile" ]; then
      HAS_CADDY=true
    fi
    
    if [ "$HAS_NGINX" = true ]; then
        echo -e "${YELLOW}${MSG_NGINX_DETECT}${NC}"
        
        # Determine config directory (support standard nginx and openresty/bt panel)
        CONF_DIR="/etc/nginx/conf.d"
        if [ -d "/www/server/panel/vhost/nginx" ]; then
            # BT Panel environment
            CONF_DIR="/www/server/panel/vhost/nginx"
        fi
        
        sudo tee "$CONF_DIR/${DOMAIN_NAME}.conf" > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
        echo -e "${GREEN}${MSG_NGINX_CREATED}$CONF_DIR/${DOMAIN_NAME}.conf${NC}"
        echo -e "${MSG_NGINX_RELOAD}"
        sudo nginx -t && sudo systemctl reload nginx || sudo nginx -s reload
        echo -e "${GREEN}${MSG_NGINX_OK}${NC}"
        echo -e "${YELLOW}${MSG_NGINX_WARN}${NC}"
        
    elif [ "$HAS_CADDY" = true ]; then
        echo -e "${YELLOW}${MSG_CADDY_DETECT}${NC}"
        
        CADDYFILE="/etc/caddy/Caddyfile"
        if [ -f "/opt/gopanel/Caddyfile" ]; then
            CADDYFILE="/opt/gopanel/Caddyfile"
        elif [ ! -f "$CADDYFILE" ] && [ -f "/etc/Caddyfile" ]; then
            CADDYFILE="/etc/Caddyfile"
        fi
        
        if [ -f "$CADDYFILE" ]; then
            ESCAPED_DOMAIN=$(printf '%s' "$DOMAIN_NAME" | sed 's/[][(){}.^$*+?|\/]/\\&/g')
            if grep -Eq "^[[:space:]]*${ESCAPED_DOMAIN}[[:space:]]*\\{" "$CADDYFILE"; then
                echo -e "${YELLOW}${MSG_CADDY_DOMAIN_EXISTS}${NC}"
            else
                sudo tee -a "$CADDYFILE" > /dev/null <<EOF

${DOMAIN_NAME} {
    reverse_proxy 127.0.0.1:${PORT}
}
EOF
            fi
            echo -e "${MSG_CADDY_RELOAD}"
            if [ "$CADDYFILE" = "/opt/gopanel/Caddyfile" ]; then
                sudo systemctl restart gopanel
            else
                sudo systemctl reload caddy || caddy reload --config "$CADDYFILE"
            fi
            echo -e "${GREEN}${MSG_CADDY_OK}${NC}"
        else
            echo -e "${RED}${MSG_CADDY_ERR}${NC}"
        fi
        
    else
        echo -e "${YELLOW}${MSG_NO_WEB_DETECT}${NC}"
        read -p "${MSG_CADDY_INSTALL_PROMPT}" INSTALL_CADDY

        if [[ "$INSTALL_CADDY" =~ ^[Yy]$ ]]; then
            SHOULD_INSTALL_CADDY=true
            PORT_443_OCCUPIED=false
            if command -v ss &> /dev/null; then
                ss -ltn | awk '{print $4}' | grep -qE '(^|:|\[)::?443$|:443$' && PORT_443_OCCUPIED=true
            elif command -v lsof &> /dev/null; then
                lsof -iTCP:443 -sTCP:LISTEN -n -P > /dev/null 2>&1 && PORT_443_OCCUPIED=true
            elif command -v netstat &> /dev/null; then
                netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE '(^|:|\[)::?443$|:443$' && PORT_443_OCCUPIED=true
            fi

            if [ "$PORT_443_OCCUPIED" = true ]; then
                echo -e "${YELLOW}${MSG_PORT_443_OCCUPIED}${NC}"
                read -p "${MSG_PORT_443_PROMPT}" CONTINUE_CADDY_INSTALL
                if [[ ! "$CONTINUE_CADDY_INSTALL" =~ ^[Yy]$ ]]; then
                    echo -e "${YELLOW}${MSG_PORT_443_SKIP}${NC}"
                    echo -e "${MSG_MANUAL_PROXY}"
                    SHOULD_INSTALL_CADDY=false
                fi
            fi

            if [ "$SHOULD_INSTALL_CADDY" = true ]; then
                # Install Caddy on Debian/Ubuntu
                if [ -f "/etc/debian_version" ]; then
                    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
                    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
                    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
                    sudo apt update
                    sudo apt install -y caddy

                    # Configure Caddy
                    sudo tee "/etc/caddy/Caddyfile" > /dev/null <<EOF
${DOMAIN_NAME} {
    reverse_proxy 127.0.0.1:${PORT}
}
EOF
                    sudo systemctl restart caddy
                    echo -e "${GREEN}${MSG_CADDY_INSTALLED}${NC}"
                else
                    echo -e "${RED}${MSG_CADDY_OS_ERR}${NC}"
                    echo -e "${MSG_MANUAL_PROXY}"
                fi
            fi
        else
            echo -e "${YELLOW}${MSG_CADDY_INSTALL_SKIP}${NC}"
            echo -e "${MSG_MANUAL_PROXY}"
        fi
    fi
fi

echo -e "\n${CYAN}======================================================${NC}"
echo -e "${GREEN}${MSG_SUCCESS}${NC}"
echo -e "${MSG_RUNNING}"
echo -e "${MSG_LOCAL_URL}"
echo -e ""
echo -e "${MSG_USEFUL_CMD}"
echo -e "${MSG_LOGS}"
echo -e "${MSG_STOP}"
echo -e "======================================================${NC}"
