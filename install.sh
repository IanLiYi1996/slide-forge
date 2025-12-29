#!/bin/bash

###############################################################################
# Slide Forge - 一键安装启动脚本
# 自动完成环境检查、依赖安装、数据库配置、服务启动
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
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

print_header() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}║           Slide Forge - AI PPT Generator              ║${NC}"
    echo -e "${GREEN}║              One-Click Installation                    ║${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

###############################################################################
# 1. 环境检查
###############################################################################

check_environment() {
    print_info "Checking environment..."

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        print_info "Visit: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version must be 18 or higher. Current: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v) detected"

    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        print_warning "pnpm is not installed. Installing pnpm..."
        npm install -g pnpm
    fi
    print_success "pnpm $(pnpm -v) detected"

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        print_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1) detected"

    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        print_info "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    print_success "Docker Compose detected"

    # 检查 Git
    if ! command -v git &> /dev/null; then
        print_warning "Git is not installed."
    else
        print_success "Git detected"
    fi
}

###############################################################################
# 2. 环境变量配置
###############################################################################

setup_environment() {
    print_info "Setting up environment variables..."

    if [ ! -f ".env.local" ]; then
        if [ -f ".env.example" ]; then
            print_info "Creating .env.local from .env.example..."
            cp .env.example .env.local
            print_success ".env.local created"

            print_warning "⚠️  IMPORTANT: Please configure the following in .env.local:"
            echo ""
            echo "  1. DATABASE_URL - Your PostgreSQL connection string"
            echo "  2. NEXTAUTH_SECRET - Run: openssl rand -base64 32"
            echo "  3. UNSPLASH_ACCESS_KEY - Get from: https://unsplash.com/developers"
            echo "  4. AWS Credentials (if using Bedrock):"
            echo "     - AWS_ACCESS_KEY_ID"
            echo "     - AWS_SECRET_ACCESS_KEY"
            echo "     - AWS_REGION"
            echo ""

            read -p "Press Enter to open .env.local in editor (or Ctrl+C to skip)..."
            ${EDITOR:-nano} .env.local || true
        else
            print_error ".env.example not found. Creating minimal .env.local..."
            cat > .env.local << 'EOF'
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/slide_forge"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Unsplash API (for auto images)
UNSPLASH_ACCESS_KEY=""

# AWS Bedrock (for Claude Agent)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-west-2"

# Optional
OPENAI_API_KEY=""
TAVILY_API_KEY=""
EOF
            print_success "Minimal .env.local created"
            print_warning "Please edit .env.local and configure your credentials"
        fi
    else
        print_success ".env.local already exists"
    fi
}

###############################################################################
# 3. 安装依赖
###############################################################################

install_dependencies() {
    print_info "Installing dependencies with pnpm..."

    if [ ! -d "node_modules" ]; then
        print_info "First time installation, this may take a few minutes..."
    fi

    pnpm install

    print_success "Dependencies installed"
}

###############################################################################
# 4. Docker 数据库设置
###############################################################################

setup_docker_database() {
    print_info "Setting up Docker database..."

    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi

    # 检查数据库容器是否已运行
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
                print_error "Database failed to start after 10 attempts"
                exit 1
            fi
            echo -n "."
            sleep 1
        done
    fi

    # 运行 Prisma 迁移
    print_info "Running Prisma migrations..."
    pnpm prisma db push --skip-generate || {
        print_error "Database migration failed"
        print_info "You can run it manually later: pnpm prisma db push"
        return
    }

    print_info "Generating Prisma Client..."
    pnpm prisma generate

    print_success "Database setup completed"
}

###############################################################################
# 5. 构建检查
###############################################################################

check_build() {
    print_info "Checking TypeScript compilation..."

    pnpm tsc --noEmit 2>&1 | grep -E "^src/" | head -5 || true

    # 不阻止启动，只是警告
    if [ $? -eq 0 ]; then
        print_warning "Some TypeScript errors detected (won't block startup)"
    else
        print_success "No TypeScript errors in main codebase"
    fi
}

###############################################################################
# 6. 显示配置信息
###############################################################################

show_configuration() {
    echo ""
    print_info "════════════════ Configuration Summary ════════════════"
    echo ""

    # 检查关键配置
    if [ -f ".env.local" ]; then
        echo "📄 Environment File: .env.local ✅"

        # 检查数据库
        if docker ps | grep -q "slide-forge-db"; then
            echo "🗄️  Database: Docker PostgreSQL running ✅"
        else
            echo "🗄️  Database: ⚠️  Docker container not running"
        fi

        # 检查 Unsplash
        if grep -q 'UNSPLASH_ACCESS_KEY=""' .env.local || ! grep -q "UNSPLASH_ACCESS_KEY" .env.local; then
            echo "🖼️  Unsplash: ⚠️  Not configured (auto images disabled)"
        else
            echo "🖼️  Unsplash: Configured ✅"
        fi

        # 检查 AWS
        if grep -q 'AWS_ACCESS_KEY_ID=""' .env.local || ! grep -q "AWS_ACCESS_KEY_ID" .env.local; then
            echo "☁️  AWS Bedrock: ⚠️  Not configured (Claude Agent may not work)"
        else
            echo "☁️  AWS Bedrock: Configured ✅"
        fi
    else
        echo "📄 Environment File: ⚠️  .env.local not found"
    fi

    echo ""
    echo "📦 Dependencies: Installed ✅"
    echo "🎨 Frontend: Next.js 15 + React 19"
    echo "🤖 Agent: Claude Agent SDK + Amazon Bedrock"
    echo "📊 Charts: AntV Infographic"
    echo ""
}

###############################################################################
# 7. 启动服务
###############################################################################

start_service() {
    print_info "════════════════ Starting Slide Forge ════════════════"
    echo ""
    print_success "🚀 Starting development server..."
    echo ""
    print_info "Access the app at:"
    echo ""
    echo -e "  ${GREEN}➜${NC}  Local:   ${BLUE}http://localhost:3000${NC}"
    echo -e "  ${GREEN}➜${NC}  Agent:   ${BLUE}http://localhost:3000/presentation/agent${NC}"
    echo ""
    print_info "Press Ctrl+C to stop the server"
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo ""

    # 启动开发服务器
    pnpm dev
}

###############################################################################
# 主流程
###############################################################################

main() {
    print_header

    # 检查是否在正确的目录
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root directory."
        exit 1
    fi

    # 执行各个步骤
    check_environment
    setup_environment
    install_dependencies
    setup_docker_database
    check_build
    show_configuration

    echo ""
    read -p "$(echo -e ${GREEN}Ready to start?${NC} Press Enter to continue or Ctrl+C to exit...)"
    echo ""

    start_service
}

# 运行主流程
main
