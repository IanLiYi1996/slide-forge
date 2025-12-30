#!/bin/bash

###############################################################################
# Slide Forge - 数据库启动脚本
# 独立启动 PostgreSQL Docker 容器
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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      Slide Forge - Database Startup        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

# 检查数据库容器是否已运行
if docker ps | grep -q "slide-forge-db"; then
    print_success "Database container is already running"
    echo ""
    echo "Container Status:"
    docker ps --filter "name=slide-forge-db" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    print_info "Database accessible at: localhost:5432"
    print_info "Username: presentation_user"
    print_info "Database: slide_forge"
    exit 0
fi

# 启动数据库容器
print_info "Starting PostgreSQL container..."
docker-compose up -d postgres || {
    print_error "Failed to start database container"
    exit 1
}

print_success "Database container started"

# 等待数据库就绪
print_info "Waiting for database to be ready..."
sleep 3

# 检查数据库是否可访问
for i in {1..15}; do
    if docker exec slide-forge-db pg_isready -U presentation_user &> /dev/null; then
        echo ""
        print_success "Database is ready and accepting connections"
        echo ""
        echo "Container Status:"
        docker ps --filter "name=slide-forge-db" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        print_info "Database accessible at: localhost:5432"
        print_info "Username: presentation_user"
        print_info "Database: slide_forge"
        echo ""
        print_info "Connection string:"
        echo "  postgresql://presentation_user:presentation_password@localhost:5432/slide_forge"
        echo ""
        exit 0
    fi
    if [ $i -eq 15 ]; then
        print_error "Database failed to start after 15 attempts"
        print_info "Check logs with: docker logs slide-forge-db"
        exit 1
    fi
    echo -n "."
    sleep 1
done
