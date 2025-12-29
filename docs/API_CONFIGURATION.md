# API Configuration Guide

Complete guide for configuring all API keys and services required by Slide Forge.

## 📋 Configuration Checklist

- [ ] Database (Docker - automatic)
- [ ] Text Generation API (choose one: OpenAI or Compatible)
- [ ] Authentication (NextAuth + Cognito)
- [ ] File Storage (UploadThing)
- [ ] Claude Agent (AWS Bedrock) - for Chat to Slides
- [ ] Web Search (Tavily) - optional
- [ ] Image Generation (yunwu) - optional
- [ ] Stock Images (Unsplash) - optional

---

## 1. 🗄️ Database (Automatic with Docker)

### Configuration

```env
DATABASE_URL="postgresql://presentation_user:presentation_password@localhost:5432/slide_forge"
```

### Setup

```bash
# Start database
docker-compose up -d postgres

# Initialize schema
pnpm db:push
```

### Verification

```bash
# Check container status
docker ps | grep slide-forge-db

# Test connection
docker exec -it slide-forge-db psql -U presentation_user -d slide_forge
```

**Status**: ✅ Required, auto-configured with Docker

---

## 2. 🤖 Text Generation API (Choose One)

### Option A: OpenAI API

**Best for**: Simple setup, reliable service

```env
OPENAI_API_KEY="sk-proj-..."
```

**Get your key**:
1. Visit https://platform.openai.com/api-keys
2. Sign up / Log in
3. Click "Create new secret key"
4. Copy and paste to `.env`

**Test**:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Pricing**: Pay-per-use (typically $0.01-0.06 per 1K tokens)

### Option B: OpenAI-Compatible API (Recommended)

**Best for**: Cost savings, privacy, local development

#### B1. LM Studio (Local)

```env
LLM_BASE_URL="http://localhost:1234/v1"
LLM_API_KEY="sk-no-key-required"
LLM_MODEL_NAME="qwen2.5-7b-instruct"  # or your model
```

**Setup**:
1. Download LM Studio: https://lmstudio.ai
2. Download a model (e.g., Qwen 2.5 7B, Llama 3.1 8B)
3. Start local server (Developer tab > Start Server)
4. Use URL: `http://localhost:1234/v1`

**Pros**: Free, private, fast
**Cons**: Requires powerful hardware

#### B2. Ollama (Local)

```env
LLM_BASE_URL="http://localhost:11434/v1"
LLM_API_KEY="sk-no-key-required"
LLM_MODEL_NAME="qwen2.5:7b"
```

**Setup**:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download model
ollama pull qwen2.5:7b

# Start server (automatic)
```

**Pros**: Easy to use, CLI-friendly
**Cons**: Requires local resources

#### B3. yunwu.ai (Cloud)

```env
LLM_BASE_URL="https://api.xiaomimomo.com/v1"
LLM_API_KEY="sk-..."
LLM_MODEL_NAME="mimo-v2-flash"
```

**Get your key**: https://yunwu.ai

**Pros**: Fast, affordable, no local setup
**Cons**: Requires internet, paid service

### Recommended Models

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| Qwen 2.5 7B | 7B | Fast | Good | General use |
| Llama 3.1 8B | 8B | Fast | Good | English tasks |
| Gemma 2 9B | 9B | Medium | Better | Complex reasoning |
| Mistral 7B | 7B | Fast | Good | Coding tasks |

**Status**: ✅ Required (choose one option)

---

## 3. 🎨 Image Generation API (Optional)

### yunwu API (Gemini 3 Pro Image)

```env
YUNWU_API_KEY="sk-..."
```

**Get your key**:
1. Visit https://yunwu.ai
2. Sign up and verify email
3. Navigate to API Keys
4. Create new key
5. Copy to `.env`

**Used for**: Generating slide background images with AI

**Alternative**: Can use Unsplash stock images instead (free)

**Status**: ⭕ Optional

---

## 4. 🔐 Authentication

### NextAuth Secret

```env
NEXTAUTH_SECRET="your-random-secret-here"
NEXTAUTH_URL="http://localhost:8080"
```

**Generate secret**:
```bash
openssl rand -base64 32
```

### AWS Cognito (User Authentication)

```env
COGNITO_CLIENT_ID="..."
COGNITO_CLIENT_SECRET="..."
COGNITO_ISSUER="https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXX"
```

**Setup guide**: See [COGNITO_SETUP.md](../COGNITO_SETUP.md)

**Status**: ✅ Required

---

## 5. 🤖 Claude Agent SDK (Chat to Slides Feature)

### Configuration

```env
# Enable Agent feature
CLAUDE_CODE_USE_BEDROCK="1"
ENABLE_CLAUDE_AGENT="true"

# AWS Credentials (choose one method below)
```

### Method 1: AWS Profile (Recommended for Local Dev)

```env
AWS_PROFILE="default"
AWS_REGION="us-east-1"
```

**Setup**:
```bash
# Configure AWS CLI
aws configure --profile default

# Verify
aws sts get-caller-identity --profile default
```

### Method 2: Direct Credentials

```env
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
```

**Get credentials**: AWS Console > IAM > Users > Security credentials

### Method 3: IAM Role (Production)

```env
AWS_REGION="us-east-1"
```

**Used in**: EC2, ECS, Lambda (credentials automatic)

### Required IAM Permissions

Create an IAM policy with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-opus-*",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-*"
      ]
    }
  ]
}
```

### Enable Model Access

1. Navigate to: **AWS Console > Amazon Bedrock > Model access**
2. Click **"Modify model access"** or **"Request model access"**
3. Select the following models:
   - ✅ Claude 3.5 Sonnet (Required)
   - ⭕ Claude 3 Opus (Optional, higher quality)
   - ⭕ Claude 3 Haiku (Optional, faster)
4. Click **"Request model access"**
5. Wait for approval (usually instant for most accounts)

### Verification

```bash
# Test AWS credentials
aws sts get-caller-identity

# List available Bedrock models
aws bedrock list-foundation-models --region us-east-1

# Test Claude model access
aws bedrock invoke-model \
  --region us-east-1 \
  --model-id anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}' \
  --cli-binary-format raw-in-base64-out \
  output.json

cat output.json
```

**Status**: ✅ Required for Chat to Slides

---

## 6. 🔍 Web Search API (Optional)

### Tavily API

```env
TAVILY_API_KEY="tvly-..."
```

**Get your key**:
1. Visit https://tavily.com
2. Sign up for free account
3. Get API key from dashboard
4. Copy to `.env`

**Free tier**: 1,000 searches/month

**Used for**: Real-time web search in Chat to Slides when toggle is enabled

**Status**: ⭕ Optional (Agent works without it)

---

## 7. 📦 File Storage

### UploadThing

```env
UPLOADTHING_TOKEN="eyJhcGlLZXkiOiI..."
```

**Get your token**:
1. Visit https://uploadthing.com
2. Sign up
3. Create new app
4. Copy token to `.env`

**Free tier**: 2GB storage, 100GB bandwidth/month

**Used for**: Uploading files, storing generated images

**Status**: ✅ Required

---

## 8. 🖼️ Stock Images (Optional)

### Unsplash API

```env
UNSPLASH_ACCESS_KEY="..."
```

**Get your key**:
1. Visit https://unsplash.com/developers
2. Sign up / Log in
3. Create new application
4. Copy Access Key to `.env`

**Free tier**: 50 requests/hour

**Used for**: Automatic slide background images

**Status**: ⭕ Optional

---

## 🔧 Environment File Examples

### Minimal Setup (Image to Slides only)

```env
# Database
DATABASE_URL="postgresql://presentation_user:presentation_password@localhost:5432/slide_forge"

# Auth
NEXTAUTH_SECRET="<generate-with-openssl>"
NEXTAUTH_URL="http://localhost:8080"

# Text Generation (choose one)
OPENAI_API_KEY="sk-..."
# OR
LLM_BASE_URL="http://localhost:1234/v1"
LLM_API_KEY="sk-no-key-required"
LLM_MODEL_NAME="qwen2.5-7b-instruct"

# File Storage
UPLOADTHING_TOKEN="..."

# Cognito (for authentication)
COGNITO_CLIENT_ID="..."
COGNITO_CLIENT_SECRET="..."
COGNITO_ISSUER="..."
```

### Full Setup (All Features)

```env
# Database
DATABASE_URL="postgresql://presentation_user:presentation_password@localhost:5432/slide_forge"

# Auth
NEXTAUTH_SECRET="<generate-with-openssl>"
NEXTAUTH_URL="http://localhost:8080"
COGNITO_CLIENT_ID="..."
COGNITO_CLIENT_SECRET="..."
COGNITO_ISSUER="..."

# Text Generation
LLM_BASE_URL="https://api.xiaomimomo.com/v1"
LLM_API_KEY="sk-..."
LLM_MODEL_NAME="mimo-v2-flash"

# Image Generation
YUNWU_API_KEY="sk-..."

# Claude Agent (Chat to Slides)
CLAUDE_CODE_USE_BEDROCK="1"
ENABLE_CLAUDE_AGENT="true"
AWS_PROFILE="default"
AWS_REGION="us-east-1"

# File Storage
UPLOADTHING_TOKEN="..."

# Optional Services
TAVILY_API_KEY="tvly-..."
UNSPLASH_ACCESS_KEY="..."
```

---

## 🧪 Testing Your Configuration

### Test Database

```bash
docker exec -it slide-forge-db psql -U presentation_user -d slide_forge -c "SELECT version();"
```

### Test OpenAI API

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Test LM Studio / Compatible API

```bash
curl http://localhost:1234/v1/models
```

### Test AWS Bedrock

```bash
aws bedrock list-foundation-models --region us-east-1 --query 'modelSummaries[?contains(modelId, `claude`)].modelId'
```

### Test Tavily API

```bash
curl -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -d '{"api_key": "YOUR_KEY", "query": "test"}'
```

---

## 💡 Cost Optimization Tips

### 1. Use Local LLMs for Development
- Use LM Studio or Ollama during development
- Switch to cloud APIs for production
- Saves significant costs on API calls

### 2. OpenAI-Compatible APIs are Cheaper
- yunwu.ai: ~1/10 the cost of OpenAI
- Local LLMs: Free after hardware cost

### 3. Free Tiers Available
- Tavily: 1,000 searches/month free
- Unsplash: 50 requests/hour free
- UploadThing: 2GB storage free

### 4. AWS Bedrock Pricing
- Claude 3.5 Sonnet: ~$3 per 1M input tokens
- Pay only for what you use
- No monthly minimums

---

## 🔒 Security Best Practices

### 1. Never Commit API Keys
- Keep `.env` and `.env.local` in `.gitignore`
- Use environment variables in production
- Rotate keys regularly

### 2. Use IAM Roles in Production
- Avoid hardcoded AWS credentials
- Use EC2/ECS instance roles
- Least privilege principle

### 3. Restrict API Key Permissions
- OpenAI: Restrict to specific models
- AWS: Use minimal IAM permissions
- UploadThing: Configure allowed file types

### 4. Monitor API Usage
- Set up billing alerts
- Monitor usage dashboards
- Track costs per feature

---

## 🆘 Troubleshooting

### "Invalid API Key" Errors

**OpenAI**:
- Check key format: starts with `sk-proj-` or `sk-`
- Verify key is active in dashboard
- Check account has credits

**LLM_BASE_URL**:
- Ensure service is running
- Test endpoint: `curl $LLM_BASE_URL/models`
- Check firewall/network

### "Access Denied" - AWS Bedrock

**Causes**:
1. Model access not granted
2. IAM permissions missing
3. Wrong region configured

**Fix**:
1. AWS Console > Bedrock > Model access
2. Verify IAM policy includes `bedrock:InvokeModel`
3. Check `AWS_REGION` matches model access region

### "Rate Limit Exceeded"

**Solutions**:
- Implement caching
- Add delays between requests
- Upgrade API tier
- Use multiple API keys with rotation

---

## 📊 Feature Matrix by API

| Feature | Requires | Optional Enhancement |
|---------|----------|---------------------|
| **Image to Slides** | Text API, UploadThing | yunwu, Unsplash |
| **Chat to Slides** | AWS Bedrock | Tavily (web search) |
| **File Upload** | UploadThing | - |
| **Web Search** | - | Tavily |
| **Auto Images** | - | Unsplash |

---

## 🔄 Switching Between APIs

### Switch Text Generation Provider

**From OpenAI to Local**:
```bash
# Comment out OpenAI
# OPENAI_API_KEY="sk-..."

# Add LM Studio
LLM_BASE_URL="http://localhost:1234/v1"
LLM_API_KEY="sk-no-key-required"
LLM_MODEL_NAME="qwen2.5-7b-instruct"
```

**From Local to Cloud**:
```bash
# Comment out local
# LLM_BASE_URL="http://localhost:1234/v1"

# Add yunwu.ai
LLM_BASE_URL="https://api.xiaomimomo.com/v1"
LLM_API_KEY="sk-..."
LLM_MODEL_NAME="mimo-v2-flash"
```

### No Code Changes Required
The app automatically detects which API is configured and uses it.

---

## 📞 Support

For API-specific issues:
- **OpenAI**: https://help.openai.com
- **AWS Bedrock**: https://aws.amazon.com/bedrock/support/
- **Tavily**: support@tavily.com
- **UploadThing**: https://uploadthing.com/dashboard/support

For project-specific issues:
- Check [QUICK_START.md](../QUICK_START.md) troubleshooting section
- Review logs in browser console (F12)
- Check server logs: `pnpm dev`
