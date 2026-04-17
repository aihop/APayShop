#!/bin/bash

# ==============================================================================
# APayShop Template Rebuild & Restart Script
# 
# Description: 
# This script is used to safely rebuild the Nuxt application and restart the 
# production server. It is essential when a new theme/template (.vue files) is 
# downloaded or generated via AI, because Vite/Rollup requires a fresh build 
# to statically analyze and compile the new dynamic import() paths.
#
# Usage:
#   chmod +x rebuild.sh
#   ./rebuild.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

APP_NAME="apayshop"

echo -e "${YELLOW}🚀 Starting APayShop System Rebuild...${NC}"
echo "------------------------------------------------"

# 1. Check dependencies
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: npm is not installed or not in PATH.${NC}"
    exit 1
fi

# 2. Clean up old build (Optional but recommended to prevent cache issues)
echo -e "\n${YELLOW}[1/4] Cleaning up old build files...${NC}"
rm -rf .nuxt
rm -rf .output
echo -e "${GREEN}✓ Cleaned.${NC}"

# 3. Install dependencies (Just in case the new template requires new packages)
echo -e "\n${YELLOW}[2/4] Verifying and installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies up to date.${NC}"

# 4. Rebuild the application
echo -e "\n${YELLOW}[3/4] Compiling new themes and rebuilding Nuxt application...${NC}"
echo -e "${YELLOW}(This may take a minute. Please wait...)${NC}"
npm run build
echo -e "${GREEN}✓ Build successful.${NC}"

# 5. Restart the server
echo -e "\n${YELLOW}[4/4] Restarting the production server...${NC}"

# Check if PM2 is installed globally and manages this app
if command -v pm2 &> /dev/null; then
    # Check if the app is already running in PM2
    if pm2 describe $APP_NAME > /dev/null 2>&1; then
        echo "Restarting application via PM2..."
        pm2 restart $APP_NAME
        echo -e "${GREEN}✓ Server restarted successfully via PM2.${NC}"
    else
        echo -e "${YELLOW}ℹ PM2 is installed but '$APP_NAME' process not found.${NC}"
        echo "Starting new process via PM2..."
        pm2 start .output/server/index.mjs --name $APP_NAME
        echo -e "${GREEN}✓ Server started successfully via PM2.${NC}"
    fi
else
    # Fallback for non-PM2 environments (e.g., Docker, systemd, or manual run)
    echo -e "${YELLOW}ℹ PM2 not detected. Assuming external process manager (Docker/systemd).${NC}"
    echo -e "If you are running this manually, please restart your Node.js process:"
    echo -e "  node .output/server/index.mjs"
fi

echo "------------------------------------------------"
echo -e "${GREEN}🎉 Rebuild Complete! The new template is now live.${NC}"
echo -e "Note: If you use an external process manager (like Docker or Systemd), you may need to restart the service manually if PM2 was not used."
