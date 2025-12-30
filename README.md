# 🎨 Slide Forge

An intelligent presentation creation platform powered by AI. Generate stunning, professional presentations from text input or file uploads in minutes.

## 📁 Project Structure

```
slide-forge/
├── frontend/              # Next.js application (main codebase)
│   ├── src/              # Application source code
│   ├── public/           # Static assets
│   ├── prisma/           # Database schema
│   └── package.json
│
├── infrastructure/        # AWS CDK deployment infrastructure
│   ├── lib/              # CDK constructs (VPC, ECS, Aurora, etc.)
│   ├── docker/           # Production Dockerfile
│   └── README.md         # Deployment guide
│
└── resource/             # Reference architectures
```

## ⚡ Quick Start (One Command!)

```bash
# First time installation
./install.sh

# Subsequent starts
./start.sh
```

**That's it!** The script will automatically:
- ✅ Check environment (Node.js, pnpm, Docker)
- ✅ Install dependencies
- ✅ Start PostgreSQL in Docker
- ✅ Setup database schema
- ✅ Configure environment
- ✅ Start the dev server

Access the app at: **http://localhost:8080** 🚀

### 📦 Database Management Scripts

```bash
# Start database only
./db-start.sh

# Stop database (with options to keep or delete data)
./db-stop.sh

# View database logs
docker logs slide-forge-db

# Connect to database directly
docker exec -it slide-forge-db psql -U presentation_user -d slide_forge
```

For detailed instructions, see [QUICK_START.md](QUICK_START.md)

## ✨ Features

### 🤖 AI-Powered Generation

- **Smart Outline Generation**: Automatically create structured presentation outlines from topics or content
- **AI Image Generation**: Generate high-quality slide visuals using yunwu API (Gemini 3 Pro Image)
- **Multi-turn Editing**: Refine and modify generated slides with natural language instructions
- **Web Search Integration**: Enhance outlines with real-time web search data

### 🎯 Claude Agent (New!)

- **Conversational AI**: Chat with Claude Agent powered by Amazon Bedrock to create presentations through natural dialogue
- **Intelligent Tools**: Claude can automatically search the web, read files, and help refine your slides
- **Session Management**: Save and resume conversations, maintain full context across multiple turns
- **Multi-modal Input**: Upload files for analysis, ask questions, and iterate on your content
- **Smart Sidebar**: Quick access to recent Agent sessions directly from the sidebar

### 📄 Flexible Input Methods

- **Text Input**: Describe your topic directly in the input field
- **File Upload**: Upload documents and automatically extract content
  - Supported formats: `.txt`, `.md`, `.docx`, `.pdf`
  - Drag-and-drop support
  - File size limit: 16MB
  - Automatic text extraction and parsing

### 🎨 Customization Options

- **10+ Built-in Themes**: Professional, creative, minimal, bold, and more
- **Custom Theme Creator**: Design your own themes with custom colors and fonts
- **Template Styles**: Multiple presentation templates (corporate, creative, minimal, etc.)
- **Image Configuration**:
  - Aspect ratios: 16:9, 4:3, 1:1, 9:16, 21:9, and more
  - Resolutions: 1K (fast), 2K (balanced), 4K (high quality)
- **Multi-language Support**: 12+ languages including English, Chinese, Japanese, Korean, Spanish, etc.
- **Flexible Slide Count**: Generate 1-50 slides as needed

### 📤 Export Options

- **PDF Export**: Generate PDF documents with all slides
- **PPTX Export**: Export to PowerPoint format
- **Image Export**: Download individual slides as images

### 💾 Smart Features

- **Auto-save**: Automatic saving of work in progress
- **Conversation History**: Maintains context for multi-turn slide modifications
- **Persistent Storage**: All generated images stored permanently via UploadThing

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18.x or higher
- npm, yarn, or pnpm package manager (pnpm recommended)
- **Docker & Docker Compose** (for local database)
- Required API keys:
  - OpenAI API key or OpenAI-compatible API (for text generation)
  - yunwu API key (for AI image generation with Gemini 3 Pro Image)
  - AWS Cognito credentials (for authentication)
  - UploadThing token (for file storage)
  - Tavily API key (optional, for web search)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/IanLiYi1996/slide-forge
   cd slide-forge
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory with the following variables:

   ```env
   # Database (Docker default)
   DATABASE_URL="postgresql://presentation_user:presentation_password@localhost:5432/slide_forge"

   # Authentication
   NEXTAUTH_SECRET=""  # Generate with: openssl rand -base64 32
   NEXTAUTH_URL="http://localhost:8080"

   # AWS Cognito Provider (for user authentication)
   COGNITO_CLIENT_ID=""
   COGNITO_CLIENT_SECRET=""
   COGNITO_ISSUER=""

   # AI Providers - Text Generation (OpenAI Compatible)
   LLM_API_KEY=""            # Required: API key for LLM service
   LLM_BASE_URL=""           # Optional: Leave empty to use OpenAI
   LLM_MODEL_NAME="gpt-4o-mini"  # Optional: Model name (default: gpt-4o-mini)

   # AI Providers - Image Generation
   YUNWU_API_KEY=""   # For AI image generation (Gemini 3 Pro Image)

   # File Storage
   UPLOADTHING_TOKEN=""  # For storing generated images and uploads

   # Optional Services
   TAVILY_API_KEY=""       # For web search in outline generation (optional)

   # Claude Agent SDK - Amazon Bedrock (NEW!)
   CLAUDE_CODE_USE_BEDROCK="1"      # Enable Bedrock as API provider
   ENABLE_CLAUDE_AGENT="true"       # Enable Claude Agent feature

   # AWS Credentials (for Claude Agent via Bedrock)
   # Choose one method:
   # Method 1: Direct credentials
   AWS_ACCESS_KEY_ID=""
   AWS_SECRET_ACCESS_KEY=""
   AWS_REGION="us-east-1"

   # Method 2: AWS Profile (recommended for local development)
   # AWS_PROFILE="your-profile-name"
   # AWS_REGION="us-east-1"

   # Method 3: IAM Role (automatic in AWS environments like EC2/ECS)
   # AWS_REGION="us-east-1"
   ```

   > 💡 **Tip**: Copy `.env.example` to `.env` and fill in your actual values.
   >
   > 📝 **AWS Cognito Setup**: For detailed instructions on setting up AWS Cognito authentication, see [COGNITO_SETUP.md](COGNITO_SETUP.md).
   >
   > 🔑 **yunwu API**: Get your API key from [yunwu.ai](https://yunwu.ai) to enable AI image generation.
   >
   > 🤖 **Claude Agent Setup**: See detailed setup guide below

### API Keys Configuration

> 📖 **Detailed Guide**: See [docs/API_CONFIGURATION.md](docs/API_CONFIGURATION.md) for complete setup instructions, testing commands, and troubleshooting.

#### Quick Reference Table

| Service | Required | Used For | Get Key From |
|---------|----------|----------|--------------|
| **LLM API** | Required | Text generation | https://platform.openai.com/api-keys (or your provider) |
| **yunwu API** | Optional | Image generation | https://yunwu.ai |
| **AWS Bedrock** | For Chat to Slides | Claude Agent | AWS Console > Bedrock |
| **Tavily API** | Optional | Web search | https://tavily.com |
| **UploadThing** | Required | File storage | https://uploadthing.com |
| **Unsplash API** | Optional | Stock images | https://unsplash.com/developers |

#### Detailed Configuration

#### 1. Text Generation (OpenAI Compatible)

Unified configuration that supports OpenAI and compatible services:

**Using OpenAI (Default)**:
```env
LLM_API_KEY="sk-..."              # Required: Your OpenAI API key
# LLM_BASE_URL=""                 # Leave empty or omit for OpenAI
# LLM_MODEL_NAME="gpt-4o-mini"    # Optional: defaults to gpt-4o-mini
```

**Get your key**: https://platform.openai.com/api-keys

**Using Alternative Providers**:
```env
LLM_API_KEY="sk-..."              # Your API key
LLM_BASE_URL="http://localhost:1234/v1"  # Custom endpoint
LLM_MODEL_NAME="gpt-4o-mini"      # Your model name
```

**Popular providers**:
- **OpenAI** (default): Leave `LLM_BASE_URL` empty
- **LM Studio**: `http://localhost:1234/v1`
- **Ollama**: `http://localhost:11434/v1`
- **vLLM**: `http://localhost:8000/v1`
- **云雾 API (yunwu.ai)**: `https://api.xiaomimimo.com/v1`

**Used for**: All text generation tasks (outline, slides content)

#### 2. Image Generation API

```env
YUNWU_API_KEY="sk-..."
```

**Get your key**: https://yunwu.ai

**Used for**: AI-powered slide image generation (Gemini 3 Pro Image)

#### 3. Claude Agent SDK (Amazon Bedrock)

For the Chat to Slides feature, configure AWS Bedrock access:

**Option A: AWS Profile (Recommended for local development)**
```env
CLAUDE_CODE_USE_BEDROCK="1"
ENABLE_CLAUDE_AGENT="true"
AWS_PROFILE="your-profile-name"
AWS_REGION="us-east-1"
```

**Option B: Direct Credentials**
```env
CLAUDE_CODE_USE_BEDROCK="1"
ENABLE_CLAUDE_AGENT="true"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
```

**Option C: IAM Role (Automatic in AWS environments)**
```env
CLAUDE_CODE_USE_BEDROCK="1"
ENABLE_CLAUDE_AGENT="true"
AWS_REGION="us-east-1"
```

**Setup steps**:
1. **Enable model access** in AWS Console:
   - Navigate to AWS Console > Amazon Bedrock > Model access
   - Request access to Claude models (Sonnet 3.5, Opus, Haiku)
   - Wait for approval (usually instant)

2. **Configure IAM permissions**:
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
         "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
       }
     ]
   }
   ```

3. **Verify setup**:
   ```bash
   # Test AWS credentials
   aws sts get-caller-identity

   # Test Bedrock access
   aws bedrock list-foundation-models --region us-east-1
   ```

**Used for**: Chat to Slides conversational interface, web search, file analysis

#### 5. Web Search API (Optional)

```env
TAVILY_API_KEY="tvly-..."
```

**Get your key**: https://tavily.com

**Used for**: Real-time web search in Chat to Slides

#### 6. File Storage

```env
UPLOADTHING_TOKEN="..."
```

**Get your token**: https://uploadthing.com

**Used for**: Storing uploaded files and generated images

### Database Setup

The project uses Docker to run PostgreSQL locally for development.

1. **Start the database with Docker**

   ```bash
   # Start PostgreSQL in Docker (runs in background)
   docker-compose up -d

   # Check database status
   docker-compose ps
   ```

   The database will be accessible at `localhost:5432` with credentials:
   - Username: `presentation_user`
   - Password: `presentation_password`
   - Database: `slide_forge`

2. **Initialize the database schema**

   ```bash
   pnpm db:push
   ```

3. **Stop the database (when needed)**

   ```bash
   # Stop database
   docker-compose down

   # Stop and remove all data (⚠️  Warning: deletes all data)
   docker-compose down -v
   ```

4. **Start the development server**

   ```bash
   pnpm dev
   ```

1. **Open the application**

   Navigate to [http://localhost:8080](http://localhost:8080) in your browser.

## 📖 Usage Guide

### Method 1: Quick Generation (Traditional)

1. **Configure Settings** (Optional)
   - Click **"图片设置"** to configure image aspect ratio and resolution
   - Click **"主题风格"** to select or customize presentation theme
   - Adjust number of slides (1-50) and language

2. **Input Your Content**

   Choose one of two methods:

   **Method A: Text Input**
   - Type or paste your presentation topic directly into the input field
   - Press `Ctrl + Enter` or click "Generate Presentation"

   **Method B: File Upload**
   - Click **"Upload File"** or drag-and-drop a file (.txt, .md, .docx, .pdf)
   - Content will be automatically extracted and filled into the input field
   - Review and edit the extracted content if needed
   - Click "Generate Presentation"

3. **Review Outline**
   - AI will generate a structured outline with your specified number of slides
   - Review the outline structure
   - Toggle web search for enhanced content (optional)
   - Click "Start Generating Slides"

4. **Generate Slides**
   - AI will generate each slide one by one
   - Preview each slide image
   - Optionally modify slides with natural language instructions (e.g., "make colors warmer", "add more illustrations")
   - Confirm each slide to proceed to the next
   - Click "Finish & Save" when done

5. **Export & Share**
   - View your completed presentation
   - Export as PDF, PPTX, or individual images
   - Share or download for your use

### Method 2: Conversational AI with Claude Agent (New!)

1. **Access Claude Agent**
   - Click **"Claude Agent"** in the left sidebar (with Beta badge)
   - Or navigate to existing Agent sessions in the sidebar

2. **Start a Conversation**
   - Click **"Start New Conversation"** from the quick start card
   - Or click **"New Session"** button in the top right

3. **Chat with Claude**
   - Describe what presentation you want to create
   - Example: "Create a 10-slide presentation about artificial intelligence in healthcare"
   - Claude will automatically search the web for current information
   - Upload files for Claude to analyze and incorporate

4. **Iterate and Refine**
   - Continue the conversation to refine your slides
   - Ask Claude to add more detail, change tone, or reorganize content
   - Request specific slide counts or formatting
   - All context is preserved throughout the conversation

5. **Manage Sessions**
   - Sessions are automatically saved in the sidebar
   - Click any session in the sidebar to resume
   - Hover and click the delete button to remove sessions
   - View all sessions from the Agent main page

### Image Configuration

Configure image generation parameters via the **"图片设置"** dialog:

**Aspect Ratios:**

- `16:9` - Widescreen (Recommended for most presentations)
- `4:3` - Standard/Classic
- `1:1` - Square
- `9:16` - Portrait
- `21:9` - Ultra-wide
- And more...

**Resolutions:**

- `1K` - Fast generation, suitable for drafts
- `2K` - Balanced quality and speed (Recommended)
- `4K` - Highest quality, slower generation

### File Upload Tips

- **Supported formats**: .txt, .md, .docx, .pdf
- **Maximum size**: 16MB per file
- **Best practices**:
  - Use well-structured documents for better outline generation
  - PDF files should be text-based (not scanned images)
  - DOCX files will have text extracted, formatting may be lost
  - Review extracted content before generating

## 🛠️ Tech Stack

### Core Framework

- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

### AI & APIs

- **OpenAI API** - Text generation (outline, content)
- **yunwu API** - Image generation (Gemini 3 Pro Image)
- **Tavily API** - Web search integration
- **Claude Agent SDK** - Conversational AI via Amazon Bedrock
- **Amazon Bedrock** - Claude model access with enterprise security

### Database & Storage

- **PostgreSQL 15** - Primary database (runs in Docker for local dev)
- **Docker & Docker Compose** - Container orchestration
- **Prisma** - ORM and schema management
- **UploadThing** - File upload and storage

### Authentication

- **NextAuth.js** - Authentication framework
- **AWS Cognito** - Identity provider

### Document Processing

- **mammoth** - DOCX text extraction
- **unpdf** - PDF text extraction

### UI Components

- **Radix UI** - Accessible component primitives
- **Plate** - Rich text editor
- **Lucide Icons** - Icon library
- **Sonner** - Toast notifications

## 📂 Project Structure

```
src/
├── app/
│   ├── _actions/          # Server actions
│   │   ├── image/         # Image generation actions
│   │   └── presentation/  # Presentation CRUD actions
│   ├── api/               # API routes
│   │   ├── agent/         # 🆕 Claude Agent API endpoints
│   │   │   ├── chat/      # Chat streaming endpoint
│   │   │   └── session/   # Session management
│   │   ├── parse-file/    # File parsing endpoint
│   │   ├── presentation/  # Presentation endpoints
│   │   └── uploadthing/   # File upload configuration
│   └── presentation/      # Presentation pages
│       └── agent/         # 🆕 Claude Agent pages
│           ├── page.tsx   # Agent session list
│           └── [sessionId]/page.tsx  # Agent chat interface
├── components/
│   ├── layout/            # Layout components
│   │   ├── GlobalSidebar.tsx          # Main sidebar (collapsible)
│   │   └── RecentAgentSessions.tsx    # 🆕 Agent session history
│   ├── presentation/      # Presentation-specific components
│   │   ├── agent/         # 🆕 Agent chat components
│   │   │   ├── AgentChat.tsx         # Chat interface
│   │   │   └── MarkdownMessage.tsx   # Markdown rendering
│   │   ├── dashboard/     # Dashboard components
│   │   ├── editor/        # Slide editor
│   │   ├── generation/    # Slide generation UI
│   │   ├── outline/       # Outline display
│   │   └── theme/         # Theme customization
│   └── ui/                # Reusable UI components
├── lib/
│   ├── agent/             # 🆕 Claude Agent SDK integration
│   │   ├── agent-service.ts      # Agent core service
│   │   ├── session-manager.ts    # Session management
│   │   └── types.ts              # Agent type definitions
│   ├── file-parsers/      # File parsing utilities
│   ├── presentation/      # Presentation utilities
│   └── model-picker.ts    # AI model configuration
├── states/
│   ├── agent-state.ts     # 🆕 Agent state management
│   └── presentation-state.ts  # Presentation state management
├── server/
│   ├── auth.ts            # Authentication configuration
│   └── db.ts              # Database client
└── types/                 # TypeScript type definitions
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🔧 Additional Features

### Database Management

The project uses Docker for easy local database management:

**Quick Commands:**
```bash
./db-start.sh    # Start database
./db-stop.sh     # Stop database (interactive menu)
```

**Advanced Commands:**
```bash
# View database logs
docker logs slide-forge-db

# Follow logs in real-time
docker logs -f slide-forge-db

# Connect to database
docker exec -it slide-forge-db psql -U presentation_user -d slide_forge

# Backup database
docker exec slide-forge-db pg_dump -U presentation_user slide_forge > backup.sql

# Restore from backup
cat backup.sql | docker exec -i slide-forge-db psql -U presentation_user -d slide_forge

# View container status
docker-compose ps

# Restart database
docker-compose restart postgres
```

**Troubleshooting:**
- If database won't start: `docker-compose down && docker-compose up -d postgres`
- If port 5432 is in use: Stop other PostgreSQL instances
- To reset database: `./db-stop.sh` → choose option 2 (delete all data)

### Sidebar Features

- **Collapsible Sidebar**: Click the collapse button (◀️/▶️) in the bottom left to expand/collapse
- **Theme Toggle**: Switch between light and dark mode with the moon/sun button
- **Quick Access**: Recent presentations and Agent sessions are displayed in the sidebar
- **Hover Actions**: Hover over items to reveal delete buttons

### Claude Agent Features

- **Long-running Sessions**: Agents maintain context across multiple messages
- **Tool Integration**: Automatic web search, file reading, and content analysis
- **Markdown Support**: Rich text formatting in AI responses (code blocks, tables, lists, etc.)
- **Enterprise Security**: Uses Amazon Bedrock for data privacy and compliance

## 🙏 Acknowledgments

- yunwu.ai for providing the Gemini 3 Pro Image API
- OpenAI for language model capabilities
- Anthropic for Claude Agent SDK and Amazon Bedrock integration
- All open-source libraries that made this project possible
