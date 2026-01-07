#!/bin/bash

# ==============================================================================
# Slide-Forge 环境变量配置脚本
# ==============================================================================
# 功能：交互式创建 .env 配置文件
# 使用：./scripts/configure.sh
# ==============================================================================

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$INFRA_DIR/.env"

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

# ==============================================================================
# 主流程
# ==============================================================================

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          Slide-Forge 环境变量配置向导                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo ""
print_info "此脚本将帮助你创建 .env 配置文件"
echo ""

# 检查是否已存在
if [ -f "$ENV_FILE" ]; then
  print_warning ".env 文件已存在"
  read -p "是否覆盖? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "已取消"
    exit 0
  fi
  # 备份现有文件
  cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
  print_success "已备份现有配置"
fi

# ==============================================================================
# 收集配置
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "基础配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# AWS Region
current_region=$(aws configure get region 2>/dev/null || echo "us-east-1")
read -p "AWS Region [$current_region]: " AWS_REGION
AWS_REGION=${AWS_REGION:-$current_region}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Claude Agent SDK 配置 (必需)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "选择认证方式:"
echo "  1) AWS Bedrock (推荐 - 使用 IAM，无需 API key)"
echo "  2) Anthropic API (需要 API key)"
echo ""
read -p "选择 [1]: " auth_choice
auth_choice=${auth_choice:-1}

if [ "$auth_choice" = "1" ]; then
  USE_BEDROCK=1
  ANTHROPIC_API_KEY=""
  print_success "将使用 AWS Bedrock"
else
  USE_BEDROCK=0
  echo ""
  print_info "从 https://console.anthropic.com/ 获取 API Key"
  read -sp "Anthropic API Key: " ANTHROPIC_API_KEY
  echo ""
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    print_warning "API Key 为空，将使用 Bedrock"
    USE_BEDROCK=1
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "身份认证配置 (必需)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

print_info "配置初始管理员用户（用于首次登录系统）"
echo ""
read -p "管理员邮箱: " COGNITO_ADMIN_EMAIL

# 验证邮箱
if [ -z "$COGNITO_ADMIN_EMAIL" ]; then
  print_warning "管理员邮箱为空，将无法自动创建管理员"
elif ! [[ "$COGNITO_ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  print_warning "邮箱格式无效，请重新运行配置"
else
  print_success "管理员邮箱: $COGNITO_ADMIN_EMAIL"
  print_info "部署完成后，此邮箱会收到临时密码"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "可选服务配置 (按 Enter 跳过)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Tavily
print_info "Tavily - 网络搜索服务 (https://tavily.com)"
read -sp "Tavily API Key (可选): " TAVILY_API_KEY
echo ""

# UploadThing
echo ""
print_info "UploadThing - 文件上传服务 (https://uploadthing.com)"
read -sp "UploadThing Token (可选): " UPLOADTHING_TOKEN
echo ""

# Unsplash
echo ""
print_info "Unsplash - 图片服务 (https://unsplash.com/developers)"
read -sp "Unsplash Access Key (可选): " UNSPLASH_ACCESS_KEY
echo ""

# LLM
echo ""
print_info "其他 LLM 服务 (OpenAI, LM Studio, 等)"
read -sp "LLM API Key (可选): " LLM_API_KEY
echo ""

if [ -n "$LLM_API_KEY" ]; then
  read -p "LLM Base URL (可选): " LLM_BASE_URL
  read -p "LLM Model Name [gpt-4o-mini]: " LLM_MODEL_NAME
  LLM_MODEL_NAME=${LLM_MODEL_NAME:-gpt-4o-mini}
fi

# ==============================================================================
# 写入配置文件
# ==============================================================================

echo ""
print_info "正在创建 .env 文件..."

cat > "$ENV_FILE" << EOF
# ==============================================================================
# Slide-Forge 部署配置
# 生成时间: $(date)
# ==============================================================================

# AWS 配置
AWS_REGION=$AWS_REGION

# ==============================================================================
# Claude Agent SDK 配置 (必需)
# ==============================================================================
EOF

if [ "$USE_BEDROCK" = "1" ]; then
  echo "CLAUDE_CODE_USE_BEDROCK=1" >> "$ENV_FILE"
else
  echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> "$ENV_FILE"
fi

cat >> "$ENV_FILE" << EOF

# ==============================================================================
# 身份认证配置 (必需)
# ==============================================================================
COGNITO_ADMIN_EMAIL=$COGNITO_ADMIN_EMAIL

# ==============================================================================
# 可选服务 API Keys
# ==============================================================================
EOF

[ -n "$TAVILY_API_KEY" ] && echo "TAVILY_API_KEY=$TAVILY_API_KEY" >> "$ENV_FILE"
[ -n "$UPLOADTHING_TOKEN" ] && echo "UPLOADTHING_TOKEN=$UPLOADTHING_TOKEN" >> "$ENV_FILE"
[ -n "$UNSPLASH_ACCESS_KEY" ] && echo "UNSPLASH_ACCESS_KEY=$UNSPLASH_ACCESS_KEY" >> "$ENV_FILE"
[ -n "$LLM_API_KEY" ] && echo "LLM_API_KEY=$LLM_API_KEY" >> "$ENV_FILE"
[ -n "$LLM_BASE_URL" ] && echo "LLM_BASE_URL=$LLM_BASE_URL" >> "$ENV_FILE"
[ -n "$LLM_MODEL_NAME" ] && echo "LLM_MODEL_NAME=$LLM_MODEL_NAME" >> "$ENV_FILE"

echo ""
print_success "配置文件已创建: $ENV_FILE"

# ==============================================================================
# 显示配置摘要
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "配置摘要"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "AWS Region: $AWS_REGION"
[ "$USE_BEDROCK" = "1" ] && print_success "Claude: AWS Bedrock" || print_success "Claude: Anthropic API"
[ -n "$COGNITO_ADMIN_EMAIL" ] && print_success "管理员邮箱: $COGNITO_ADMIN_EMAIL" || print_warning "管理员邮箱: 未配置"
[ -n "$TAVILY_API_KEY" ] && print_success "Tavily: 已配置" || echo "Tavily: 未配置"
[ -n "$UPLOADTHING_TOKEN" ] && print_success "UploadThing: 已配置" || echo "UploadThing: 未配置"
[ -n "$UNSPLASH_ACCESS_KEY" ] && print_success "Unsplash: 已配置" || echo "Unsplash: 未配置"
[ -n "$LLM_API_KEY" ] && print_success "其他 LLM: 已配置" || echo "其他 LLM: 未配置"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

print_success "配置完成！"
echo ""
echo "下一步:"
echo "  1. 查看配置: cat $ENV_FILE"
echo "  2. 执行部署: ./scripts/deploy.sh --non-interactive"
echo "  3. 或使用: pnpm deploy"
echo ""
