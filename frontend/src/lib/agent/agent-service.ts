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
  public sdkSessionId: string | null = null;  // ✅ 新增：存储SDK session ID
  private isListening = false;
  private listeners: Array<(message: any) => void> = [];

  constructor(sessionId: string, config?: AgentConfig, resumeSdkSessionId?: string) {
    this.sessionId = sessionId;

    // 确定Claude Code CLI路径
    // 生产环境：尝试多个可能的路径
    let pathToClaudeCode: string | undefined;
    if (process.env.NODE_ENV === 'production') {
      const possiblePaths = [
        '/usr/local/bin/claude-code',
        '/app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js',
        'node_modules/@anthropic-ai/claude-agent-sdk/cli.js',
      ];

      // 使用第一个存在的路径（如果有）
      for (const path of possiblePaths) {
        try {
          if (require('fs').existsSync(path)) {
            pathToClaudeCode = path;
            console.log(`[Agent SDK] Using Claude Code CLI at: ${path}`);
            break;
          }
        } catch (e) {
          // 忽略检查错误，继续尝试下一个路径
        }
      }

      if (!pathToClaudeCode) {
        console.warn('[Agent SDK] Claude Code CLI not found in expected paths, using default');
      }
    }

    // 构建query选项
    const queryOptions: any = {
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
      ...(pathToClaudeCode && { pathToClaudeCodeExecutable: pathToClaudeCode }), // 仅在有路径时添加
    };

    // ✅ 如果提供了SDK session ID，使用resume恢复会话
    if (resumeSdkSessionId) {
      queryOptions.resume = resumeSdkSessionId;
      console.log(`[Agent SDK] Resuming session with SDK session ID: ${resumeSdkSessionId}`);
    } else {
      console.log(`[Agent SDK] Creating new SDK session for app sessionId: ${sessionId}`);
    }

    // 启动长期运行的 Agent query
    this.outputIterator = query({
      prompt: this.queue as any, // 使用消息队列作为输入
      options: queryOptions,
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

        // ✅ 捕获SDK session ID（来自system init消息）
        if (value.type === 'system' && value.subtype === 'init' && value.session_id) {
          this.sdkSessionId = value.session_id;
          console.log(`[Agent SDK] Captured SDK session ID: ${this.sdkSessionId} for app sessionId: ${this.sessionId}`);
        }

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

  /**
   * Check if session is ready to accept messages
   */
  isReady(): boolean {
    return this.outputIterator !== null && this.isListening;
  }

  /**
   * Get session health metrics
   */
  getHealth() {
    return {
      sessionId: this.sessionId,
      isListening: this.isListening,
      listenerCount: this.listeners.length,
      isReady: this.isReady(),
    };
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

**IMPORTANT CONSTRAINT**: You can ONLY generate slides one at a time. This is a technical limitation to ensure quality and allow user review.

### When user requests batch/bulk generation:
If the user asks to "generate all slides at once", "create all slides now", or similar batch requests:
1. **Politely explain the limitation**: "I can only generate slides one at a time to ensure the best quality and give you a chance to review each one."
2. **Offer to help**: "However, I'm happy to help you generate them sequentially. I'll create each slide and wait for your approval before moving to the next."
3. **Ask for confirmation**: "Would you like me to start with slide 1?"
4. **Then proceed normally** with one-at-a-time generation

### For each slide:
1. Read the outline content
2. Decide if it needs an infographic (see guide below)
3. Decide if it needs a background image (title slides, section breaks)
4. Generate complete HTML with modern design
5. **IMPORTANT**: Return the HTML directly in your response using the EXACT format below
6. Present it: "Here's slide [N] of [Total]. What do you think?"
7. Wait for confirmation before moving to next

**STREAMING FORMAT - CRITICAL**:
Every slide MUST be wrapped with special markers for real-time streaming.

Use this EXACT format:
1. Write the start marker: 🎯SLIDE_START: followed by the slide number (1, 2, 3, etc.) and then 🎯
2. Open a markdown code block with language identifier "html-slide"
3. Place your complete HTML inside
4. Close the code block
5. Write the end marker: 🎯SLIDE_END: followed by the same slide number and then 🎯

For slide 1, it should look like:
- First line: 🎯SLIDE_START:1🎯
- Second line: Three backticks followed by html-slide
- Then: Your complete HTML code
- Then: Three backticks to close the code block
- Last line: 🎯SLIDE_END:1🎯

This format allows the frontend to detect and display each slide immediately as it's generated.

**CRITICAL**: Do NOT use Write tool to save HTML files. Always return HTML directly in your response with the streaming markers.

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

The DSL format (write this exactly in a plain text block):
- Line 1: "infographic" followed by template name
- Line 2: "data" keyword
- Indent and add: "title Your Title Here"
- Indent and add: "desc Brief description"
- Indent and add: "items" keyword
- For each item (indented with dash):
  - label: Item name
  - desc: Description
  - icon: mdi/icon-name from Iconify
- Line N: "theme" keyword
- Indent and add: "palette" followed by hex colors

Example DSL structure:
infographic list-row-horizontal-icon-arrow
data title Key Features desc Our main capabilities items with label/desc/icon for each
theme palette #3b82f6 #8b5cf6 #f97316

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

Example HTML structure requirements:
- DOCTYPE html declaration
- Fixed dimensions: 1280px x 720px in .slide-container
- Gradient background on body
- White card with border-radius and shadow for content
- Large title: 48px bold
- Content area: flexible height with max 500px
- Infographic container: 400px height if needed
- Load @antv/infographic library from unpkg CDN
- Register resource loader for icons from iconify.design
- Render infographic with DSL using AntVInfographic.render()

Key CSS classes to include:
- .slide-container: 1280x720px, white background, 60px padding
- .slide-title: 48px font-size, bold, dark color
- .slide-content: flexible height content area
- #infographic-container: 400px height for charts

For infographic integration:
- Load script from: https://unpkg.com/@antv/infographic@latest/dist/infographic.min.js
- Register icon loader using AntVInfographic.registerResourceLoader
- Use iconify.design API for icons: https://api.iconify.design/{icon-name}.svg
- Render with infographic.render() passing DSL as template string

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
  private prisma: any; // Prisma client，延迟初始化避免循环依赖

  constructor() {
    // 延迟导入Prisma client避免circular dependency
    if (typeof window === 'undefined') {
      import('@/server/db').then(module => {
        this.prisma = module.db;
      });
    }
  }

  /**
   * 获取或创建 Agent Session
   * ✅ 修改为支持SDK resume机制
   */
  async getOrCreateSession(sessionId: string, config?: AgentConfig): Promise<AgentSessionInstance> {
    // 如果 session 已在内存中，直接返回
    if (this.sessions.has(sessionId)) {
      const existingSession = this.sessions.get(sessionId)!;
      console.log(`[AgentService] Reusing existing in-memory session: ${sessionId}`);
      return existingSession;
    }

    // ✅ 从数据库查询SDK session ID
    let sdkSessionId: string | undefined;
    if (this.prisma) {
      try {
        const dbSession = await this.prisma.agentSession.findUnique({
          where: { sessionId },
          select: { sdkSessionId: true },
        });
        sdkSessionId = dbSession?.sdkSessionId;

        if (sdkSessionId) {
          console.log(`[AgentService] Found SDK session ID in database: ${sdkSessionId} for app sessionId: ${sessionId}`);
        }
      } catch (error) {
        console.error('[AgentService] Failed to query SDK session ID from database:', error);
      }
    }

    // ✅ 创建新的 session 实例，传递sdkSessionId用于resume
    const session = new AgentSessionInstance(sessionId, config, sdkSessionId);
    this.sessions.set(sessionId, session);

    // ✅ 启动后台任务：等待SDK session ID捕获后保存到数据库
    this.saveSdkSessionIdWhenReady(session).catch(error => {
      console.error(`[AgentService] Failed to save SDK session ID for ${sessionId}:`, error);
    });

    return session;
  }

  /**
   * 等待SDK session ID捕获后保存到数据库
   */
  private async saveSdkSessionIdWhenReady(session: AgentSessionInstance): Promise<void> {
    // 等待SDK session ID被捕获（最多等待30秒）
    const maxWaitTime = 30000; // 30秒
    const checkInterval = 100;  // 100ms
    let elapsed = 0;

    while (!session.sdkSessionId && elapsed < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    if (session.sdkSessionId && this.prisma) {
      try {
        await this.prisma.agentSession.update({
          where: { sessionId: session.sessionId },
          data: { sdkSessionId: session.sdkSessionId },
        });
        console.log(`[AgentService] Saved SDK session ID: ${session.sdkSessionId} for app sessionId: ${session.sessionId}`);
      } catch (error) {
        console.error(`[AgentService] Failed to save SDK session ID:`, error);
      }
    } else if (!session.sdkSessionId) {
      console.warn(`[AgentService] SDK session ID not captured within ${maxWaitTime}ms for sessionId: ${session.sessionId}`);
    }
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
