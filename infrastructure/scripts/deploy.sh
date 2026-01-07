#!/bin/bash

# ==============================================================================
# Slide-Forge 自动化部署脚本
# ==============================================================================
# 功能：
# - 交互式配置环境变量
# - 自定义 Stack Name
# - 自动创建 .env 文件
# - 执行 CDK 部署
# - 验证部署结果
#
# 使用方法：
#   ./scripts/deploy.sh                    # 交互式模式
#   ./scripts/deploy.sh --non-interactive  # 使用现有 .env
#   ./scripts/deploy.sh --help            # 显示帮助
# ==============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$INFRA_DIR/.." && pwd)"

# 默认值
DEFAULT_STACK_NAME="slide-forge"
DEFAULT_ENVIRONMENT="dev"
DEFAULT_AWS_REGION="us-east-1"
DEFAULT_USE_BEDROCK="true"

# ==============================================================================
# 工具函数
# ==============================================================================

print_header() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

prompt_input() {
  local prompt="$1"
  local default="$2"
  local var_name="$3"
  local is_secret="${4:-false}"

  if [ -n "$default" ]; then
    prompt="$prompt [默认: $default]"
  fi

  echo -n "$prompt: "
  if [ "$is_secret" = "true" ]; then
    read -s value
    echo  # 换行
  else
    read value
  fi

  if [ -z "$value" ] && [ -n "$default" ]; then
    value="$default"
  fi

  eval "$var_name='$value'"
}

# ==============================================================================
# 显示帮助
# ==============================================================================

show_help() {
  cat << EOF
Slide-Forge AWS 部署脚本

使用方法:
  $0 [选项]

选项:
  -h, --help              显示此帮助信息
  -n, --non-interactive   非交互模式，使用现有 .env 文件
  -s, --stack-name NAME   指定 Stack 名称 (默认: slide-forge)
  -e, --environment ENV   指定环境 (dev/prod，默认: dev)
  --check-only           只检查配置，不部署

示例:
  # 交互式部署
  $0

  # 使用自定义 stack name
  $0 --stack-name my-slides --environment prod

  # 使用现有 .env 部署
  $0 --non-interactive

环境变量:
  ANTHROPIC_API_KEY      Anthropic API Key (可选)
  CLAUDE_CODE_USE_BEDROCK  使用 AWS Bedrock (true/false)
  TAVILY_API_KEY         Tavily 搜索 API (可选)
  UPLOADTHING_TOKEN      UploadThing Token (可选)
  LLM_API_KEY            其他 LLM API Key (可选)

更多信息: 阅读 QUICK_DEPLOY.md
EOF
}

# ==============================================================================
# 参数解析
# ==============================================================================

INTERACTIVE=true
CHECK_ONLY=false
STACK_NAME=""
ENVIRONMENT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -n|--non-interactive)
      INTERACTIVE=false
      shift
      ;;
    -s|--stack-name)
      STACK_NAME="$2"
      shift 2
      ;;
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    *)
      print_error "未知选项: $1"
      show_help
      exit 1
      ;;
  esac
done

# ==============================================================================
# 主流程
# ==============================================================================

main() {
  cd "$INFRA_DIR"

  print_header "🚀 Slide-Forge AWS 部署工具"

  echo ""
  print_info "项目路径: $PROJECT_ROOT"
  print_info "Infrastructure: $INFRA_DIR"
  echo ""

  # 检查前置条件
  check_prerequisites

  # 配置环境变量
  if [ "$INTERACTIVE" = true ]; then
    configure_interactive
  else
    load_existing_env
  fi

  # 显示配置摘要
  show_configuration_summary

  # 检查模式退出
  if [ "$CHECK_ONLY" = true ]; then
    print_success "配置检查完成！"
    exit 0
  fi

  # 确认部署
  confirm_deployment

  # 执行部署
  deploy_to_aws

  # 显示部署结果
  show_deployment_summary
}

# ==============================================================================
# 检查前置条件
# ==============================================================================

check_prerequisites() {
  print_info "检查前置条件..."

  local has_error=false

  # 检查 Node.js
  if ! command -v node &> /dev/null; then
    print_error "Node.js 未安装"
    has_error=true
  else
    print_success "Node.js $(node --version)"
  fi

  # 检查 pnpm
  if ! command -v pnpm &> /dev/null; then
    print_error "pnpm 未安装"
    has_error=true
  else
    print_success "pnpm $(pnpm --version)"
  fi

  # 检查 AWS CLI
  if ! command -v aws &> /dev/null; then
    print_error "AWS CLI 未安装"
    has_error=true
  else
    print_success "AWS CLI $(aws --version | cut -d' ' -f1)"
  fi

  # 检查 CDK
  if ! command -v cdk &> /dev/null; then
    print_warning "CDK CLI 未全局安装，将使用本地版本"
  else
    print_success "CDK $(cdk --version)"
  fi

  # 检查 AWS 凭证
  if aws sts get-caller-identity &> /dev/null; then
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local region=$(aws configure get region || echo "未设置")
    print_success "AWS 账号: $account_id"
    print_success "AWS 区域: $region"
  else
    print_error "AWS 凭证未配置"
    has_error=true
  fi

  if [ "$has_error" = true ]; then
    echo ""
    print_error "前置条件检查失败，请先安装缺失的工具"
    exit 1
  fi

  echo ""
}

# ==============================================================================
# 交互式配置
# ==============================================================================

configure_interactive() {
  print_header "📝 配置部署参数"

  echo ""
  print_info "请输入部署配置（按 Enter 使用默认值）"
  echo ""

  # Stack Name
  prompt_input "Stack 名称" "${STACK_NAME:-$DEFAULT_STACK_NAME}" "STACK_NAME"

  # Environment
  prompt_input "部署环境 (dev/prod)" "${ENVIRONMENT:-$DEFAULT_ENVIRONMENT}" "ENVIRONMENT"

  # AWS Region
  local current_region=$(aws configure get region || echo "$DEFAULT_AWS_REGION")
  prompt_input "AWS Region" "$current_region" "AWS_REGION"

  echo ""
  print_header "🤖 Claude Agent SDK 配置"
  echo ""

  # Claude Agent SDK 配置
  echo "选择 Claude Agent SDK 认证方式:"
  echo "  1) AWS Bedrock (推荐用于 AWS 环境，使用 IAM Role)"
  echo "  2) Anthropic API (需要 API Key)"
  echo ""
  prompt_input "选择 [1/2]" "1" "auth_choice"

  if [ "$auth_choice" = "1" ]; then
    USE_BEDROCK="true"
    ANTHROPIC_API_KEY=""
    print_success "将使用 AWS Bedrock"
  else
    USE_BEDROCK="false"
    echo ""
    print_info "从 https://console.anthropic.com/ 获取 API Key"
    prompt_input "Anthropic API Key" "" "ANTHROPIC_API_KEY" true
    if [ -z "$ANTHROPIC_API_KEY" ]; then
      print_error "Anthropic API Key 不能为空"
      exit 1
    fi
  fi

  echo ""
  print_header "🔐 身份认证配置"
  echo ""

  # 管理员邮箱
  print_info "配置初始管理员用户（用于首次登录系统）"
  echo ""
  prompt_input "管理员邮箱" "" "COGNITO_ADMIN_EMAIL"

  # 验证邮箱格式
  if [ -z "$COGNITO_ADMIN_EMAIL" ]; then
    print_error "管理员邮箱不能为空"
    exit 1
  fi

  if ! [[ "$COGNITO_ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    print_error "邮箱格式无效: $COGNITO_ADMIN_EMAIL"
    exit 1
  fi

  print_success "管理员邮箱: $COGNITO_ADMIN_EMAIL"
  print_info "💡 部署完成后，此邮箱会收到包含临时密码的邀请邮件"

  echo ""
  print_header "🔌 可选服务配置"
  echo ""
  print_info "以下服务为可选，不配置不影响核心功能"
  echo ""

  # Tavily API (网络搜索)
  echo "Tavily API - 网络搜索服务 (https://tavily.com)"
  prompt_input "Tavily API Key (可选，按 Enter 跳过)" "" "TAVILY_API_KEY" true

  # UploadThing (文件上传)
  echo ""
  echo "UploadThing - 文件上传服务 (https://uploadthing.com)"
  prompt_input "UploadThing Token (可选，按 Enter 跳过)" "" "UPLOADTHING_TOKEN" true

  # Unsplash (图片服务)
  echo ""
  echo "Unsplash - 图片服务 (https://unsplash.com/developers)"
  prompt_input "Unsplash Access Key (可选，按 Enter 跳过)" "" "UNSPLASH_ACCESS_KEY" true

  # LLM API (其他 LLM 服务)
  echo ""
  echo "其他 LLM 服务配置 (OpenAI, LM Studio, 等)"
  prompt_input "LLM API Key (可选，按 Enter 跳过)" "" "LLM_API_KEY" true

  if [ -n "$LLM_API_KEY" ]; then
    prompt_input "LLM Base URL (可选)" "" "LLM_BASE_URL"
    prompt_input "LLM Model Name (可选)" "gpt-4o-mini" "LLM_MODEL_NAME"
  fi

  # 写入 .env 文件
  write_env_file
}

# ==============================================================================
# 加载现有 .env
# ==============================================================================

load_existing_env() {
  print_info "使用非交互模式..."

  if [ -f "$INFRA_DIR/.env" ]; then
    print_success "加载现有 .env 文件"
    source "$INFRA_DIR/.env"

    # 设置默认值
    STACK_NAME="${STACK_NAME:-$DEFAULT_STACK_NAME}"
    ENVIRONMENT="${ENVIRONMENT:-$DEFAULT_ENVIRONMENT}"
    AWS_REGION="${AWS_REGION:-$DEFAULT_AWS_REGION}"

    # 检查必需配置
    if [ "$CLAUDE_CODE_USE_BEDROCK" != "1" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
      print_error "错误: 必须设置 CLAUDE_CODE_USE_BEDROCK=1 或 ANTHROPIC_API_KEY"
      exit 1
    fi
  else
    print_error ".env 文件不存在！"
    print_info "请先运行交互模式创建配置: ./scripts/deploy.sh"
    exit 1
  fi
}

# ==============================================================================
# 写入 .env 文件
# ==============================================================================

write_env_file() {
  local env_file="$INFRA_DIR/.env"

  print_info "创建 .env 配置文件..."

  cat > "$env_file" << EOF
# ==============================================================================
# Slide-Forge 部署配置
# 生成时间: $(date)
# ==============================================================================

# Stack 配置
STACK_NAME=$STACK_NAME
ENVIRONMENT=$ENVIRONMENT

# AWS 配置
AWS_REGION=$AWS_REGION

# ==============================================================================
# Claude Agent SDK 配置
# ==============================================================================
EOF

  if [ "$USE_BEDROCK" = "true" ]; then
    cat >> "$env_file" << EOF
CLAUDE_CODE_USE_BEDROCK=1
EOF
  else
    cat >> "$env_file" << EOF
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
EOF
  fi

  # 添加可选服务
  cat >> "$env_file" << EOF

# ==============================================================================
# 可选服务
# ==============================================================================
EOF

  # 认证配置
  cat >> "$env_file" << EOF

# ==============================================================================
# 身份认证配置
# ==============================================================================
COGNITO_ADMIN_EMAIL=$COGNITO_ADMIN_EMAIL
EOF

  # 可选服务
  [ -n "$TAVILY_API_KEY" ] && echo "TAVILY_API_KEY=$TAVILY_API_KEY" >> "$env_file"
  [ -n "$UPLOADTHING_TOKEN" ] && echo "UPLOADTHING_TOKEN=$UPLOADTHING_TOKEN" >> "$env_file"
  [ -n "$UNSPLASH_ACCESS_KEY" ] && echo "UNSPLASH_ACCESS_KEY=$UNSPLASH_ACCESS_KEY" >> "$env_file"
  [ -n "$LLM_API_KEY" ] && echo "LLM_API_KEY=$LLM_API_KEY" >> "$env_file"
  [ -n "$LLM_BASE_URL" ] && echo "LLM_BASE_URL=$LLM_BASE_URL" >> "$env_file"
  [ -n "$LLM_MODEL_NAME" ] && echo "LLM_MODEL_NAME=$LLM_MODEL_NAME" >> "$env_file"

  print_success ".env 文件已创建: $env_file"
}

# ==============================================================================
# 显示配置摘要
# ==============================================================================

show_configuration_summary() {
  echo ""
  print_header "📋 配置摘要"
  echo ""

  echo "Stack 配置:"
  echo "  • Stack Name: $STACK_NAME"
  echo "  • Environment: $ENVIRONMENT"
  echo "  • AWS Region: $AWS_REGION"
  echo ""

  echo "Claude Agent SDK:"
  if [ "$USE_BEDROCK" = "true" ] || [ "$CLAUDE_CODE_USE_BEDROCK" = "1" ]; then
    echo "  • 认证方式: AWS Bedrock (IAM Role)"
    print_success "  使用 Bedrock - 无需管理 API keys"
  else
    echo "  • 认证方式: Anthropic API"
    echo "  • API Key: ${ANTHROPIC_API_KEY:0:20}..."
    print_success "  使用 Anthropic API"
  fi
  echo ""

  echo "身份认证:"
  if [ -n "$COGNITO_ADMIN_EMAIL" ]; then
    echo "  • User Pool: 将自动创建"
    echo "  • 认证方式: 邮箱密码登录"
    echo "  • 注册模式: 仅邀请注册"
    echo "  • 管理员邮箱: $COGNITO_ADMIN_EMAIL"
    print_success "  首次登录密码将通过邮件发送"
  else
    print_warning "  管理员邮箱未配置"
  fi
  echo ""

  echo "可选服务:"
  [ -n "$TAVILY_API_KEY" ] && print_success "  Tavily API (网络搜索)" || echo "  • Tavily API: 未配置"
  [ -n "$UPLOADTHING_TOKEN" ] && print_success "  UploadThing (文件上传)" || echo "  • UploadThing: 未配置"
  [ -n "$UNSPLASH_ACCESS_KEY" ] && print_success "  Unsplash (图片服务)" || echo "  • Unsplash: 未配置"
  [ -n "$LLM_API_KEY" ] && print_success "  其他 LLM 服务" || echo "  • 其他 LLM: 未配置"

  echo ""
}

# ==============================================================================
# 确认部署
# ==============================================================================

confirm_deployment() {
  if [ "$INTERACTIVE" = true ]; then
    echo ""
    print_warning "即将部署到 AWS，这将创建以下资源:"
    echo "  • VPC (3 可用区)"
    echo "  • ECS Fargate 集群"
    echo "  • Application Load Balancer"
    echo "  • Aurora Serverless v2 数据库"
    echo "  • S3 Buckets"
    echo "  • CloudFront 分发"
    echo "  • Secrets Manager 密钥"
    echo ""
    print_warning "预计成本: 开发环境 ~$100/月, 生产环境 ~$300/月"
    echo ""

    read -p "确认部署? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      print_info "部署已取消"
      exit 0
    fi
  fi
}

# ==============================================================================
# 执行部署
# ==============================================================================

deploy_to_aws() {
  echo ""
  print_header "🔨 开始部署"
  echo ""

  # 1. 安装依赖
  print_info "步骤 1/5: 安装 CDK 依赖..."
  if ! pnpm install --frozen-lockfile; then
    print_error "依赖安装失败"
    exit 1
  fi
  print_success "依赖安装完成"
  echo ""

  # 2. 构建前端
  print_info "步骤 2/5: 构建 Next.js 应用..."
  cd "$PROJECT_ROOT/frontend"
  if ! pnpm build; then
    print_error "前端构建失败"
    exit 1
  fi
  print_success "前端构建完成"
  echo ""

  # 3. CDK Synth
  cd "$INFRA_DIR"
  print_info "步骤 3/5: 合成 CloudFormation 模板..."
  if ! pnpm cdk synth --quiet; then
    print_error "CDK synth 失败"
    exit 1
  fi
  print_success "模板合成完成"
  echo ""

  # 4. 显示变更
  print_info "步骤 4/5: 检查将要创建的资源..."
  echo ""
  pnpm cdk diff || true
  echo ""

  # 5. 执行部署
  print_info "步骤 5/5: 部署到 AWS..."
  echo ""
  print_warning "这可能需要 10-15 分钟，请耐心等待..."
  echo ""

  # 设置 Stack Name 和 Environment
  local deploy_cmd="pnpm cdk deploy --all --require-approval never"

  if [ -n "$STACK_NAME" ]; then
    deploy_cmd="$deploy_cmd --context stackName=$STACK_NAME"
  fi

  if [ -n "$ENVIRONMENT" ]; then
    deploy_cmd="$deploy_cmd --context environment=$ENVIRONMENT"
  fi

  if eval "$deploy_cmd"; then
    print_success "部署成功！"
  else
    print_error "部署失败"
    exit 1
  fi
}

# ==============================================================================
# 显示部署结果
# ==============================================================================

show_deployment_summary() {
  echo ""
  print_header "🎉 部署完成"
  echo ""

  # 获取 Stack 输出
  local stack_name_full="${STACK_NAME}-${ENVIRONMENT}"

  print_info "获取部署信息..."
  echo ""

  # CloudFront URL
  local cf_url=$(aws cloudformation describe-stacks \
    --stack-name "$stack_name_full" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
    --output text 2>/dev/null || echo "")

  if [ -n "$cf_url" ]; then
    print_success "应用地址: $cf_url"
    echo ""
    echo "访问以下页面测试功能:"
    echo "  • 主页: $cf_url"
    echo "  • Agent 对话: $cf_url/presentation/agent"
    echo "  • 文档处理: $cf_url/document-processor"
    echo "  • 健康检查: $cf_url/api/health"
  fi

  echo ""

  # ECS 信息
  local cluster_name=$(aws cloudformation describe-stacks \
    --stack-name "$stack_name_full" \
    --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue" \
    --output text 2>/dev/null || echo "")

  if [ -n "$cluster_name" ]; then
    echo "ECS 集群信息:"
    echo "  • 集群名称: $cluster_name"
    echo ""
    echo "查看日志:"
    echo "  aws logs tail /ecs/$STACK_NAME-$ENVIRONMENT --follow"
  fi

  echo ""

  # Cognito 信息
  local cognito_domain=$(aws cloudformation describe-stacks \
    --stack-name "$stack_name_full" \
    --query "Stacks[0].Outputs[?OutputKey=='CognitoDomain'].OutputValue" \
    --output text 2>/dev/null || echo "")

  if [ -n "$cognito_domain" ]; then
    print_header "🔐 身份认证信息"
    echo ""

    echo "Cognito User Pool 已创建:"
    echo "  • Hosted UI: https://$cognito_domain"
    echo "  • 管理员邮箱: $COGNITO_ADMIN_EMAIL"
    echo ""

    print_warning "📧 重要: 请检查邮箱 ($COGNITO_ADMIN_EMAIL)"
    echo "您将收到包含临时密码的邀请邮件"
    echo ""
    echo "首次登录步骤:"
    echo "  1. 访问应用 URL: $cf_url"
    echo "  2. 点击 'Sign In'"
    echo "  3. 使用邮箱和临时密码登录"
    echo "  4. 按提示修改为永久密码"
    echo "  5. 使用 Prisma Studio 设置管理员权限:"
    echo "     cd frontend && pnpm prisma studio"
    echo "     将 role 设为 'ADMIN'，hasAccess 设为 true"
    echo ""
  fi

  print_header "📚 后续步骤"
  echo ""
  echo "1. 验证部署:"
  echo "   curl $cf_url/api/health"
  echo ""
  echo "2. 查看日志:"
  echo "   aws logs tail /ecs/$STACK_NAME-$ENVIRONMENT --follow"
  echo ""
  echo "3. 配置自定义域名 (可选):"
  echo "   - 在 Route 53 创建 CNAME 记录指向 CloudFront"
  echo ""
  echo "4. 监控资源:"
  echo "   - CloudWatch Dashboards"
  echo "   - ECS Service Metrics"
  echo "   - Bedrock API 调用量"
  echo ""

  print_success "部署完成！🎊"
}

# ==============================================================================
# 主程序入口
# ==============================================================================

main "$@"
