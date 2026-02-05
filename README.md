# Slide Forge

An intelligent presentation creation platform powered by AI. Generate stunning, professional presentations from text input or file uploads through natural conversation with Claude.

## Project Structure

```
slide-forge/
├── frontend/              # Next.js application
│   ├── src/              # Application source code
│   └── public/           # Static assets
│
├── backend/              # AgentCore backend (Strands Agent)
│   ├── api/              # API endpoints
│   ├── core/             # Session management
│   └── Dockerfile        # Container image
│
├── infrastructure/       # AWS CDK deployment
│   ├── lib/              # CDK constructs
│   └── README.md         # Deployment guide
│
└── deploy/               # Deployment scripts
```

## Architecture

```
                    CloudFront (CDN)
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     S3 Static      Private ALB     Cognito
     (assets)       (VPC Origin)    (Auth)
                         │
                 ┌───────▼───────┐
                 │  ECS Fargate  │
                 │  (Next.js)    │
                 │  Stateless    │
                 └───────┬───────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    AgentCore       S3 Uploads      Secrets
    Runtime         (Sessions)      Manager
    (Claude)
```

**Key Components:**
- **Frontend**: Stateless Next.js on ECS Fargate (1-4 tasks, auto-scaling)
- **Backend**: AWS Bedrock AgentCore Runtime with Strands Agent + Claude
- **Auth**: Amazon Cognito (OIDC + JWT with auto-refresh)
- **Storage**: S3 (no database - all data stored in S3)
- **CDN**: CloudFront with VPC Origin for private ALB access

## Quick Start

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/IanLiYi1996/slide-forge
cd slide-forge/frontend
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start development server
pnpm dev
```

Access the app at: **http://localhost:3000**

### Environment Configuration

Create `.env` in the frontend directory:

```env
# Authentication (Cognito)
COGNITO_CLIENT_ID=""
COGNITO_CLIENT_SECRET=""
COGNITO_ISSUER=""
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"

# AI Configuration (choose one)
CLAUDE_CODE_USE_BEDROCK=1     # Use AWS Bedrock (recommended)
# OR
ANTHROPIC_API_KEY=sk-ant-...  # Use Anthropic API directly

# AWS Region
AWS_REGION=us-east-1

# Optional Services
TAVILY_API_KEY=""             # Web search
UNSPLASH_ACCESS_KEY=""        # Stock images
YUNWU_API_KEY=""              # AI image generation
```

## Features

### AI-Powered Generation
- **Conversational AI**: Chat with Claude to create presentations naturally
- **Smart Outline Generation**: Automatically create structured outlines from topics
- **AI Image Generation**: Generate high-quality slide visuals
- **Web Search Integration**: Enhance content with real-time web data

### Flexible Input
- **Text Input**: Describe your topic directly
- **File Upload**: Upload documents (.txt, .md, .docx, .pdf)
- **Multi-modal**: Combine text and file uploads

### Customization
- **10+ Built-in Themes**: Professional, creative, minimal, bold, etc.
- **Custom Themes**: Design your own color schemes and fonts
- **Image Options**: Multiple aspect ratios and resolutions
- **Multi-language**: 12+ languages supported

### Export Options
- **PDF Export**: Generate PDF documents
- **PPTX Export**: Export to PowerPoint format
- **Image Export**: Download individual slides as images

## AWS Deployment

For production deployment to AWS, see [infrastructure/README.md](infrastructure/README.md).

### Quick Deploy

```bash
cd infrastructure
cp .env.example .env
# Edit .env with your configuration

pnpm install
pnpm deploy
```

### Cost Estimates

| Environment | Monthly Cost |
|-------------|--------------|
| Development | ~$80 |
| Production  | ~$180 |

Main costs: Fargate tasks, ALB, NAT Gateway, S3/CloudFront

## API Keys Reference

| Service | Required | Purpose |
|---------|----------|---------|
| AWS Bedrock | Yes* | Claude AI (via Bedrock) |
| Anthropic API | Yes* | Claude AI (direct) |
| Cognito | Yes | User authentication |
| Tavily | No | Web search enhancement |
| Unsplash | No | Stock images |
| Yunwu | No | AI image generation |

*One of AWS Bedrock or Anthropic API is required

## Development

### Frontend (Next.js)

```bash
cd frontend
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm lint         # Run linter
pnpm typecheck    # TypeScript check
```

### Infrastructure (CDK)

```bash
cd infrastructure
npx cdk synth     # Synthesize CloudFormation
npx cdk deploy    # Deploy to AWS
npx cdk diff      # Show pending changes
npx cdk destroy   # Tear down resources
```

### Backend (AgentCore)

```bash
cd backend
docker build -t slide-forge-agentcore .
# Push to ECR after CDK creates the repository
```

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI, Strands Agent SDK
- **AI**: AWS Bedrock, Claude (Sonnet/Opus/Haiku)
- **Auth**: Amazon Cognito, NextAuth.js
- **Infrastructure**: AWS CDK, ECS Fargate, CloudFront, S3
- **Storage**: S3 (serverless, no database)

## Security

- All traffic encrypted (TLS 1.2+)
- S3 buckets use KMS encryption with annual key rotation
- Private ALB accessible only via CloudFront VPC Origin
- Cognito Advanced Security Mode enabled
- Invite-only user registration (no self-signup)
- JWT tokens with automatic refresh

## License

MIT License - see [LICENSE](LICENSE) for details.
