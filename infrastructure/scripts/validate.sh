#!/bin/bash

# ==============================================================================
# Slide-Forge 配置验证脚本
# ==============================================================================
# 功能：验证环境变量配置和 AWS 资源准备情况
# 使用：./scripts/validate.sh
# ==============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$INFRA_DIR/.env"

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          Slide-Forge 配置验证工具                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

has_error=false
has_warning=false

# ==============================================================================
# 1. 检查 .env 文件
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 环境变量配置检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "$ENV_FILE" ]; then
  print_success ".env 文件存在: $ENV_FILE"
  source "$ENV_FILE"
else
  print_error ".env 文件不存在"
  print_info "运行以下命令创建: ./scripts/configure.sh"
  has_error=true
fi

# 检查必需的环境变量
if [ "$CLAUDE_CODE_USE_BEDROCK" = "1" ]; then
  print_success "Claude Agent SDK: 使用 AWS Bedrock"
elif [ -n "$ANTHROPIC_API_KEY" ]; then
  print_success "Claude Agent SDK: 使用 Anthropic API"
  echo "  API Key: ${ANTHROPIC_API_KEY:0:20}..."
else
  print_error "Claude Agent SDK 配置缺失"
  print_info "需要设置 CLAUDE_CODE_USE_BEDROCK=1 或 ANTHROPIC_API_KEY"
  has_error=true
fi

# 检查 AWS Region
if [ -n "$AWS_REGION" ]; then
  print_success "AWS Region: $AWS_REGION"
else
  print_warning "AWS_REGION 未设置，将使用默认值"
  has_warning=true
fi

# 检查可选服务
echo ""
echo "可选服务状态:"
[ -n "$TAVILY_API_KEY" ] && print_success "  Tavily API (网络搜索)" || echo "  • Tavily: 未配置"
[ -n "$UPLOADTHING_TOKEN" ] && print_success "  UploadThing (文件上传)" || echo "  • UploadThing: 未配置"
[ -n "$UNSPLASH_ACCESS_KEY" ] && print_success "  Unsplash (图片服务)" || echo "  • Unsplash: 未配置"
[ -n "$LLM_API_KEY" ] && print_success "  其他 LLM 服务" || echo "  • 其他 LLM: 未配置"

# ==============================================================================
# 2. 检查 AWS 凭证
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. AWS 凭证和权限检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if aws sts get-caller-identity &> /dev/null; then
  account_id=$(aws sts get-caller-identity --query Account --output text)
  user_arn=$(aws sts get-caller-identity --query Arn --output text)
  print_success "AWS 账号: $account_id"
  print_success "当前身份: $user_arn"
else
  print_error "AWS 凭证未配置或无效"
  print_info "运行: aws configure"
  has_error=true
fi

# ==============================================================================
# 3. 检查 Bedrock 模型访问 (如果使用 Bedrock)
# ==============================================================================

if [ "$CLAUDE_CODE_USE_BEDROCK" = "1" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "3. Bedrock 模型访问检查"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  if aws bedrock list-foundation-models --region "$AWS_REGION" &> /dev/null; then
    print_success "Bedrock API 可访问"

    # 检查 Claude 模型
    if aws bedrock list-foundation-models \
      --region "$AWS_REGION" \
      --by-provider anthropic \
      --query 'modelSummaries[?contains(modelId, `claude-3-5-sonnet`)].modelId' \
      --output text 2>/dev/null | grep -q "claude"; then
      print_success "Claude 3.5 Sonnet 模型可用"
    else
      print_warning "未找到 Claude 模型"
      print_info "可能需要在 AWS Console 中请求模型访问权限"
      print_info "访问: AWS Console → Bedrock → Model access"
      has_warning=true
    fi
  else
    print_error "无法访问 Bedrock API"
    print_info "检查 IAM 权限或区域支持"
    has_error=true
  fi
fi

# ==============================================================================
# 4. 检查前端构建状态
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. 前端构建检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FRONTEND_DIR="$INFRA_DIR/../frontend"
if [ -d "$FRONTEND_DIR/.next" ]; then
  print_success "前端已构建"
  build_size=$(du -sh "$FRONTEND_DIR/.next" | cut -f1)
  echo "  构建大小: $build_size"
else
  print_warning "前端未构建"
  print_info "部署前会自动构建"
fi

# ==============================================================================
# 5. 检查 Docker
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Docker 检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v docker &> /dev/null; then
  print_success "Docker 已安装"
  if docker info &> /dev/null; then
    print_success "Docker daemon 运行中"
  else
    print_error "Docker daemon 未运行"
    print_info "启动 Docker: sudo systemctl start docker"
    has_error=true
  fi
else
  print_error "Docker 未安装"
  print_info "CDK 需要 Docker 来构建镜像"
  has_error=true
fi

# ==============================================================================
# 6. 检查 CDK Bootstrap
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. CDK Bootstrap 检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$account_id" ] && [ -n "$AWS_REGION" ]; then
  if aws cloudformation describe-stacks \
    --stack-name "CDKToolkit" \
    --region "$AWS_REGION" &> /dev/null; then
    print_success "CDK 已 bootstrap"
  else
    print_warning "CDK 未 bootstrap"
    print_info "首次部署需要运行: pnpm cdk bootstrap"
    has_warning=true
  fi
fi

# ==============================================================================
# 7. 检查依赖
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. 依赖检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$INFRA_DIR"
if [ -d "node_modules" ]; then
  print_success "Infrastructure 依赖已安装"
else
  print_warning "Infrastructure 依赖未安装"
  print_info "运行: pnpm install"
  has_warning=true
fi

cd "$FRONTEND_DIR"
if [ -d "node_modules" ]; then
  print_success "Frontend 依赖已安装"
else
  print_warning "Frontend 依赖未安装"
  print_info "运行: cd frontend && pnpm install"
  has_warning=true
fi

# ==============================================================================
# 最终结果
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "验证结果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$has_error" = true ]; then
  print_error "验证失败 - 发现严重问题"
  echo ""
  echo "请先解决上述错误，然后重新运行验证"
  exit 1
elif [ "$has_warning" = true ]; then
  print_warning "验证通过 - 但有一些警告"
  echo ""
  echo "可以继续部署，但建议先解决警告项"
  echo ""
  read -p "是否继续部署? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "准备部署..."
    exit 0
  else
    exit 0
  fi
else
  print_success "验证通过 - 所有检查都已通过！"
  echo ""
  print_success "🚀 项目已准备好部署到 AWS"
  echo ""
  echo "执行部署:"
  echo "  ./scripts/deploy.sh --non-interactive"
  echo ""
  echo "或使用:"
  echo "  pnpm deploy"
  exit 0
fi
