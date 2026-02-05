/**
 * Agent Chat API
 * Handles user messages and generates responses using Claude Agent
 * Supports streaming responses (Server-Sent Events)
 *
 * Architecture:
 * - If AGENTCORE_RUNTIME_URL is configured: Forwards to AgentCore Runtime backend
 * - Otherwise: Falls back to local Agent SDK (legacy mode)
 *
 * The frontend remains a thin proxy that:
 * 1. Authenticates the user
 * 2. Manages session metadata in S3
 * 3. Forwards requests to AgentCore
 * 4. Detects slides in streaming responses and emits slide_complete events
 *
 * Reference: claude-agent-sdk-demos/simple-chatapp
 */

import { auth } from "@/server/auth";
import { sessionManager } from "@/lib/agent/session-manager";
import { NextResponse } from "next/server";
import { type ChatRequest, type Message } from "@/lib/agent/types";
import { extractSlidesFromMessages } from "@/lib/agent/utils/extract-slides";
import { createAgentCoreClient } from "@/lib/agent/agentcore-client";
import { env } from "@/env";

// Configure route timeout for long-running agent operations
export const maxDuration = 180; // 3 minutes (matches CloudFront timeout)

/**
 * Check if AgentCore backend is available
 */
function isAgentCoreEnabled(): boolean {
  return !!env.AGENTCORE_RUNTIME_URL;
}

/**
 * Handle chat request using AgentCore Runtime backend
 */
async function handleAgentCoreChat(
  _req: Request,
  userId: string,
  chatRequest: ChatRequest,
  accessToken: string | undefined
): Promise<Response> {
  const { message, sessionId, files, enableWebSearch = true } = chatRequest;

  // Check for valid token
  if (!accessToken) {
    throw new Error("No authentication token available. Please sign in again.");
  }

  // Get or create session in S3 (metadata storage)
  let dbSession = await sessionManager.getSession(sessionId, userId);

  if (!dbSession) {
    console.log(
      `[Agent Chat] Session ${sessionId} not found, creating new session`
    );
    dbSession = await sessionManager.createSessionWithId(
      sessionId,
      userId,
      "New Agent Session"
    );
  }

  // Construct full message with file contents
  let fullMessage = message;
  if (files && files.length > 0) {
    const filesText = files
      .map((f) => `File: ${f.name}\nContent:\n${f.content}`)
      .join("\n\n");
    fullMessage += `\n\nUploaded files:\n${filesText}`;
  }

  // Get existing messages for later saving
  const sessionMessages = (
    Array.isArray(dbSession.messages) ? dbSession.messages : []
  ) as unknown as Message[];

  // Create AgentCore client with JWT token provider
  const agentCoreClient = createAgentCoreClient(async () => accessToken);

  if (!agentCoreClient) {
    throw new Error("AgentCore client not configured");
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = "";
      let heartbeatInterval: NodeJS.Timeout | null = null;

      // Helper to send SSE messages
      const sendSSE = (type: string, data: Record<string, unknown>) => {
        try {
          const message = JSON.stringify({ type, ...data });
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch (err) {
          console.error("[Agent Chat] Failed to send SSE:", err);
          throw err;
        }
      };

      try {
        // Step 1: Send connecting status
        sendSSE("status", {
          status: "connecting",
          message: "Establishing connection...",
        });

        // Step 2: Start heartbeat
        heartbeatInterval = setInterval(() => {
          try {
            sendSSE("heartbeat", { timestamp: Date.now() });
          } catch {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        }, 15000);

        // Step 3: Create or resume AgentCore session
        sendSSE("status", {
          status: "initializing_agent",
          message: "Preparing AI agent...",
        });

        // Get or create AgentCore session
        // Use the database session's sdkSessionId if available for resume
        const sdkSessionId = dbSession.sdkSessionId;
        const agentCoreSession = await agentCoreClient.createSession({
          user_id: userId,
          resume_session_id: sdkSessionId || undefined,
        });

        console.log(
          `[Agent Chat] Using AgentCore session: ${agentCoreSession.session_id} for db session: ${sessionId}`
        );

        // Update the database session with the AgentCore session ID if new
        if (!sdkSessionId || sdkSessionId !== agentCoreSession.session_id) {
          await sessionManager.updateSession(sessionId, userId, {
            sdkSessionId: agentCoreSession.session_id,
          });
        }

        // Step 4: Send ready status
        sendSSE("status", {
          status: "ready",
          message: "Agent ready, processing your request...",
        });

        // Step 5: Stream message through AgentCore
        // Slide detection buffer
        let slideBuffer = "";
        const detectedSlides = new Map<
          number,
          { index: number; html: string }
        >();

        /**
         * Process incoming text for slide detection
         * Uses emoji markers to detect complete slides
         */
        const processTextForSlides = (text: string) => {
          slideBuffer += text;

          const slideRegex =
            /🎯SLIDE_START:(\d+)🎯([\s\S]*?)🎯SLIDE_END:\1🎯/g;
          const matches: Array<{
            slideIndex: number;
            slideContent: string;
            matchEnd: number;
          }> = [];
          let match;

          while ((match = slideRegex.exec(slideBuffer)) !== null) {
            matches.push({
              slideIndex: parseInt(match[1]!, 10),
              slideContent: match[2]!,
              matchEnd: match.index + match[0].length,
            });
          }

          // Process matched slides
          for (const matchData of matches) {
            const htmlMatch = matchData.slideContent.match(
              /```html-slide\s*([\s\S]*?)\s*```/
            );
            if (htmlMatch?.[1]) {
              const slideHTML = htmlMatch[1].trim();

              detectedSlides.set(matchData.slideIndex, {
                index: matchData.slideIndex,
                html: slideHTML,
              });

              // Emit slide_complete event
              sendSSE("slide_complete", {
                slideIndex: matchData.slideIndex,
                html: slideHTML,
                timestamp: Date.now(),
              });

              console.log(
                `[Agent Chat] Slide ${matchData.slideIndex} streamed successfully`
              );
            }
          }

          // Clear processed content from buffer
          if (matches.length > 0) {
            const lastMatchEnd = matches[matches.length - 1]!.matchEnd;
            slideBuffer = slideBuffer.substring(lastMatchEnd);
            console.log(
              `[Agent Chat] Processed ${matches.length} slides, buffer remaining: ${slideBuffer.length} chars`
            );
          }
        };

        // Stream the message
        for await (const event of agentCoreClient.sendMessageStream(
          agentCoreSession.session_id,
          {
            message: fullMessage,
            enable_web_search: enableWebSearch,
          }
        )) {
          // Handle different event types
          switch (event.type) {
            case "text":
              if (event.content) {
                fullResponse += event.content;
                processTextForSlides(event.content);

                // Forward text to client
                sendSSE("assistant_message", {
                  content: event.content,
                });
              }
              break;

            case "tool_use":
              sendSSE("tool_use", {
                toolName: event.tool_name,
                toolInput: event.tool_input,
              });
              break;

            case "slide_complete":
              // AgentCore already detected a slide - forward and track it
              if (
                event.slide_index !== undefined &&
                event.html
              ) {
                detectedSlides.set(event.slide_index, {
                  index: event.slide_index,
                  html: event.html,
                });

                sendSSE("slide_complete", {
                  slideIndex: event.slide_index,
                  html: event.html,
                  timestamp: event.timestamp || Date.now(),
                });
              }
              break;

            case "result":
              sendSSE("result", {
                success: true,
                cost_usd: event.cost_usd,
                num_turns: event.num_turns,
              });
              break;

            case "done":
              // Stream complete - close connection
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              if (heartbeatInterval) clearInterval(heartbeatInterval);
              controller.close();

              console.log(
                `[Agent Chat] SSE stream closed for session ${sessionId}`
              );

              // Background: Save messages and slides to database
              const updatedMessages: Message[] = [
                ...sessionMessages,
                { role: "user" as const, content: message, timestamp: new Date() },
                {
                  role: "assistant" as const,
                  content: fullResponse,
                  timestamp: new Date(),
                },
              ];

              // Async save (don't block stream close)
              Promise.race([
                (async () => {
                  try {
                    const updatedSession = await sessionManager.updateMessages(
                      sessionId,
                      userId,
                      updatedMessages
                    );

                    // Sync detected slides to database
                    if (detectedSlides.size > 0 && updatedSession) {
                      const existingSlides =
                        (updatedSession.slides as unknown[]) || [];
                      const existingSlidesMap = new Map<number, unknown>();

                      if (Array.isArray(existingSlides)) {
                        existingSlides.forEach((slide: unknown) => {
                          const s = slide as { index?: number };
                          if (s && typeof s.index === "number") {
                            existingSlidesMap.set(s.index, slide);
                          }
                        });
                      }

                      // Merge new slides
                      detectedSlides.forEach((data, index) => {
                        const existingSlide = existingSlidesMap.get(index) as
                          | {
                              outlineContent?: string;
                              modificationCount?: number;
                              conversationHistory?: unknown[];
                            }
                          | undefined;
                        existingSlidesMap.set(index, {
                          id: `slide-${index}`,
                          index,
                          html: data.html,
                          status: "ready" as const,
                          outlineContent:
                            existingSlide?.outlineContent || `Slide ${index + 1}`,
                          modificationCount:
                            (existingSlide?.modificationCount || 0) +
                            (existingSlide ? 1 : 0),
                          conversationHistory:
                            existingSlide?.conversationHistory || [],
                        });
                      });

                      const mergedSlidesArray = Array.from(
                        existingSlidesMap.values()
                      ).sort((a, b) => {
                        const aIdx = (a as { index: number }).index;
                        const bIdx = (b as { index: number }).index;
                        return aIdx - bIdx;
                      });

                      const existingWorkflowState =
                        updatedSession.workflowState as Record<string, unknown>;
                      const updatedWorkflowState = {
                        ...existingWorkflowState,
                        slides: mergedSlidesArray,
                        currentSlideIndex: mergedSlidesArray.length - 1,
                        totalSlides: mergedSlidesArray.length,
                        lastModifiedAt: new Date(),
                      };

                      await sessionManager.updateSession(sessionId, userId, {
                        slides: mergedSlidesArray as unknown,
                        workflowState: updatedWorkflowState as unknown,
                      });

                      console.log(
                        `[Agent Chat] Synced ${mergedSlidesArray.length} slides to database (${detectedSlides.size} new/updated)`
                      );
                    } else if (updatedSession) {
                      // Fallback: extract slides from messages
                      const extractedSlides =
                        extractSlidesFromMessages(updatedMessages);
                      if (extractedSlides.length > 0) {
                        const existingWorkflowState =
                          updatedSession.workflowState as Record<string, unknown>;
                        const updatedWorkflowState = {
                          ...existingWorkflowState,
                          slides: extractedSlides,
                          currentSlideIndex: extractedSlides.length - 1,
                          totalSlides: extractedSlides.length,
                          lastModifiedAt: new Date(),
                        };

                        await sessionManager.updateSession(sessionId, userId, {
                          slides: extractedSlides as unknown,
                          workflowState: updatedWorkflowState as unknown,
                        });

                        console.log(
                          `[Agent Chat] Synced ${extractedSlides.length} slides using message extraction`
                        );
                      }
                    }
                  } catch (syncError) {
                    console.error(
                      `[Agent Chat] Background sync failed:`,
                      syncError
                    );
                  }
                })(),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Database sync timeout")),
                    10000
                  )
                ),
              ]).catch((timeoutError) => {
                console.error(
                  `[Agent Chat] Database sync timeout or failed:`,
                  timeoutError
                );
              });

              return; // Exit the stream processing

            case "error":
              sendSSE("error", {
                content: event.error || "Unknown error",
              });
              if (heartbeatInterval) clearInterval(heartbeatInterval);
              controller.close();
              return;

            case "status":
              sendSSE("status", {
                status: event.status,
                message: event.message,
              });
              break;

            default:
              // Forward unknown events as-is
              sendSSE(event.type, event as unknown as Record<string, unknown>);
          }
        }

        // If stream ends without done event
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        controller.close();
      } catch (error) {
        console.error("[Agent Chat] Error in AgentCore stream:", error);
        sendSSE("error", {
          content:
            error instanceof Error ? error.message : "Failed to process request",
        });

        if (heartbeatInterval) clearInterval(heartbeatInterval);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Handle chat request using local Agent SDK (legacy fallback)
 */
async function handleLocalAgentChat(
  _req: Request,
  userId: string,
  chatRequest: ChatRequest
): Promise<Response> {
  // Import legacy dependencies only when needed
  const { agentService } = await import("@/lib/agent/agent-service");

  const { message, sessionId, files, enableWebSearch = true } = chatRequest;

  // Get or create session
  let dbSession = await sessionManager.getSession(sessionId, userId);

  if (!dbSession) {
    console.log(
      `[Agent Chat] Session ${sessionId} not found, creating new session`
    );
    dbSession = await sessionManager.createSessionWithId(
      sessionId,
      userId,
      "New Agent Session"
    );
  }

  // Construct full message with file contents
  let fullMessage = message;
  if (files && files.length > 0) {
    const filesText = files
      .map((f) => `File: ${f.name}\nContent:\n${f.content}`)
      .join("\n\n");
    fullMessage += `\n\nUploaded files:\n${filesText}`;
  }

  // Prepare session data and config
  const sessionMessages = (
    Array.isArray(dbSession.messages) ? dbSession.messages : []
  ) as unknown as Message[];

  // Configure agent tools based on enableWebSearch
  const agentConfig = {
    allowedTools: enableWebSearch
      ? ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]
      : ["Read", "Glob", "Grep"],
  };

  // Create SSE stream (legacy implementation)
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = "";
      let heartbeatInterval: NodeJS.Timeout | null = null;

      const sendSSE = (type: string, data: Record<string, unknown>) => {
        try {
          const message = JSON.stringify({ type, ...data });
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch (err) {
          console.error("[Agent Chat] Failed to send SSE:", err);
          throw err;
        }
      };

      try {
        sendSSE("status", {
          status: "connecting",
          message: "Establishing connection...",
        });

        heartbeatInterval = setInterval(() => {
          try {
            sendSSE("heartbeat", { timestamp: Date.now() });
          } catch {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        }, 15000);

        sendSSE("status", {
          status: "initializing_agent",
          message: "Preparing AI agent...",
        });

        const agentSession = await agentService.getOrCreateSession(
          sessionId,
          agentConfig
        );

        console.log(
          `[Agent Chat] Using local agent session for database sessionId: ${sessionId}, SDK sessionId: ${agentSession.sdkSessionId || "new"}`
        );

        sendSSE("status", {
          status: "ready",
          message: "Agent ready, processing your request...",
        });

        // Slide detection buffer
        let slideBuffer = "";
        const detectedSlides = new Map<
          number,
          { index: number; html: string }
        >();

        const listener = (chunk: {
          type: string;
          message?: { content: string | Array<{ type: string; text?: string; name?: string; input?: unknown }> };
          subtype?: string;
          error?: string;
        }) => {
          try {
            if (chunk.type === "assistant") {
              const content = chunk.message?.content;

              if (typeof content === "string") {
                fullResponse += content;
                slideBuffer += content;

                // Slide detection
                const slideRegex =
                  /🎯SLIDE_START:(\d+)🎯([\s\S]*?)🎯SLIDE_END:\1🎯/g;
                const matches: Array<{
                  slideIndex: number;
                  slideContent: string;
                  matchEnd: number;
                }> = [];
                let match;

                while ((match = slideRegex.exec(slideBuffer)) !== null) {
                  matches.push({
                    slideIndex: parseInt(match[1]!, 10),
                    slideContent: match[2]!,
                    matchEnd: match.index + match[0].length,
                  });
                }

                for (const matchData of matches) {
                  const htmlMatch = matchData.slideContent.match(
                    /```html-slide\s*([\s\S]*?)\s*```/
                  );
                  if (htmlMatch?.[1]) {
                    const slideHTML = htmlMatch[1].trim();

                    detectedSlides.set(matchData.slideIndex, {
                      index: matchData.slideIndex,
                      html: slideHTML,
                    });

                    sendSSE("slide_complete", {
                      slideIndex: matchData.slideIndex,
                      html: slideHTML,
                      timestamp: Date.now(),
                    });

                    console.log(
                      `[Agent Chat] Slide ${matchData.slideIndex} streamed successfully`
                    );
                  }
                }

                if (matches.length > 0) {
                  const lastMatchEnd = matches[matches.length - 1]!.matchEnd;
                  slideBuffer = slideBuffer.substring(lastMatchEnd);
                }

                sendSSE("assistant_message", { content });
              } else if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "text" && block.text) {
                    fullResponse += block.text;
                    slideBuffer += block.text;

                    // Same slide detection logic
                    const slideRegex =
                      /🎯SLIDE_START:(\d+)🎯([\s\S]*?)🎯SLIDE_END:\1🎯/g;
                    const matches: Array<{
                      slideIndex: number;
                      slideContent: string;
                      matchEnd: number;
                    }> = [];
                    let match;

                    while ((match = slideRegex.exec(slideBuffer)) !== null) {
                      matches.push({
                        slideIndex: parseInt(match[1]!, 10),
                        slideContent: match[2]!,
                        matchEnd: match.index + match[0].length,
                      });
                    }

                    for (const matchData of matches) {
                      const htmlMatch = matchData.slideContent.match(
                        /```html-slide\s*([\s\S]*?)\s*```/
                      );
                      if (htmlMatch?.[1]) {
                        const slideHTML = htmlMatch[1].trim();

                        detectedSlides.set(matchData.slideIndex, {
                          index: matchData.slideIndex,
                          html: slideHTML,
                        });

                        sendSSE("slide_complete", {
                          slideIndex: matchData.slideIndex,
                          html: slideHTML,
                          timestamp: Date.now(),
                        });
                      }
                    }

                    if (matches.length > 0) {
                      const lastMatchEnd = matches[matches.length - 1]!.matchEnd;
                      slideBuffer = slideBuffer.substring(lastMatchEnd);
                    }

                    sendSSE("assistant_message", { content: block.text });
                  } else if (block.type === "tool_use") {
                    sendSSE("tool_use", {
                      toolName: block.name,
                      toolInput: block.input,
                    });
                  }
                }
              }
            } else if (chunk.type === "result") {
              sendSSE("result", {
                success: chunk.subtype === "success",
              });

              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              agentSession.removeListener(listener);
              if (heartbeatInterval) clearInterval(heartbeatInterval);
              controller.close();

              console.log(
                `[Agent Chat] SSE stream closed for session ${sessionId}`
              );

              // Background save
              const updatedMessages: Message[] = [
                ...sessionMessages,
                { role: "user" as const, content: message, timestamp: new Date() },
                {
                  role: "assistant" as const,
                  content: fullResponse,
                  timestamp: new Date(),
                },
              ];

              Promise.race([
                (async () => {
                  try {
                    const updatedSession = await sessionManager.updateMessages(
                      sessionId,
                      userId,
                      updatedMessages
                    );

                    if (detectedSlides.size > 0 && updatedSession) {
                      const existingSlides =
                        (updatedSession.slides as unknown[]) || [];
                      const existingSlidesMap = new Map<number, unknown>();

                      if (Array.isArray(existingSlides)) {
                        existingSlides.forEach((slide: unknown) => {
                          const s = slide as { index?: number };
                          if (s && typeof s.index === "number") {
                            existingSlidesMap.set(s.index, slide);
                          }
                        });
                      }

                      detectedSlides.forEach((data, index) => {
                        const existingSlide = existingSlidesMap.get(index) as
                          | {
                              outlineContent?: string;
                              modificationCount?: number;
                              conversationHistory?: unknown[];
                            }
                          | undefined;
                        existingSlidesMap.set(index, {
                          id: `slide-${index}`,
                          index,
                          html: data.html,
                          status: "ready" as const,
                          outlineContent:
                            existingSlide?.outlineContent || `Slide ${index + 1}`,
                          modificationCount:
                            (existingSlide?.modificationCount || 0) +
                            (existingSlide ? 1 : 0),
                          conversationHistory:
                            existingSlide?.conversationHistory || [],
                        });
                      });

                      const mergedSlidesArray = Array.from(
                        existingSlidesMap.values()
                      ).sort((a, b) => {
                        const aIdx = (a as { index: number }).index;
                        const bIdx = (b as { index: number }).index;
                        return aIdx - bIdx;
                      });

                      const existingWorkflowState =
                        updatedSession.workflowState as Record<string, unknown>;
                      const updatedWorkflowState = {
                        ...existingWorkflowState,
                        slides: mergedSlidesArray,
                        currentSlideIndex: mergedSlidesArray.length - 1,
                        totalSlides: mergedSlidesArray.length,
                        lastModifiedAt: new Date(),
                      };

                      await sessionManager.updateSession(sessionId, userId, {
                        slides: mergedSlidesArray as unknown,
                        workflowState: updatedWorkflowState as unknown,
                      });

                      console.log(
                        `[Agent Chat] Synced ${mergedSlidesArray.length} slides to database`
                      );
                    } else if (updatedSession) {
                      const extractedSlides =
                        extractSlidesFromMessages(updatedMessages);
                      if (extractedSlides.length > 0) {
                        const existingWorkflowState =
                          updatedSession.workflowState as Record<string, unknown>;
                        const updatedWorkflowState = {
                          ...existingWorkflowState,
                          slides: extractedSlides,
                          currentSlideIndex: extractedSlides.length - 1,
                          totalSlides: extractedSlides.length,
                          lastModifiedAt: new Date(),
                        };

                        await sessionManager.updateSession(sessionId, userId, {
                          slides: extractedSlides as unknown,
                          workflowState: updatedWorkflowState as unknown,
                        });
                      }
                    }
                  } catch (syncError) {
                    console.error(
                      `[Agent Chat] Background sync failed:`,
                      syncError
                    );
                  }
                })(),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Database sync timeout")),
                    10000
                  )
                ),
              ]).catch((timeoutError) => {
                console.error(
                  `[Agent Chat] Database sync timeout:`,
                  timeoutError
                );
              });
            } else if (chunk.type === "error") {
              sendSSE("error", {
                content: chunk.error || "Unknown error",
              });
              agentSession.removeListener(listener);
              if (heartbeatInterval) clearInterval(heartbeatInterval);
              controller.close();
            }
          } catch (error) {
            console.error("Listener error:", error);
          }
        };

        agentSession.addListener(listener);
        agentSession.sendMessage(fullMessage);
      } catch (error) {
        console.error("[Agent Chat] Error in SSE setup:", error);
        sendSSE("error", {
          content:
            error instanceof Error ? error.message : "Failed to initialize agent",
        });

        if (heartbeatInterval) clearInterval(heartbeatInterval);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request
    const chatRequest = (await req.json()) as ChatRequest;
    const { message, sessionId } = chatRequest;

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: message, sessionId" },
        { status: 400 }
      );
    }

    // 3. Route to appropriate handler
    if (isAgentCoreEnabled()) {
      console.log("[Agent Chat] Using AgentCore Runtime backend");

      // Get Cognito access token for AgentCore JWT auth
      // Note: Use accessToken (not idToken) because AgentCore validates client_id claim
      // which is present in access token but not in id token
      const accessToken = session.accessToken;
      if (!accessToken) {
        console.warn("[Agent Chat] No access token available, user may need to re-authenticate");
      }

      return handleAgentCoreChat(req, session.user.id, chatRequest, accessToken);
    } else {
      console.log("[Agent Chat] Using local Agent SDK (legacy mode)");
      return handleLocalAgentChat(req, session.user.id, chatRequest);
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
