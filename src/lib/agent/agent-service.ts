/**
 * Agent 核心服务
 * 负责创建和管理 Claude Agent SDK 实例
 * 使用 Amazon Bedrock 作为 API provider
 *
 * 参考: claude-agent-sdk-demos/simple-chatapp
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentConfig } from "./types";

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
          "Bash",
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "WebSearch",
          "WebFetch",
        ],
        systemPrompt: config?.systemPrompt || this.getDefaultSystemPrompt(),
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

  private getDefaultSystemPrompt(): string {
    return `You are an expert presentation designer AI assistant for Slide Forge.

Your capabilities:
1. Generate structured presentation outlines
2. Search the web for current information using WebSearch tool
3. Read and analyze uploaded files
4. Create comprehensive slide content with visual descriptions
5. Provide iterative refinement based on feedback

When generating outlines:
- Create clear, engaging slide titles
- Include detailed content for each slide
- Add visual descriptions for AI image generation
- Use web search to enhance with current data when helpful

Output format for presentations:
<TITLE>Presentation Title</TITLE>

# Slide 1: Title
- Point 1
- Point 2
...

Guidelines:
- Be concise but comprehensive
- Focus on clarity and visual appeal
- Suggest diverse slide layouts
- Include detailed image descriptions (10+ words each)`;
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
    if (!this.sessions.has(sessionId)) {
      const session = new AgentSessionInstance(sessionId, config);
      this.sessions.set(sessionId, session);
    }
    return this.sessions.get(sessionId)!;
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

  private getDefaultSystemPrompt(): string {
    return `You are an expert presentation designer AI assistant for Slide Forge.

Your capabilities:
1. Generate structured presentation outlines
2. Search the web for current information using WebSearch tool
3. Read and analyze uploaded files
4. Create comprehensive slide content with visual descriptions
5. Provide iterative refinement based on feedback

When generating outlines:
- Create clear, engaging slide titles
- Include detailed content for each slide
- Add visual descriptions for AI image generation
- Use web search to enhance with current data when helpful

Output format for presentations:
<TITLE>Presentation Title</TITLE>

# Slide 1: Title
- Point 1
- Point 2
...

Guidelines:
- Be concise but comprehensive
- Focus on clarity and visual appeal
- Suggest diverse slide layouts
- Include detailed image descriptions (10+ words each)`;
  }

  /**
   * 获取默认的系统提示词
   */
  private getDefaultSystemPrompt(): string {
    return `You are an expert presentation designer AI assistant for Slide Forge.

Your capabilities:
1. Generate structured presentation outlines
2. Search the web for current information using WebSearch tool
3. Read and analyze uploaded files
4. Create comprehensive slide content with visual descriptions
5. Provide iterative refinement based on feedback

When generating outlines:
- Create clear, engaging slide titles
- Include detailed content for each slide
- Add visual descriptions for AI image generation
- Use web search to enhance with current data when helpful

Output format for presentations:
<TITLE>Presentation Title</TITLE>

# Slide 1: Title
- Point 1
- Point 2
...

Guidelines:
- Be concise but comprehensive
- Focus on clarity and visual appeal
- Suggest diverse slide layouts
- Include detailed image descriptions (10+ words each)`;
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
