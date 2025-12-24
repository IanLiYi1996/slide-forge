## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18.x or higher
- npm, yarn, or pnpm package manager
- PostgreSQL database
- Required API keys:
  - OpenAI API key (for AI generation features)
  - Together AI API key (for image generation)
  - AWS Cognito credentials (for authentication)

### Installation

1. **Clone the repository**

   ```bash
   git clone git@github.com:allweonedev/presentation-ai.git
   cd presentation-ai
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory with the following variables:

   ```env
   # AI Providers
   OPENAI_API_KEY=""
   TOGETHER_AI_API_KEY=""

   # Next Auth Configuration
   NEXTAUTH_SECRET=""
   NEXTAUTH_URL="http://localhost:8080"

   # AWS Cognito Provider
   COGNITO_CLIENT_ID=""
   COGNITO_CLIENT_SECRET=""
   COGNITO_ISSUER=""

   # File Upload Service
   UPLOADTHING_TOKEN=""

   TAVILY_API_KEY=""

   # PostgreSQL Database
   DATABASE_URL="postgresql://username:password@localhost:5432/presentation_ai"
   ```

   > 💡 **Tip**: Copy `.env.example` to `.env` and fill in your actual values.
   >
   > 📝 **AWS Cognito Setup**: For detailed instructions on setting up AWS Cognito authentication, see [COGNITO_SETUP.md](COGNITO_SETUP.md).

### Database Setup

1. **Initialize the database**

   ```bash
   pnpm db:push
   ```

1. **Start the development server**

   ```bash
   pnpm dev
   ```

1. **Open the application**

   Navigate to [http://localhost:8080](http://localhost:8080) in your browser.
