# Slide-Forge Frontend

AI-powered presentation generation and editing platform built with Next.js 15.

## 🚀 Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma generate

# Start development server
pnpm dev
```

Application will be available at `http://localhost:8080`.

### Using Convenience Scripts

From project root:

```bash
# First time installation
./scripts/install.sh

# Subsequent starts
./scripts/start.sh
```

## 📁 Directory Structure

```
frontend/
├── src/
│   ├── app/              # Next.js 15 App Router
│   │   ├── api/          # API routes
│   │   └── (routes)/     # Page routes
│   ├── components/       # React components
│   │   ├── ui/           # Shadcn/UI components
│   │   └── ...
│   ├── lib/              # Utilities
│   │   ├── agent/        # Claude Agent SDK
│   │   ├── document-processor/
│   │   ├── presentation/ # Presentation logic
│   │   └── ...
│   └── server/           # Server-side code
│       └── db.ts         # Prisma client
├── public/               # Static assets
├── prisma/              # Database schema
│   └── schema.prisma
├── package.json
├── next.config.js
└── tsconfig.json
```

## 🛠️ Tech Stack

- **Framework**: Next.js 15.5.4 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + Shadcn/UI
- **Database**: PostgreSQL + Prisma
- **AI**:
  - AWS Bedrock (Claude models)
  - OpenAI API (compatible providers)
  - Anthropic Claude Agent SDK
- **Editor**: Plate.js (rich text)
- **Auth**: NextAuth.js

## 📦 Scripts

```bash
# Development
pnpm dev                 # Start dev server on port 8080
pnpm build              # Build for production
pnpm start              # Start production server

# Database
pnpm db:push            # Push schema changes to database
pnpm db:studio          # Open Prisma Studio

# Code Quality
pnpm lint               # Run linter
pnpm type               # Type check
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://..."

# AI Services
LLM_API_KEY="sk-..."           # OpenAI or compatible API
YUNWU_API_KEY="sk-..."         # Image generation
CLAUDE_CODE_USE_BEDROCK="1"    # Enable AWS Bedrock
AWS_REGION="us-east-1"

# Authentication
NEXTAUTH_URL="http://localhost:8080"
NEXTAUTH_SECRET="..."
COGNITO_CLIENT_ID="..."
COGNITO_CLIENT_SECRET="..."
COGNITO_ISSUER="..."

# Search
TAVILY_API_KEY="tvly-..."

# File Upload (optional)
UPLOADTHING_TOKEN="sk_live_..."
```

## 🚀 Deployment

See [../infrastructure/README.md](../infrastructure/README.md) for AWS deployment instructions.

## 📄 License

MIT
