/**
 * Agent 对话 API
 * 处理用户消息，使用 Claude Agent SDK 生成响应
 * 支持流式响应（Server-Sent Events）
 *
 * 优化:
 * - 立即建立 SSE 连接（< 1 秒响应）
 * - 使用会话池获取预热的 Agent 实例（< 5 秒就绪）
 * - 发送进度消息和心跳保持连接
 *
 * 参考: claude-agent-sdk-demos/simple-chatapp
 */

import { auth } from "@/server/auth";
import { agentService } from "@/lib/agent/agent-service";
import { sessionManager } from "@/lib/agent/session-manager";
import { NextResponse } from "next/server";
import type { ChatRequest, Message } from "@/lib/agent/types";
import { extractSlidesFromMessages } from "@/lib/agent/utils/extract-slides";

// Configure route timeout for long-running agent operations
export const maxDuration = 180; // 3 minutes (matches CloudFront timeout)

export async function POST(req: Request) {
  try {
    // 1. 验证用户身份
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 解析请求
    const { message, sessionId, files, enableWebSearch = true } = (await req.json()) as ChatRequest;

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: message, sessionId" },
        { status: 400 },
      );
    }

    // 3. 获取会话数据
    const dbSession = await sessionManager.getSession(
      sessionId,
      session.user.id,
    );
    if (!dbSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 4. 构造完整的消息（包含文件内容）
    let fullMessage = message;
    if (files && files.length > 0) {
      const filesText = files
        .map((f) => `File: ${f.name}\nContent:\n${f.content}`)
        .join("\n\n");
      fullMessage += `\n\nUploaded files:\n${filesText}`;
    }

    // 5. 准备会话数据和配置
    const sessionMessages = (Array.isArray(dbSession.messages) ? dbSession.messages : []) as unknown as Message[];
    const isNewSession = sessionMessages.length === 0;

    // 根据 enableWebSearch 配置 Agent 工具
    const agentConfig = {
      allowedTools: enableWebSearch
        ? ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]
        : ["Read", "Glob", "Grep"],  // 禁用搜索时排除 WebSearch 和 WebFetch
    };

    // 6. ✅ 立即建立 SSE 流（核心优化：在 Agent 初始化之前）
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullResponse = "";
        let responseComplete = false;
        let heartbeatInterval: NodeJS.Timeout | null = null;

        // 辅助函数：发送 SSE 消息
        const sendSSE = (type: string, data: any) => {
          try {
            const message = JSON.stringify({ type, ...data });
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch (err) {
            console.error('[Agent Chat] Failed to send SSE:', err);
            // 客户端可能已断开连接
            throw err;
          }
        };

        try {
          // ✅ 步骤 1: 立即发送连接状态（< 1 秒）
          sendSSE('status', {
            status: 'connecting',
            message: 'Establishing connection...'
          });

          // ✅ 步骤 2: 启动心跳机制（每 15 秒）
          heartbeatInterval = setInterval(() => {
            try {
              sendSSE('heartbeat', { timestamp: Date.now() });
            } catch (err) {
              // 客户端断开，清理资源
              if (heartbeatInterval) clearInterval(heartbeatInterval);
            }
          }, 15000);

          // ✅ 步骤 3: 从池中获取 Agent（3-5 秒，后台进行）
          sendSSE('status', {
            status: 'initializing_agent',
            message: 'Preparing AI agent...'
          });

          // ✅ 使用 agentService 按数据库 sessionId 获取或创建 Agent
          // 同一个 sessionId 会复用同一个 Agent instance（保留历史）
          // 不同 sessionId 使用不同 Agent instance（完全隔离）
          // ✅ SDK resume支持：如果数据库中有sdkSessionId，会自动恢复会话
          const agentSession = await agentService.getOrCreateSession(sessionId, agentConfig);

          console.log(`[Agent Chat] Using agent session for database sessionId: ${sessionId}, SDK sessionId: ${agentSession.sdkSessionId || 'new'}`);

          // ✅ 步骤 4: 发送就绪状态
          sendSSE('status', {
            status: 'ready',
            message: 'Agent ready, processing your request...'
          });

          // ✅ 步骤 5: 设置 Agent 监听器（增强幻灯片流式检测）
          // 幻灯片检测buffer
          let slideBuffer = "";

          // 创建监听器
          const listener = (chunk: any) => {
            try {
              // 处理不同类型的消息
              if (chunk.type === "assistant") {
                const content = chunk.message?.content;

                if (typeof content === "string") {
                  fullResponse += content;
                  slideBuffer += content; // 累积到幻灯片buffer

                  // 🎯 检测完整幻灯片（使用 emoji 标记）
                  const slideRegex = /🎯SLIDE_START:(\d+)🎯([\s\S]*?)🎯SLIDE_END:\1🎯/g;
                  const matches: Array<{
                    slideIndex: number;
                    slideContent: string;
                    fullMatch: string;
                    matchEnd: number;
                  }> = [];
                  let match;

                  // ✅ 先收集所有匹配，不修改 buffer
                  while ((match = slideRegex.exec(slideBuffer)) !== null) {
                    matches.push({
                      slideIndex: parseInt(match[1]!),
                      slideContent: match[2]!,
                      fullMatch: match[0],
                      matchEnd: match.index + match[0].length,
                    });
                  }

                  // ✅ 处理所有匹配的幻灯片
                  for (const matchData of matches) {
                    // 从内容中提取 HTML（去除 ```html-slide 标记）
                    const htmlMatch = matchData.slideContent.match(/```html-slide\s*([\s\S]*?)\s*```/);
                    if (htmlMatch && htmlMatch[1]) {
                      const slideHTML = htmlMatch[1].trim();

                      // 📤 立即发送幻灯片完成事件
                      sendSSE('slide_complete', {
                        slideIndex: matchData.slideIndex,
                        html: slideHTML,
                        timestamp: Date.now(),
                      });

                      console.log(`[Agent Chat] Slide ${matchData.slideIndex} streamed successfully`);
                    }
                  }

                  // ✅ 清除所有已处理的幻灯片（从最后一个匹配位置开始保留）
                  if (matches.length > 0) {
                    const lastMatchEnd = matches[matches.length - 1]!.matchEnd;
                    slideBuffer = slideBuffer.substring(lastMatchEnd);
                    console.log(`[Agent Chat] Processed ${matches.length} slides, buffer remaining: ${slideBuffer.length} chars`);
                  }

                  // 发送文本内容（用于对话显示）
                  const data = JSON.stringify({
                    type: "assistant_message",
                    content,
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } else if (Array.isArray(content)) {
                  // 处理结构化内容（text blocks, tool_use）
                  for (const block of content) {
                    if (block.type === "text") {
                      fullResponse += block.text;
                      slideBuffer += block.text; // 累积到幻灯片buffer

                      // 🎯 同样检测幻灯片（使用相同的逻辑）
                      const slideRegex = /🎯SLIDE_START:(\d+)🎯([\s\S]*?)🎯SLIDE_END:\1🎯/g;
                      const matches: Array<{
                        slideIndex: number;
                        slideContent: string;
                        fullMatch: string;
                        matchEnd: number;
                      }> = [];
                      let match;

                      // ✅ 先收集所有匹配
                      while ((match = slideRegex.exec(slideBuffer)) !== null) {
                        matches.push({
                          slideIndex: parseInt(match[1]!),
                          slideContent: match[2]!,
                          fullMatch: match[0],
                          matchEnd: match.index + match[0].length,
                        });
                      }

                      // ✅ 处理所有匹配的幻灯片
                      for (const matchData of matches) {
                        const htmlMatch = matchData.slideContent.match(/```html-slide\s*([\s\S]*?)\s*```/);
                        if (htmlMatch && htmlMatch[1]) {
                          const slideHTML = htmlMatch[1].trim();

                          sendSSE('slide_complete', {
                            slideIndex: matchData.slideIndex,
                            html: slideHTML,
                            timestamp: Date.now(),
                          });

                          console.log(`[Agent Chat] Slide ${matchData.slideIndex} streamed successfully`);
                        }
                      }

                      // ✅ 清除所有已处理的幻灯片
                      if (matches.length > 0) {
                        const lastMatchEnd = matches[matches.length - 1]!.matchEnd;
                        slideBuffer = slideBuffer.substring(lastMatchEnd);
                        console.log(`[Agent Chat] Processed ${matches.length} slides from block, buffer remaining: ${slideBuffer.length} chars`);
                      }

                      const data = JSON.stringify({
                        type: "assistant_message",
                        content: block.text,
                      });
                      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    } else if (block.type === "tool_use") {
                      // 通知前端正在使用工具
                      const data = JSON.stringify({
                        type: "tool_use",
                        toolName: block.name,
                        toolInput: block.input,
                      });
                      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                  }
                }
              } else if (chunk.type === "result") {
                // Query 完成
                const data = JSON.stringify({
                  type: "result",
                  success: chunk.subtype === "success",
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                responseComplete = true;

                // ✅ 步骤1：立即发送 [DONE] 并关闭流（不等待数据库）
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                agentSession.removeListener(listener);
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                controller.close();

                console.log(`[Agent Chat] SSE stream closed for session ${sessionId}`);

                // ✅ 步骤2：数据库同步作为后台任务（不阻塞流）
                const updatedMessages: Message[] = [
                  ...sessionMessages,
                  { role: "user" as const, content: message, timestamp: new Date() },
                  {
                    role: "assistant" as const,
                    content: fullResponse,
                    timestamp: new Date(),
                  },
                ];

                // 异步保存到数据库（带超时和错误处理）
                Promise.race([
                  // 主任务：保存消息和同步幻灯片
                  (async () => {
                    try {
                      // 保存消息
                      const updatedSession = await sessionManager.updateMessages(
                        sessionId,
                        session.user.id,
                        updatedMessages
                      );

                      // 提取并同步幻灯片
                      const extractedSlides = extractSlidesFromMessages(updatedMessages);
                      if (extractedSlides.length > 0) {
                        const existingWorkflowState = updatedSession.workflowState as any;
                        const updatedWorkflowState = {
                          ...existingWorkflowState,
                          slides: extractedSlides,
                          currentSlideIndex: extractedSlides.length - 1,
                          totalSlides: extractedSlides.length,
                          lastModifiedAt: new Date(),
                        };

                        await sessionManager.updateSession(sessionId, session.user.id, {
                          slides: extractedSlides as any,
                          workflowState: updatedWorkflowState as any,
                        });

                        console.log(
                          `[Agent Chat] Synced ${extractedSlides.length} slides to database (background)`
                        );
                      }
                    } catch (syncError) {
                      console.error(`[Agent Chat] Background sync failed:`, syncError);
                      // 不影响用户体验，静默失败
                    }
                  })(),

                  // 超时保护：10秒后放弃
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Database sync timeout")), 10000)
                  ),
                ]).catch((timeoutError) => {
                  console.error(`[Agent Chat] Database sync timeout or failed:`, timeoutError);
                  // 静默失败，不影响用户
                });
              } else if (chunk.type === "error") {
                const errorData = JSON.stringify({
                  type: "error",
                  content: chunk.error || "Unknown error",
                });
                controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                agentSession.removeListener(listener);

                // ✅ 清理资源
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                console.log(`[Agent Chat] Removed listener from session ${sessionId} (agent error)`);

                controller.close();
              }
            } catch (error) {
              console.error("Listener error:", error);
            }
          };

          // ✅ 步骤 6: 添加监听器并发送消息
          agentSession.addListener(listener);
          agentSession.sendMessage(fullMessage);

          // Note: 不在这里清理资源！
          // 资源清理在监听器的 "result" 事件处理中完成
          // 或在 "error" 事件中完成

        } catch (error) {
          // 捕获 SSE 设置或 Agent 获取过程中的错误
          console.error("[Agent Chat] Error in SSE setup:", error);
          sendSSE('error', {
            content: error instanceof Error ? error.message : "Failed to initialize agent",
          });

          // 仅在初始化失败时清理
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          console.log(`[Agent Chat] Initialization failed for session ${sessionId}`);

          controller.close();
        }
      },
    });

    // 7. 返回 SSE 流（优化的 headers）
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // 禁用 nginx/代理缓冲
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
