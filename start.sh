#!/bin/bash

###############################################################################
# Slide Forge - 快速启动脚本
# 用于已安装的项目快速启动开发服务器
###############################################################################

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Slide Forge - Quick Start         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}Error: package.json not found${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Dependencies not installed. Running install.sh first...${NC}"
    echo ""
    ./install.sh
    exit 0
fi

# 检查环境变量
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}Warning: .env.local not found${NC}"
    echo "Creating from .env.example..."
    cp .env.example .env.local 2>/dev/null || {
        echo "Please create .env.local with required configuration"
    }
fi

echo -e "${BLUE}🚀 Starting development server...${NC}"
echo ""
echo "Access the app at:"
echo ""
echo -e "  ${GREEN}➜${NC}  Local:   ${BLUE}http://localhost:3000${NC}"
echo -e "  ${GREEN}➜${NC}  Agent:   ${BLUE}http://localhost:3000/presentation/agent${NC}"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "════════════════════════════════════════════════════════"
echo ""

# 启动
pnpm dev
