#!/bin/bash

# ==============================================================================
# Slide-Forge 静态资源同步脚本
# ==============================================================================
# 从 Docker 镜像中提取静态资源并同步到 S3
#
# 使用方法：
#   ./scripts/sync-static.sh                    # 使用默认 stack name
#   ./scripts/sync-static.sh --stack-name xxx   # 指定 stack name
# ==============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 默认值
STACK_NAME="slide-forge"
ENVIRONMENT="development"

# 加载 .env 文件
if [ -f "$INFRA_DIR/.env" ]; then
  source "$INFRA_DIR/.env"
  STACK_NAME="${STACK_NAME:-slide-forge}"
  ENVIRONMENT="${ENVIRONMENT:-development}"
fi

# 参数解析
while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--stack-name)
      STACK_NAME="$2"
      shift 2
      ;;
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -h|--help)
      echo "用法: $0 [选项]"
      echo ""
      echo "选项:"
      echo "  -s, --stack-name NAME   Stack 名称 (默认: slide-forge)"
      echo "  -e, --environment ENV   环境 (默认: development)"
      echo "  -h, --help             显示帮助"
      exit 0
      ;;
    *)
      print_error "未知选项: $1"
      exit 1
      ;;
  esac
done

echo ""
print_info "Slide-Forge 静态资源同步"
echo ""

# 获取 AWS 信息
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")
STACK_NAME_FULL="${STACK_NAME}-${ENVIRONMENT}"
ECR_REPO="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/cdk-hnb659fds-container-assets-$ACCOUNT_ID-$REGION"

print_info "Stack: $STACK_NAME_FULL"
print_info "Region: $REGION"
print_info "Account: $ACCOUNT_ID"
echo ""

# 获取 Stack 输出
print_info "获取 Stack 输出..."

STATIC_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME_FULL" \
  --query "Stacks[0].Outputs[?contains(OutputKey, 'StaticBucketName')].OutputValue" \
  --output text 2>/dev/null | head -1)

# 尝试多种方式获取 Distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME_FULL" \
  --query "Stacks[0].Outputs[?OutputKey=='DeploymentInstructions'].OutputValue" \
  --output text 2>/dev/null | grep -oP 'distribution-id \K[A-Z0-9]+' || echo "")

if [ -z "$DISTRIBUTION_ID" ]; then
  # 尝试从 CloudFront 输出获取
  DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME_FULL" \
    --query "Stacks[0].Outputs" \
    --output json 2>/dev/null | grep -oP '"OutputValue":\s*"(E[A-Z0-9]+)"' | head -1 | grep -oP 'E[A-Z0-9]+' || echo "")
fi

if [ -z "$STATIC_BUCKET" ]; then
  print_error "无法获取 Static Bucket，请检查 Stack 是否部署成功"
  exit 1
fi

print_success "Static Bucket: $STATIC_BUCKET"
print_success "Distribution ID: ${DISTRIBUTION_ID:-未找到}"
echo ""

# 登录 ECR
print_info "登录 ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com" 2>/dev/null
print_success "ECR 登录成功"

# 获取当前运行的镜像（优先从 ECS 任务获取）
print_info "查找当前运行的 Docker 镜像..."

CLUSTER_NAME="${STACK_NAME}-${ENVIRONMENT}-cluster"
RUNNING_IMAGE=""

# 尝试从 ECS 任务获取
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --query "taskArns[0]" --output text 2>/dev/null || echo "")

if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
  RUNNING_IMAGE=$(aws ecs describe-tasks \
    --cluster "$CLUSTER_NAME" \
    --tasks "$TASK_ARN" \
    --query "tasks[0].containers[0].image" \
    --output text 2>/dev/null || echo "")
fi

if [ -n "$RUNNING_IMAGE" ] && [ "$RUNNING_IMAGE" != "None" ]; then
  print_success "从 ECS 任务获取镜像: ${RUNNING_IMAGE:(-40)}..."
  FULL_IMAGE="$RUNNING_IMAGE"
else
  # 回退到最近推送的镜像
  print_warning "无法从 ECS 获取镜像，使用最近推送的镜像"
  LATEST_TAG=$(aws ecr describe-images \
    --repository-name "cdk-hnb659fds-container-assets-$ACCOUNT_ID-$REGION" \
    --query "imageDetails | sort_by(@, &imagePushedAt) | [-1].imageTags[0]" \
    --output text 2>/dev/null | head -1)

  if [ -z "$LATEST_TAG" ] || [ "$LATEST_TAG" = "None" ]; then
    print_error "无法获取镜像 tag"
    exit 1
  fi
  FULL_IMAGE="$ECR_REPO:$LATEST_TAG"
  print_info "镜像 Tag: ${LATEST_TAG:0:40}..."
fi
echo ""

# 拉取镜像
print_info "拉取 Docker 镜像..."
docker pull "$FULL_IMAGE"
print_success "镜像拉取完成"
echo ""

# 提取静态文件
print_info "提取静态文件..."
TEMP_DIR="/tmp/nextjs-static-$$"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

CONTAINER_ID=$(docker create "$FULL_IMAGE")
docker cp "$CONTAINER_ID:/app/.next/static" "$TEMP_DIR/" 2>/dev/null || true
docker cp "$CONTAINER_ID:/app/public" "$TEMP_DIR/" 2>/dev/null || true
docker rm "$CONTAINER_ID" > /dev/null

if [ ! -d "$TEMP_DIR/static" ]; then
  print_error "无法从镜像中提取静态文件"
  rm -rf "$TEMP_DIR"
  exit 1
fi

CHUNK_COUNT=$(ls -1 "$TEMP_DIR/static/chunks/" 2>/dev/null | wc -l)
print_success "提取了 $CHUNK_COUNT 个 chunk 文件"
echo ""

# 同步到 S3
print_info "同步到 S3..."
aws s3 sync "$TEMP_DIR/static" "s3://$STATIC_BUCKET/_next/static" --delete
print_success "静态 chunks 同步完成"

if [ -d "$TEMP_DIR/public" ]; then
  aws s3 sync "$TEMP_DIR/public" "s3://$STATIC_BUCKET/public" --delete
  print_success "Public 文件同步完成"
fi

# 清理
rm -rf "$TEMP_DIR"
echo ""

# 刷新 CloudFront
if [ -n "$DISTRIBUTION_ID" ]; then
  print_info "刷新 CloudFront 缓存..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)

  print_success "缓存刷新已启动 (ID: $INVALIDATION_ID)"

  # 可选：等待完成
  echo ""
  read -p "是否等待缓存刷新完成? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "等待缓存刷新完成..."
    aws cloudfront wait invalidation-completed \
      --distribution-id "$DISTRIBUTION_ID" \
      --id "$INVALIDATION_ID"
    print_success "缓存刷新完成！"
  fi
else
  print_warning "未找到 CloudFront Distribution ID"
  print_info "请手动刷新: aws cloudfront create-invalidation --distribution-id YOUR_ID --paths '/*'"
fi

echo ""
print_success "静态资源同步完成！"
echo ""
