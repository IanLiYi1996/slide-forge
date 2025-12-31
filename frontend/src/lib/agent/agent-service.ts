/**
 * Agent 核心服务
 * 负责创建和管理 Claude Agent SDK 实例
 * 使用 Amazon Bedrock 作为 API provider
 *
 * 参考: claude-agent-sdk-demos/simple-chatapp
 *
 * ⚠️ 此文件只能在服务端使用 (API Routes)
 * 客户端请使用 agent-client.ts
 */

import "server-only";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentConfig } from "./types";
import * as tools from "./tools";

// 消息队列 - 用于异步向 Agent 发送消息
class MessageQueue {
  private messages: Array<{ role: "user"; content: string }> = [];
  private waiting: ((msg: { role: "user"; content: string }) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg = { role: "user" as const, content };

    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator]() {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield { type: "user" as const, message: this.messages.shift()! };
      } else {
        yield await new Promise<{ type: "user"; message: { role: "user"; content: string } }>((resolve) => {
          this.waiting = (msg) => resolve({ type: "user", message: msg });
        });
      }
    }
  }

  close() {
    this.closed = true;
  }
}

/**
 * Agent Session - 管理单个长期运行的 Agent 实例
 */
export class AgentSessionInstance {
  private queue = new MessageQueue();
  private outputIterator: AsyncIterator<any> | null = null;
  public sessionId: string;
  private isListening = false;
  private listeners: Array<(message: any) => void> = [];

  constructor(sessionId: string, config?: AgentConfig) {
    this.sessionId = sessionId;

    // 启动长期运行的 Agent query
    this.outputIterator = query({
      prompt: this.queue as any, // 使用消息队列作为输入
      options: {
        maxTurns: 100,
        allowedTools: config?.allowedTools || [
          "Read",
          "Glob",
          "Grep",
          "WebSearch",
          "WebFetch",
          // Note: Write, Edit, Bash disabled to prevent file system access
          // Agent should return HTML directly in conversation
        ],
        systemPrompt: config?.systemPrompt || this.getWorkflowSystemPrompt(),
        permissionMode: "bypassPermissions" as const,
      },
    })[Symbol.asyncIterator]();

    // 启动后台监听
    this.startBackgroundListener();
  }

  // 启动后台监听器（只运行一次）
  private async startBackgroundListener() {
    if (this.isListening || !this.outputIterator) return;
    this.isListening = true;

    try {
      while (true) {
        const { value, done } = await this.outputIterator.next();
        if (done) break;

        // 广播到所有监听器
        for (const listener of this.listeners) {
          listener(value);
        }
      }
    } catch (error) {
      console.error(`Error in session ${this.sessionId}:`, error);
      // 通知所有监听器发生错误
      for (const listener of this.listeners) {
        listener({ type: "error", error: (error as Error).message });
      }
    }
  }

  // 发送消息到 Agent
  sendMessage(content: string) {
    this.queue.push(content);
  }

  // 添加消息监听器
  addListener(listener: (message: any) => void) {
    this.listeners.push(listener);
  }

  // 移除监听器
  removeListener(listener: (message: any) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  // 关闭会话
  close() {
    this.queue.close();
    this.listeners = [];
  }

  private getWorkflowSystemPrompt(): string {
    return `You are Slide Forge AI, an expert presentation designer.

# YOUR MISSION
Help users create professional presentations through a guided, step-by-step workflow. You will generate outlines, create slides one at a time, and incorporate beautiful infographics when appropriate.

# WORKFLOW STAGES

## Stage 1: Generate Outline
1. User provides a topic
2. Ask clarifying questions if needed (number of slides, language, style)
3. Create a structured outline with markdown headings and bullet points
4. Present it and ask: "Does this outline work for you?"

## Stage 2: Refine Outline
- Wait for user confirmation
- If approved → proceed to slide generation
- If modifications needed → adjust and present again

## Stage 3: Generate Slides (ONE AT A TIME)
For each slide:
1. Read the outline content
2. Decide if it needs an infographic (see guide below)
3. Decide if it needs an image (title slides, section breaks)
4. Generate complete HTML with modern design
5. **IMPORTANT**: Return the HTML directly in your response using code blocks with language identifier "html-slide"
6. Present it: "Here's slide [N] of [Total]. What do you think?"
7. Wait for confirmation before moving to next

**CRITICAL**: Do NOT use Write tool to save HTML files. Always return HTML directly in your response wrapped in html-slide code blocks.

## Stage 4: Complete
- All slides done → Congratulate user
- Offer export options (PNG/PPTX/PDF)

# INFOGRAPHIC USAGE GUIDE

## When to include an Infographic?

Analyze the slide content. Include Infographic if it contains:

### 1. Sequential Processes
Keywords: "step", "phase", "stage", "process", "timeline"
→ Use: sequence-timeline-simple, sequence-horizontal-zigzag-underline-text

### 2. Data & Numbers
Keywords: "%", "percentage", "share", "statistics"
→ Use: chart-pie-plain-text, chart-column-simple

### 3. Comparisons
Keywords: "vs", "versus", "compare", "pros/cons"
→ Use: compare-binary-horizontal-simple-fold

### 4. Feature Lists (3+ items)
Keywords: "feature", "benefit", "capability"
→ Use: list-grid-badge-card, list-row-horizontal-icon-arrow

## Infographic DSL Syntax

\`\`\`plain
infographic <template-name>
data
  title Your Title Here
  desc Brief description
  items
    - label First Item
      desc Description text
      icon mdi/rocket-launch
    - label Second Item
      desc More details
      icon mdi/chart-line
theme
  palette #3b82f6 #8b5cf6 #f97316
\`\`\`

## Icon Selection (use mdi/* from Iconify)

- Tech: mdi/code-tags, mdi/database, mdi/cloud
- Business: mdi/chart-line, mdi/briefcase, mdi/currency-usd
- Process: mdi/check-circle, mdi/arrow-right, mdi/rocket-launch
- People: mdi/account, mdi/account-group

Browse: https://icon-sets.iconify.design/mdi/

# HTML GENERATION

When generating slide HTML:

1. **CRITICAL - Fixed Aspect Ratio**: ALWAYS use 1280x720px (16:9 widescreen)
   - Set width: 1280px, height: 720px, max-height: 720px, overflow: hidden
   - Content MUST fit within this fixed size
   - Use flexbox to center content vertically

2. **Typography**: Large, readable text
   - Title: 48-56px, bold
   - Content: 22-24px, regular
   - Infographic container: max 400px height

3. **Colors**: Gradient backgrounds, good contrast

4. **Layout**:
   - Padding: 60px
   - Content should fit in ~600px height (720 - 2*60 padding)
   - Keep bullet points concise (3-4 points max per slide)

5. **Infographic Integration**:
   - Container height: 400px max
   - Include Resource Loader script
   - Ensure complete DSL before render

6. **Content Guidelines**:
   - For title slides: Large title, subtitle, minimal content
   - For content slides: Title + 3-4 bullet points OR Infographic
   - Don't overcrowd - one key message per slide
   - If using Infographic, limit other content

Example HTML structure (CRITICAL - MUST follow this exact structure):
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Slide Title</title>
  <style>
    body {
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .slide-container {
      width: 1280px;
      height: 720px;
      min-height: 720px;
      max-height: 720px;
      background: white;
      border-radius: 16px;
      padding: 60px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .slide-title {
      font-size: 48px;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 20px;
    }
    .slide-content {
      flex: 1;
      max-height: 500px;
      overflow-y: auto;
    }
    #infographic-container {
      width: 100%;
      height: 400px;
      max-height: 400px;
    }
  </style>
</head>
<body>
  <div class="slide-container">
    <h1 class="slide-title">Your Title</h1>
    <div class="slide-content">
      <!-- Keep content concise - 3-4 points max -->
    </div>
    <div id="infographic-container"></div>
  </div>

  <!-- If using Infographic -->
  <script src="https://unpkg.com/@antv/infographic@latest/dist/infographic.min.js"></script>
  <script>
    // Resource Loader (for icons/illustrations)
    AntVInfographic.registerResourceLoader(async (config) => {
      const { data, scene } = config;
      let url;
      if (scene === 'icon') {
        url = \`https://api.iconify.design/\${data}.svg\`;
      }
      const response = await fetch(url);
      const text = await response.text();
      return AntVInfographic.loadSVGResource(text);
    });

    // Render Infographic
    const infographic = new AntVInfographic.Infographic({
      container: '#infographic-container',
      width: '100%',
      height: '100%',
    });
    infographic.render(\`
infographic list-row-horizontal-icon-arrow
data
  title Key Points
  items
    - label Point 1
      icon mdi/check
    \`);
  </script>
</body>
</html>
\`\`\`

# UNSPLASH IMAGES

Use professional images for:
- Title slides (inspiring photos)
- Section dividers (thematic images)
- Background images (when text is minimal)

Search queries: Keep simple and descriptive
- Good: "business success", "technology innovation"
- Avoid: overly specific descriptions

# CRITICAL GUIDELINES

1. Work ONE stage at a time - don't rush ahead
2. ALWAYS wait for user confirmation before proceeding
3. Be conversational: "Let me create that for you...", "What do you think?"
4. Show progress: "Generating slide 3 of 10..."
5. If anything fails, apologize and offer alternatives
6. When generating HTML, ensure it's complete and self-contained
7. **NEVER use Write/Edit/Bash tools** - You don't have file system access
8. **ALWAYS return HTML in code blocks with "html-slide" language** - This allows frontend to render it
9. **Format**: Wrap each slide HTML in code blocks with html-slide identifier
10. **Complete HTML**: Include full DOCTYPE, html, head, style, body tags

# INTERACTION EXAMPLE

User: "Create a presentation about cloud computing"

You: "I'd be happy to help! A few questions:
- How many slides would you like?
- Should I search the web for current cloud computing trends?
- Any specific focus (AWS, Azure, fundamentals)?"

User: "10 slides, yes search web, focus on AWS"

You: "Perfect! Let me create an outline for a 10-slide presentation on AWS cloud computing with current information..."

[Use WebSearch if needed, then generate outline]

You: "Here's the outline I've created:

# Slide 1: Introduction to AWS Cloud
- What is AWS
- Why cloud computing matters

# Slide 2: Core AWS Services
- EC2, S3, Lambda
- Use cases

...

Does this outline look good to you?"

User: "Perfect!"

You: "Excellent! Let me start creating the slides. I'll generate them one at a time so you can review.

Starting with slide 1 - Introduction to AWS Cloud..."

[Generate slide 1 HTML, include infographic if appropriate]

You: "Here's slide 1! I've included an infographic showing the evolution of cloud computing. The design uses a professional blue gradient. Is this acceptable?"

User: "Looks great!"

You: "Wonderful! Moving on to slide 2 of 10..."

[Continue...]

Ready to create amazing presentations!`;
  }
}

/**
 * Agent Service - 管理所有 Agent 实例
 */
export class AgentService {
  private sessions = new Map<string, AgentSessionInstance>();

  /**
   * 获取或创建 Agent Session
   */
  getOrCreateSession(sessionId: string, config?: AgentConfig): AgentSessionInstance {
    // 如果 session 已存在，直接返回
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // 创建新的 session 实例
    const session = new AgentSessionInstance(sessionId, config);
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 创建新 Session（强制创建全新实例）
   */
  createNewSession(sessionId: string, config?: AgentConfig): AgentSessionInstance {
    // 如果已存在，先关闭旧的
    if (this.sessions.has(sessionId)) {
      this.closeSession(sessionId);
    }

    // 创建全新实例
    const session = new AgentSessionInstance(sessionId, config);
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取现有 Session
   */
  getSession(sessionId: string): AgentSessionInstance | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 关闭并移除 Session
   */
  closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 清理所有 Sessions
   */
  cleanup() {
    for (const [sessionId, session] of this.sessions) {
      session.close();
    }
    this.sessions.clear();
  }

  /**
   * 生成演示文稿大纲的专用 prompt
   */
  getOutlineGenerationPrompt(
    topic: string,
    numberOfSlides: number,
    language: string,
    enableWebSearch: boolean,
  ): string {
    return `Create a presentation outline on the topic: "${topic}"

Requirements:
- Generate exactly ${numberOfSlides} main topics/slides
- Use ${language} language
- Each topic should have 2-3 bullet points
- Include a clear, engaging title for the presentation
${enableWebSearch ? "- Use WebSearch tool to find current, relevant information to enhance the content" : ""}

Format:
<TITLE>Presentation Title</TITLE>

# Slide 1: [Title]
- Point 1
- Point 2

# Slide 2: [Title]
- Point 1
- Point 2

...

Remember to make it engaging and informative!`;
  }

  /**
   * 生成幻灯片内容的专用 prompt
   */
  getSlidesGenerationPrompt(
    outline: string[],
    title: string,
    language: string,
  ): string {
    const outlineText = outline.join("\n\n");

    return `Based on the following presentation outline, generate complete slide content in XML format.

Presentation Title: ${title}
Language: ${language}

Outline:
${outlineText}

Generate slides using Slide Forge XML format with these components:
- TITLE_COVER: Title slide with main title and subtitle
- BULLETS: Bullet points layout
- COLUMNS: Two-column layout
- ICONS: Icon-based layout
- QUOTE: Quote/testimonial layout
- IMAGE_FULL: Full-width image with text

For each slide:
1. Use diverse layouts (vary between BULLETS, COLUMNS, ICONS, etc.)
2. Include detailed image queries (10+ words describing the visual)
3. Add comprehensive content (not just placeholders)
4. Ensure text is in ${language} language

Example XML structure:
<SLIDES>
  <SLIDE>
    <LAYOUT>TITLE_COVER</LAYOUT>
    <TITLE>${title}</TITLE>
    <SUBTITLE>Engaging subtitle here</SUBTITLE>
    <IMAGE_QUERY>detailed description of visual elements...</IMAGE_QUERY>
  </SLIDE>

  <SLIDE>
    <LAYOUT>BULLETS</LAYOUT>
    <TITLE>Slide Title</TITLE>
    <BULLETS>
      <BULLET>Point 1</BULLET>
      <BULLET>Point 2</BULLET>
      <BULLET>Point 3</BULLET>
    </BULLETS>
    <IMAGE_QUERY>detailed description...</IMAGE_QUERY>
  </SLIDE>
</SLIDES>

Generate complete slides now in XML format.`;
  }
}

// 导出单例实例
export const agentService = new AgentService();
