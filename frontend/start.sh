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
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

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
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    print_warning ".env.local or .env not found"
    echo "Creating from .env.example..."
    cp .env.example .env.local 2>/dev/null || {
        echo "Please create .env.local with required configuration"
    }
fi

# 检查并启动 Docker 数据库
print_info "Checking Docker database..."

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

# 检查数据库容器是否运行
if docker ps | grep -q "slide-forge-db"; then
    print_success "Database container already running"
else
    print_info "Starting PostgreSQL container..."

    # 启动数据库容器
    docker-compose up -d postgres || {
        print_error "Failed to start database container"
        exit 1
    }

    print_success "Database container started"

    # 等待数据库就绪
    print_info "Waiting for database to be ready..."
    sleep 3

    # 检查数据库是否可访问
    for i in {1..10}; do
        if docker exec slide-forge-db pg_isready -U presentation_user &> /dev/null; then
            print_success "Database is ready"
            break
        fi
        if [ $i -eq 10 ]; then
            print_error "Database failed to start"
            exit 1
        fi
        echo -n "."
        sleep 1
    done
fi

echo ""
print_info "🚀 Starting development server..."
echo ""
echo "Access the app at:"
echo ""
echo -e "  ${GREEN}➜${NC}  Local:   ${BLUE}http://localhost:8080${NC}"
echo -e "  ${GREEN}➜${NC}  Agent:   ${BLUE}http://localhost:8080/presentation/agent${NC}"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "════════════════════════════════════════════════════════"
echo ""

# 启动
pnpm dev
