#!/bin/bash

# ==============================================================================
# Slide-Forge 部署状态查看脚本
# ==============================================================================
# 使用：./scripts/status.sh [stack-name] [environment]
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

STACK_NAME="${1:-slide-forge}"
ENVIRONMENT="${2:-dev}"
FULL_STACK_NAME="${STACK_NAME}-${ENVIRONMENT}"

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          Slide-Forge 部署状态                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo ""
print_info "检查 Stack: $FULL_STACK_NAME"
echo ""

# ==============================================================================
# 1. CloudFormation Stack 状态
# ==============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. CloudFormation Stack"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if aws cloudformation describe-stacks --stack-name "$FULL_STACK_NAME" &> /dev/null; then
  stack_status=$(aws cloudformation describe-stacks \
    --stack-name "$FULL_STACK_NAME" \
    --query 'Stacks[0].StackStatus' \
    --output text)

  if [[ "$stack_status" == *"COMPLETE"* ]]; then
    print_success "Status: $stack_status"
  else
    print_warning "Status: $stack_status"
  fi

  # 获取输出
  echo ""
  echo "Stack Outputs:"
  aws cloudformation describe-stacks \
    --stack-name "$FULL_STACK_NAME" \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table
else
  print_warning "Stack 不存在"
  echo "运行部署: ./scripts/deploy.sh"
  exit 0
fi

# ==============================================================================
# 2. ECS Service 状态
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. ECS Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cluster_name="${STACK_NAME}-${ENVIRONMENT}-cluster"
service_name="${STACK_NAME}-${ENVIRONMENT}-service"

if aws ecs describe-services \
  --cluster "$cluster_name" \
  --services "$service_name" &> /dev/null; then

  # 运行中的任务数
  running_count=$(aws ecs describe-services \
    --cluster "$cluster_name" \
    --services "$service_name" \
    --query 'services[0].runningCount' \
    --output text)

  desired_count=$(aws ecs describe-services \
    --cluster "$cluster_name" \
    --services "$service_name" \
    --query 'services[0].desiredCount' \
    --output text)

  echo "Service: $service_name"
  echo "  • 期望任务数: $desired_count"
  echo "  • 运行任务数: $running_count"

  if [ "$running_count" -eq "$desired_count" ]; then
    print_success "  所有任务正常运行"
  else
    print_warning "  任务数不匹配，可能正在启动或停止"
  fi

  # 最新部署
  echo ""
  echo "最新部署:"
  aws ecs describe-services \
    --cluster "$cluster_name" \
    --services "$service_name" \
    --query 'services[0].deployments[0].[status,createdAt,updatedAt]' \
    --output table
else
  print_warning "ECS Service 未找到"
fi

# ==============================================================================
# 3. S3 存储状态
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. S3 存储"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 查找 uploads bucket
uploads_bucket=$(aws s3api list-buckets --query "Buckets[?contains(Name, '${STACK_NAME}') && contains(Name, 'uploads')].Name | [0]" --output text 2>/dev/null || echo "")

if [ -n "$uploads_bucket" ] && [ "$uploads_bucket" != "None" ]; then
  echo "Uploads Bucket: $uploads_bucket"

  # 获取对象数量
  object_count=$(aws s3api list-objects-v2 --bucket "$uploads_bucket" --query 'KeyCount' --output text 2>/dev/null || echo "0")
  echo "  • Object Count: $object_count"
  print_success "  S3 存储正常"
else
  print_warning "S3 Uploads 桶未找到"
fi

# ==============================================================================
# 4. 应用访问地址
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. 应用访问地址"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cf_url=$(aws cloudformation describe-stacks \
  --stack-name "$FULL_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -n "$cf_url" ]; then
  print_success "CloudFront URL: $cf_url"
  echo ""
  echo "测试访问:"
  echo "  • 主页: $cf_url"
  echo "  • 健康检查: $cf_url/api/health"
  echo "  • Agent: $cf_url/presentation/agent"
else
  print_warning "未找到 CloudFront URL"
fi

# ==============================================================================
# 总结
# ==============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

print_success "状态检查完成"
echo ""
echo "实用命令:"
echo "  • 查看日志: ./scripts/logs.sh $STACK_NAME $ENVIRONMENT"
echo "  • 重新部署: ./scripts/deploy.sh --non-interactive"
echo "  • 销毁资源: ./scripts/destroy.sh $STACK_NAME $ENVIRONMENT"
echo ""
