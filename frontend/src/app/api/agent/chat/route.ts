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
import { sessionPoolManager } from "@/lib/agent/session-pool-manager";
import { NextResponse } from "next/server";
import type { ChatRequest, Message } from "@/lib/agent/types";

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
        let pooledSession: Awaited<ReturnType<typeof sessionPoolManager.acquireSession>> | null = null;

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

          const startTime = Date.now();
          pooledSession = await sessionPoolManager.acquireSession(agentConfig);
          const agentSession = pooledSession.session;
          const acquireTime = Date.now() - startTime;

          console.log(`[Agent Chat] Acquired session ${pooledSession.id} in ${acquireTime}ms`);

          // ✅ 步骤 4: 发送就绪状态
          sendSSE('status', {
            status: 'ready',
            message: 'Agent ready, processing your request...',
            timings: { acquire: acquireTime }
          });

          // ✅ 步骤 5: 设置 Agent 监听器（保持原有逻辑）
          // 创建监听器
          const listener = (chunk: any) => {
            try {
              // 处理不同类型的消息
              if (chunk.type === "assistant") {
                const content = chunk.message?.content;

                if (typeof content === "string") {
                  fullResponse += content;
                  // 发送文本内容
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

                // 保存对话历史到数据库
                sessionManager
                  .updateMessages(sessionId, session.user.id, [
                    ...sessionMessages,
                    { role: "user", content: message, timestamp: new Date() },
                    {
                      role: "assistant",
                      content: fullResponse,
                      timestamp: new Date(),
                    },
                  ])
                  .then(() => {
                    // 发送完成信号
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    // 移除监听器
                    agentSession.removeListener(listener);

                    // ✅ 清理资源
                    if (heartbeatInterval) clearInterval(heartbeatInterval);
                    if (pooledSession) {
                      sessionPoolManager.releaseSession(pooledSession.id);
                      console.log(`[Agent Chat] Released session ${pooledSession.id} back to pool`);
                    }

                    controller.close();
                  })
                  .catch((error) => {
                    console.error("Failed to save messages:", error);

                    // ✅ 即使保存失败也要清理资源
                    if (heartbeatInterval) clearInterval(heartbeatInterval);
                    if (pooledSession) {
                      sessionPoolManager.releaseSession(pooledSession.id);
                    }

                    controller.close();
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
                if (pooledSession) {
                  sessionPoolManager.releaseSession(pooledSession.id);
                }

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
          if (pooledSession) {
            sessionPoolManager.releaseSession(pooledSession.id);
          }

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
