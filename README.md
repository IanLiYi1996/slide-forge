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

   UNSPLASH_ACCESS_KEY=""
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

## 💻 Usage

### Creating a Presentation

Follow these steps to create your first AI-generated presentation:

1. Login the website
1. Navigate to the dashboard
1. Enter your presentation topic
1. Choose the number of slides (recommended: 5-10)
1. Select your preferred language
1. Choose a page style
1. Toggle web search (if you want)
1. Click **"Generate Outline"**
1. Review and edit the AI-generated outline
1. Select a theme for your presentation
1. Choose an image source (ai / stock)
1. Select your presentation style (Professional/Casual)
1. Click **"Generate Presentation"**
1. Wait for the AI to create your slides in real-time
1. Preview, edit, and refine your presentation as needed
1. Present directly from the app or export your presentation

### Custom Themes

Create personalized themes to match your brand or style:

1. Click **"Create New Theme"**
2. Start from scratch or derive from an existing theme
3. Customize colors, fonts, and layout
4. Save your theme for future use

## 🧠 Local Models Guide

You can use either Ollama or LM Studio for using local models in ALLWEONE presentation ai.

### LM Studio

1. Install [LM Studio](https://lmstudio.ai).
2. In the LM Studio app, turn the Server ON and enable CORS.
3. Download any model you want to use inside LM Studio.

### Ollama

1. Install [Ollama](https://ollama.com).
2. Download whichever model you want to use (for example: `ollama pull llama3.1`).

### Using Local Models in the App

1. Open the app and open the text model selector.
2. Chose the model you want to use (it must be downloaded in lm studio or ollama)
3. Enjoy the generation

Notes:

- Models will automatically appear in the Model Selector when the LM Studio server or the Ollama daemon is running.
- Make sure LM Studio has CORS enabled so the browser can connect.

## 📁 Project Structure
