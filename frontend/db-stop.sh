#!/bin/bash

###############################################################################
# Slide Forge - 数据库停止脚本
# 停止 PostgreSQL Docker 容器
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
echo -e "${GREEN}║      Slide Forge - Database Shutdown       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

# 检查数据库容器是否运行
if ! docker ps | grep -q "slide-forge-db"; then
    print_warning "Database container is not running"
    exit 0
fi

# 询问是否删除数据
echo -e "${YELLOW}Choose an option:${NC}"
echo ""
echo "  1) Stop database (keep data)"
echo "  2) Stop and remove all data (⚠️  WARNING: Deletes everything)"
echo "  3) Cancel"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        print_info "Stopping database container..."
        docker-compose stop postgres
        print_success "Database stopped (data preserved)"
        print_info "Restart with: ./db-start.sh or docker-compose up -d postgres"
        ;;
    2)
        print_warning "This will permanently delete all database data!"
        read -p "Are you sure? Type 'yes' to confirm: " confirm
        if [ "$confirm" = "yes" ]; then
            print_info "Stopping and removing database..."
            docker-compose down -v
            print_success "Database stopped and data removed"
            print_info "Next start will create a fresh database"
        else
            print_info "Cancelled"
        fi
        ;;
    3)
        print_info "Cancelled"
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
