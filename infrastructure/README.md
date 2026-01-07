# Slide-Forge AWS Infrastructure

AWS CDK infrastructure for deploying Slide-Forge to AWS with a hybrid architecture:
- **Static assets**: S3 + CloudFront
- **API routes**: ECS Fargate + ALB
- **Database**: Aurora Serverless v2 PostgreSQL
- **AI Services**: AWS Bedrock + Claude Agent SDK + OpenAI API

## ⚡ 快速部署（新）

### 使用环境变量部署

```bash
# 1. 配置环境变量
cp .env.example .env
nano .env  # 填入你的 API keys

# 2. 部署
pnpm install
pnpm deploy

# CDK 会自动读取 .env 并配置所有服务
```

**最简配置** - 只需要以下之一:
```bash
# 使用 AWS Bedrock
CLAUDE_CODE_USE_BEDROCK=1
AWS_REGION=us-east-1

# 或使用 Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-...
AWS_REGION=us-east-1
```

详见: [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)

## 📁 Project Structure

```
infrastructure/
├── bin/
│   └── slide-forge.ts           # CDK app entry point
├── lib/
│   ├── slide-forge-stack.ts     # Main stack
│   ├── network/vpc.ts           # VPC with 3 AZs
│   ├── compute/ecs-nextjs-service.ts  # ECS Fargate service
│   ├── storage/
│   │   ├── aurora-serverless.ts # Aurora Serverless v2
│   │   └── s3-buckets.ts        # Static, uploads, logs buckets
│   ├── cdn/cloudfront.ts        # CloudFront distribution
│   └── common/constants.ts      # Shared configuration
├── docker/
│   ├── Dockerfile.nextjs        # Production Docker image
│   └── .dockerignore
├── config/
│   ├── dev.json                 # Development config
│   └── prod.json                # Production config
├── cdk.json
├── package.json
└── tsconfig.json
```

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with credentials
2. **Node.js** 20+ and npm/pnpm
3. **Docker** for building images
4. **AWS CDK** CLI: `npm install -g aws-cdk`

### Installation

```bash
cd infrastructure
npm install
```

### Bootstrap CDK (first time only)

```bash
# Bootstrap for your AWS account/region
cdk bootstrap aws://ACCOUNT_ID/REGION

# Example
cdk bootstrap aws://123456789012/us-east-1
```

## 📦 Deployment Steps

### 1. Create Required Secrets

Before deploying, create these secrets in AWS Secrets Manager:

```bash
# OpenAI API Key (or other LLM provider)
aws secretsmanager create-secret \
  --name slide-forge-development/openai-api-key \
  --secret-string "sk-..."

# Yunwu API Key (for image generation)
aws secretsmanager create-secret \
  --name slide-forge-development/yunwu-api-key \
  --secret-string "sk-..."

# Tavily API Key (for search)
aws secretsmanager create-secret \
  --name slide-forge-development/tavily-api-key \
  --secret-string "tvly-..."

# UploadThing Token
aws secretsmanager create-secret \
  --name slide-forge-development/uploadthing-token \
  --secret-string "sk_live_..."
```

### 2. Deploy Infrastructure

```bash
# Development environment
npm run deploy

# Or with explicit environment
cdk deploy --context environment=development

# Production environment
cdk deploy --context environment=production
```

### 3. Run Database Migrations

After deployment, get the DATABASE_URL and run Prisma migrations:

```bash
# Get the secret ARN from CDK output
export SECRET_ARN="arn:aws:secretsmanager:..."

# Extract DATABASE_URL
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id $SECRET_ARN \
  --query SecretString \
  --output text | jq -r .connectionString)

# Run migrations (from frontend directory)
cd ../frontend
pnpm prisma migrate deploy
```

### 4. Build and Upload Static Assets

```bash
# Build Next.js application (from frontend directory)
cd ../frontend
pnpm build

# Get bucket name from CDK output
export STATIC_BUCKET="slide-forge-development-static-..."

# Upload static assets
aws s3 sync .next/static s3://$STATIC_BUCKET/_next/static
aws s3 sync public s3://$STATIC_BUCKET/public
```

### 5. Invalidate CloudFront Cache

```bash
# Get distribution ID from CDK output
export DISTRIBUTION_ID="E123456789ABCD"

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

### 6. Access Your Application

The CloudFront URL will be in the CDK output:
```
https://d1234567890abc.cloudfront.net
```

## 🔧 Configuration

### Environment Variables in ECS

The following environment variables are configured in `lib/compute/ecs-nextjs-service.ts`:

**From Secrets Manager** (secure):
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth.js secret
- `LLM_API_KEY` - OpenAI/compatible API key
- `YUNWU_API_KEY` - Image generation API key
- `UPLOADTHING_TOKEN` - File upload service token
- `TAVILY_API_KEY` - Search API key

**Environment Variables**:
- `NODE_ENV=production`
- `AWS_REGION` - Automatically set
- `CLAUDE_CODE_USE_BEDROCK=1` - Enable Bedrock
- `UPLOADS_BUCKET` - S3 bucket name

### Customizing Configuration

Edit `config/dev.json` or `config/prod.json`:

```json
{
  "environment": "development",
  "vpc": {
    "maxAzs": 3,
    "natGateways": 1
  },
  "aurora": {
    "minCapacity": 0.5,
    "maxCapacity": 2
  },
  "ecs": {
    "cpu": 1024,
    "memory": 2048,
    "desiredCount": 2
  }
}
```

## 💰 Cost Optimization

### Development Environment (~$120/month)
- ECS Fargate (1-2 tasks, ARM64): ~$25
- Aurora Serverless v2 (0.5 ACU, auto-pause): ~$8
- ALB: ~$20
- NAT Gateway (1): ~$33
- CloudFront (100GB): ~$10
- S3 + Secrets: ~$7
- Other: ~$12

### Production Environment (~$300/month)
- ECS Fargate (2-4 tasks): ~$50
- Aurora (0.5-2 ACU continuous): ~$70
- ALB: ~$20
- NAT Gateway (2, HA): ~$64
- CloudFront (500GB): ~$50
- Other: ~$46

### Cost Saving Tips
1. Use ARM64/Graviton2 (20% savings)
2. Enable Aurora auto-pause (dev)
3. Use S3 lifecycle policies
4. CloudFront Price Class 100
5. VPC Endpoints (reduce NAT costs)

## 🛠️ Common Operations

### View Logs

```bash
# ECS service logs
aws logs tail /ecs/slide-forge-development --follow

# ALB access logs
aws s3 ls s3://slide-forge-development-logs-.../alb-access-logs/
```

### Update ECS Service

```bash
# Force new deployment (pulls latest image)
aws ecs update-service \
  --cluster slide-forge-development-cluster \
  --service slide-forge-development-service \
  --force-new-deployment
```

### Scale ECS Service

```bash
# Manual scaling
aws ecs update-service \
  --cluster slide-forge-development-cluster \
  --service slide-forge-development-service \
  --desired-count 4
```

### Connect to Database

```bash
# Get database endpoint from CDK output
export DB_ENDPOINT="..."

# Connect via psql (requires VPN or bastion host)
psql postgresql://username:password@$DB_ENDPOINT:5432/slide_forge
```

## 🔍 Troubleshooting

### ECS Tasks Not Starting

1. Check CloudWatch Logs: `/ecs/slide-forge-development`
2. Verify health check endpoint: `/api/health`
3. Check security group rules
4. Verify secrets exist in Secrets Manager

### CloudFront 404 Errors

1. Verify static assets uploaded to S3
2. Check CloudFront origin configuration
3. Wait 5-10 minutes for distribution deployment

### Database Connection Failures

1. Verify security group allows ECS → Aurora
2. Check DATABASE_URL format in Secrets Manager
3. Ensure Aurora cluster is not paused

## 🗑️ Cleanup

To delete all resources:

```bash
npm run destroy

# Or
cdk destroy --all
```

**Note**: Some resources like S3 buckets and log groups may need manual cleanup.

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)
- [CloudFront Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/best-practices.html)

## 🤝 Support

For issues or questions:
1. Check CloudWatch Logs
2. Review CDK synthesis output: `cdk synth`
3. Validate configuration: `cdk diff`

---

**架构参考**: 基于 `resource/customer-due-diligence` 验证的生产级架构模式
