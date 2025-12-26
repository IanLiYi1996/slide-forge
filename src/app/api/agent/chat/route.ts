/**
 * Agent 对话 API
 * 处理用户消息，使用 Claude Agent SDK 生成响应
 * 支持流式响应（Server-Sent Events）
 *
 * 参考: claude-agent-sdk-demos/simple-chatapp
 */

import { auth } from "@/server/auth";
import { agentService } from "@/lib/agent/agent-service";
import { sessionManager } from "@/lib/agent/session-manager";
import { NextResponse } from "next/server";
import type { ChatRequest, Message } from "@/lib/agent/types";

export async function POST(req: Request) {
  try {
    // 1. 验证用户身份
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 解析请求
    const { message, sessionId, files } = (await req.json()) as ChatRequest;

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

    // 5. 获取或创建 Agent Session Instance
    const agentSession = agentService.getOrCreateSession(sessionId);

    // 6. 使用 Agent SDK 流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullResponse = "";
        const messages = dbSession.messages as Message[];
        let responseComplete = false;

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
                  ...messages,
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
                  controller.close();
                })
                .catch((error) => {
                  console.error("Failed to save messages:", error);
                  controller.close();
                });
            } else if (chunk.type === "error") {
              const errorData = JSON.stringify({
                type: "error",
                content: chunk.error || "Unknown error",
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              agentSession.removeListener(listener);
              controller.close();
            }
          } catch (error) {
            console.error("Listener error:", error);
          }
        };

        try {
          // 添加监听器
          agentSession.addListener(listener);

          // 发送消息到 Agent
          agentSession.sendMessage(fullMessage);
        } catch (error) {
          console.error("Agent error:", error);
          const errorData = JSON.stringify({
            type: "error",
            content: error instanceof Error ? error.message : "Unknown error",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          agentSession.removeListener(listener);
          controller.close();
        }
      },
    });

    // 7. 返回 SSE 流
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
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
