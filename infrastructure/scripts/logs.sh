#!/bin/bash

# ==============================================================================
# Slide-Forge 日志查看脚本
# ==============================================================================
# 使用：./scripts/logs.sh [stack-name] [environment]
# ==============================================================================

STACK_NAME="${1:-slide-forge}"
ENVIRONMENT="${2:-dev}"
LOG_GROUP="/ecs/${STACK_NAME}-${ENVIRONMENT}"

echo "📊 查看 ECS 日志: $LOG_GROUP"
echo "按 Ctrl+C 退出"
echo ""

aws logs tail "$LOG_GROUP" --follow --format short
