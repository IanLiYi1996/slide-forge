#!/bin/bash
set -e

echo "🔄 Running Prisma migrations via ECS task..."

# Get cluster and service names
CLUSTER="slide-forge-development-cluster"
SERVICE="slide-forge-development-service"
REGION="us-east-1"

# Get task definition
TASK_DEF=$(aws ecs describe-services \
  --cluster $CLUSTER \
  --services $SERVICE \
  --region $REGION \
  --query 'services[0].taskDefinition' \
  --output text)

# Get network configuration
SUBNETS=$(aws ecs describe-services \
  --cluster $CLUSTER \
  --services $SERVICE \
  --region $REGION \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' \
  --output json | jq -r 'join(",")')

SECURITY_GROUPS=$(aws ecs describe-services \
  --cluster $CLUSTER \
  --services $SERVICE \
  --region $REGION \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' \
  --output text)

echo "📋 Task Definition: $TASK_DEF"
echo "🌐 Subnets: $SUBNETS"
echo "🔒 Security Group: $SECURITY_GROUPS"

# Run migration task
echo "🚀 Starting migration task..."
TASK_ARN=$(aws ecs run-task \
  --cluster $CLUSTER \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"nextjs","command":["sh","-c","npx prisma migrate deploy && echo MIGRATION_SUCCESS"]}]}' \
  --region $REGION \
  --query 'tasks[0].taskArn' \
  --output text)

echo "⏳ Migration task started: $TASK_ARN"
echo "⏳ Waiting 60 seconds for completion..."
sleep 60

# Check task status
STATUS=$(aws ecs describe-tasks \
  --cluster $CLUSTER \
  --tasks $TASK_ARN \
  --region $REGION \
  --query 'tasks[0].{status:lastStatus,exitCode:containers[0].exitCode}')

echo "📊 Task status: $STATUS"

# Check logs
echo "📝 Migration logs:"
aws logs tail /ecs/slide-forge-development \
  --since 2m \
  --format short \
  --region $REGION | grep -A 5 "prisma\|migrate\|MIGRATION" || echo "No logs found yet"

echo "✅ Migration script completed"
