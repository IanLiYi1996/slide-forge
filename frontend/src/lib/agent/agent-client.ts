/**
 * Agent Client - 客户端 Agent 封装
 * 通过 HTTP API 与服务端 Agent SDK 通信
 * 提供与 agent-service.ts 相同的接口，但在浏览器环境中可用
 */

import type { AgentConfig } from "./types";

/**
 * 客户端 Agent Session 实例
 * 通过 HTTP API 与服务端的 AgentSessionInstance 通信
 */
export class AgentSessionClientInstance {
  public sessionId: string;
  private listeners: Array<(message: any) => void> = [];
  private eventSource: EventSource | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * 发送消息到 Agent
   */
  async sendMessage(content: string) {
    try {
      const response = await fetch("/api/agent/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          message: content,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 设置 EventSource 来接收流式响应
      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 读取流
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              // 广播到所有监听器
              for (const listener of this.listeners) {
                listener(data);
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // 通知所有监听器发生错误
      for (const listener of this.listeners) {
        listener({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  /**
   * 添加消息监听器
   */
  addListener(listener: (message: any) => void) {
    this.listeners.push(listener);
  }

  /**
   * 移除监听器
   */
  removeListener(listener: (message: any) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * 关闭会话
   */
  async close() {
    try {
      await fetch(`/api/agent/${this.sessionId}`, {
        method: "DELETE",
      });

      this.listeners = [];
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    } catch (error) {
      console.error("Error closing session:", error);
    }
  }
}

/**
 * Agent Client Service - 管理所有客户端 Agent 实例
 */
export class AgentClientService {
  private sessions = new Map<string, AgentSessionClientInstance>();

  /**
   * 获取或创建 Agent Session
   */
  async getOrCreateSession(
    sessionId: string,
    config?: AgentConfig
  ): Promise<AgentSessionClientInstance> {
    // 如果 session 已存在，直接返回
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // 检查服务端是否存在该 session
    try {
      const response = await fetch(`/api/agent/${sessionId}`);
      if (response.ok) {
        // Session 存在，创建客户端实例
        const session = new AgentSessionClientInstance(sessionId);
        this.sessions.set(sessionId, session);
        return session;
      }
    } catch (error) {
      // Session 不存在，创建新的
    }

    // 创建新 session
    return this.createNewSession(sessionId, config);
  }

  /**
   * 创建新 Session（强制创建全新实例）
   */
  async createNewSession(
    sessionId: string,
    config?: AgentConfig
  ): Promise<AgentSessionClientInstance> {
    // 如果已存在，先关闭旧的
    if (this.sessions.has(sessionId)) {
      await this.closeSession(sessionId);
    }

    // 调用 API 创建新 session
    const response = await fetch("/api/agent/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    const serverSessionId = data.sessionId;

    // 创建客户端实例
    const session = new AgentSessionClientInstance(serverSessionId);
    this.sessions.set(serverSessionId, session);
    return session;
  }

  /**
   * 获取现有 Session
   */
  getSession(sessionId: string): AgentSessionClientInstance | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 关闭并移除 Session
   */
  async closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.close();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 清理所有 Sessions
   */
  async cleanup() {
    for (const [sessionId] of this.sessions) {
      await this.closeSession(sessionId);
    }
    this.sessions.clear();
  }

  /**
   * 生成演示文稿大纲的专用 prompt
   * (与 agent-service.ts 保持接口一致)
   */
  getOutlineGenerationPrompt(
    topic: string,
    numberOfSlides: number,
    language: string,
    enableWebSearch: boolean
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
   * (与 agent-service.ts 保持接口一致)
   */
  getSlidesGenerationPrompt(
    outline: string[],
    title: string,
    language: string
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
export const agentClientService = new AgentClientService();
