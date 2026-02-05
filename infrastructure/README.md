# Slide-Forge AWS Infrastructure

AWS CDK infrastructure for deploying Slide-Forge with a modern serverless architecture:

- **Frontend**: ECS Fargate (Stateless Next.js)
- **Backend**: AWS Bedrock AgentCore Runtime (Strands Agent + Claude)
- **CDN**: CloudFront with VPC Origin
- **Auth**: Amazon Cognito (OIDC + JWT)
- **Storage**: S3 (serverless, no database required)

## Architecture Overview

```
                         Internet (HTTPS)
                              │
                    ┌─────────▼─────────┐
                    │    CloudFront     │
                    │  (CDN + Caching)  │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   ┌───────────┐      ┌─────────────┐      ┌───────────┐
   │ S3 Static │      │ Private ALB │      │  Cognito  │
   │  Bucket   │      │ (VPC Origin)│      │ User Pool │
   └───────────┘      └──────┬──────┘      └───────────┘
                             │
                    ┌────────▼────────┐
                    │   ECS Fargate   │
                    │  (Next.js 1-4)  │
                    │   Stateless     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  AgentCore  │  │  S3 Uploads │  │   Secrets   │
    │   Runtime   │  │  (Sessions) │  │   Manager   │
    │  (Claude)   │  │             │  │             │
    └─────────────┘  └─────────────┘  └─────────────┘
```

## Key Features

- **Stateless Frontend**: Fargate tasks auto-scale 1-4, no sticky sessions needed
- **AI-Powered Backend**: Bedrock AgentCore manages Claude agent sessions
- **JWT Auth with Auto-Refresh**: Cognito tokens refresh automatically before expiry
- **No Database**: All data stored in S3 with KMS encryption
- **SSE Streaming**: 300s ALB timeout for long-running agent responses

## Quick Start

### Prerequisites

- AWS CLI configured with credentials
- Node.js 20+ and pnpm
- Docker (for building images)
- AWS CDK CLI: `npm install -g aws-cdk`

### 1. Configure Environment

```bash
cd infrastructure
cp .env.example .env
# Edit .env with your configuration
```

**Minimum required:**
```bash
# Cognito Admin Email (receives initial password)
COGNITO_ADMIN_EMAIL=your-email@example.com

# AI Configuration (choose one)
CLAUDE_CODE_USE_BEDROCK=1  # Use AWS Bedrock (recommended)
# OR
ANTHROPIC_API_KEY=sk-ant-...  # Use Anthropic API directly
```

### 2. Bootstrap CDK (first time only)

```bash
cdk bootstrap aws://ACCOUNT_ID/REGION
```

### 3. Deploy Infrastructure

```bash
pnpm install
pnpm deploy
```

### 4. Build and Push AgentCore Container

After deployment, build and push the AgentCore container:

```bash
# Get ECR repository URI from CDK output
export ECR_REPO="123456789012.dkr.ecr.us-east-1.amazonaws.com/slide-forge-agentcore"

# Build and push
cd ../backend
docker build -t $ECR_REPO:latest .
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REPO
docker push $ECR_REPO:latest
```

### 5. Upload Static Assets

```bash
cd ../frontend
pnpm build

# Get bucket name from CDK output
export STATIC_BUCKET="slide-forge-development-static-..."
aws s3 sync .next/static s3://$STATIC_BUCKET/_next/static
aws s3 sync public s3://$STATIC_BUCKET/public
```

### 6. Access Application

The CloudFront URL will be in the CDK output:
```
https://d1234567890abc.cloudfront.net
```

## Project Structure

```
infrastructure/
├── bin/
│   └── slide-forge.ts              # CDK app entry point
├── lib/
│   ├── slide-forge-stack.ts        # Main stack orchestration
│   ├── network/
│   │   └── vpc.ts                  # VPC with 3 AZs
│   ├── compute/
│   │   ├── fargate-nextjs-service.ts  # Stateless Fargate frontend
│   │   └── agentcore-construct.ts     # Bedrock AgentCore Runtime
│   ├── storage/
│   │   └── s3-buckets.ts           # Static, uploads, logs buckets
│   ├── auth/
│   │   ├── cognito.ts              # Cognito User Pool + Client
│   │   └── admin-user-creator.ts   # Initial admin user
│   ├── cdn/
│   │   └── cloudfront.ts           # CloudFront with VPC Origin
│   └── common/
│       └── constants.ts            # Shared configuration
├── config/
│   └── env-config.ts               # Environment variable loader
└── cdk.json
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COGNITO_ADMIN_EMAIL` | Yes | Admin user email (receives login credentials) |
| `CLAUDE_CODE_USE_BEDROCK` | No | Set to `1` to use AWS Bedrock |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (if not using Bedrock) |
| `TAVILY_API_KEY` | No | Tavily API key for web search |
| `UNSPLASH_ACCESS_KEY` | No | Unsplash API key for images |

### Token Validity

Cognito token lifetimes (configured in CDK):
- **Access Token**: 1 day
- **ID Token**: 1 day
- **Refresh Token**: 30 days

Tokens refresh automatically 60 seconds before expiry.

## Cost Estimates

### Development (~$80/month)
- Fargate (1 task): ~$30
- ALB: ~$20
- NAT Gateway (1): ~$33
- S3 + CloudFront: ~$15
- AgentCore: Pay per invocation

### Production (~$180/month)
- Fargate (2-4 tasks): ~$60-120
- ALB: ~$20
- NAT Gateway (2, HA): ~$66
- S3 + CloudFront: ~$30
- AgentCore: Pay per invocation

## Common Operations

### View Logs

```bash
# Fargate service logs
aws logs tail /ecs/slide-forge-development-fargate --follow

# AgentCore runtime logs
aws logs tail /aws/bedrock-agentcore/runtimes/slide-forge-agent --follow
```

### Force Deployment

```bash
aws ecs update-service \
  --cluster slide-forge-development-fargate-cluster \
  --service slide-forge-development-fargate-service \
  --force-new-deployment
```

### Scale Service

```bash
aws ecs update-service \
  --cluster slide-forge-development-fargate-cluster \
  --service slide-forge-development-fargate-service \
  --desired-count 4
```

## Troubleshooting

### Fargate Tasks Not Starting
1. Check CloudWatch Logs: `/ecs/slide-forge-development-fargate`
2. Verify health check: `GET /api/health`
3. Check Secrets Manager access
4. Verify ECR image exists

### AgentCore Auth Errors
1. Verify Cognito tokens are valid
2. Check AgentCore runtime status in AWS Console
3. Review CloudWatch logs for JWT validation errors

### SSE Streaming Issues
1. ALB idle timeout is 300s (configured)
2. CloudFront origin timeout is 180s (max for VPC origin)
3. Check for proxy buffering issues

## Cleanup

```bash
# Destroy all resources
pnpm destroy

# Or
cdk destroy --all
```

**Note**: S3 buckets with data may need manual cleanup.

## Security

- All traffic encrypted (TLS 1.2+)
- S3 buckets use KMS encryption with key rotation
- Private ALB accessible only via CloudFront VPC Origin
- Cognito Advanced Security Mode enabled
- No self-signup (invite-only users)
