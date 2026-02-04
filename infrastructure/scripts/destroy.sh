#!/bin/bash

# ==============================================================================
# Slide-Forge 资源销毁脚本
# ==============================================================================
# 警告：此脚本会删除所有 AWS 资源和数据！
# 使用：./scripts/destroy.sh [stack-name] [environment]
# ==============================================================================

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

STACK_NAME="${1:-slide-forge}"
ENVIRONMENT="${2:-dev}"
FULL_STACK_NAME="${STACK_NAME}-${ENVIRONMENT}"

echo -e "${RED}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                  ⚠️  危险操作警告  ⚠️                      ║
║                                                           ║
║              此操作将删除所有 AWS 资源                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo ""
print_warning "将要删除的资源:"
echo "  • CloudFormation Stack: $FULL_STACK_NAME"
echo "  • ECS 集群和服务"
echo "  • S3 Buckets (包含所有数据和文件)"
echo "  • CloudFront 分发"
echo "  • VPC 和网络资源"
echo "  • Cognito 用户池"
echo ""

print_error "⚠️  此操作不可逆，所有数据将永久删除！"
echo ""

read -p "确认删除? 输入 'DELETE' 确认: " confirmation

if [ "$confirmation" != "DELETE" ]; then
  echo "操作已取消"
  exit 0
fi

echo ""
read -p "最后确认，真的要删除吗? [y/N] " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "操作已取消"
  exit 0
fi

echo ""
print_warning "开始销毁资源..."
echo ""

cd "$(dirname "$0")/.."

# 执行销毁
if pnpm cdk destroy --all --force; then
  echo ""
  print_warning "Stack 已删除"
  echo ""
  echo "后续清理（可选）:"
  echo "  1. 删除 CDK Bootstrap: aws cloudformation delete-stack --stack-name CDKToolkit"
  echo "  2. 删除 ECR 镜像"
  echo "  3. 清理 Secrets Manager 中的密钥"
  echo ""
else
  print_error "销毁失败"
  exit 1
fi
