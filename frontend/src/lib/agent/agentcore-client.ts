/**
 * AgentCore Client - Communicates with AgentCore Runtime backend
 *
 * This client handles authentication and communication with the AgentCore
 * Runtime service using Cognito JWT tokens.
 *
 * Key insight: All requests go through the /invocations endpoint with
 * path routing wrapped in the payload. The backend's /invocations handler
 * routes to the appropriate internal endpoint.
 *
 * Features:
 * - Cognito JWT token authentication
 * - Unified /invocations endpoint pattern
 * - Session management (create/resume)
 * - Streaming message responses (SSE)
 */

import { env } from "@/env";

/**
 * Error types for AgentCore client
 */
export class AgentCoreAuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = "AgentCoreAuthError";
  }
}

/**
 * Event types emitted by AgentCore streaming responses
 */
export interface AgentCoreEvent {
  type:
    | "start"
    | "status"
    | "text"
    | "tool_use"
    | "slide_complete"
    | "permission"
    | "result"
    | "done"
    | "error";
  content?: string;
  status?: string;
  message?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  slide_index?: number;
  html?: string;
  timestamp?: number;
  cost_usd?: number;
  num_turns?: number;
  slides_detected?: number;
  error?: string;
  request_id?: string;
  allowed?: boolean;
}

/**
 * Session information returned by AgentCore
 */
export interface AgentCoreSession {
  session_id: string;
  created_at: string;
  status: string;
}

/**
 * Request to create a session
 */
export interface CreateSessionRequest {
  user_id?: string;
  resume_session_id?: string;
  model?: string;
  cwd?: string;
}

/**
 * Request to send a message
 */
export interface SendMessageRequest {
  message: string | Record<string, unknown>;
  model?: string;
  enable_web_search?: boolean;
}

/**
 * Invocation request format for AgentCore
 */
interface InvocationRequest {
  path: string;
  method: "GET" | "POST" | "DELETE" | "PUT";
  payload?: Record<string, unknown>;
  path_params?: Record<string, string>;
  query_params?: Record<string, string>;
}

/**
 * Function type for getting JWT tokens
 */
export type GetTokenFn = () => Promise<string | null>;

/**
 * AgentCore Client for communicating with the AgentCore Runtime backend
 *
 * Uses Cognito JWT tokens for authentication. All requests are routed
 * through the /invocations endpoint with path routing info wrapped in
 * the payload.
 */
export class AgentCoreClient {
  private baseUrl: string;
  private getToken: GetTokenFn;
  private currentSessionId: string | null = null;

  /**
   * Create a new AgentCore client
   *
   * @param baseUrl - Base URL of the AgentCore Runtime (includes /runtimes/{arn})
   * @param getToken - Function to get the Cognito JWT token
   */
  constructor(baseUrl: string, getToken: GetTokenFn) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.getToken = getToken;
  }

  /**
   * Make an authenticated invocation request to AgentCore
   *
   * All requests go through the /invocations endpoint with path routing
   * wrapped in the payload.
   */
  private async invoke(
    request: InvocationRequest,
    sessionId?: string
  ): Promise<Response> {
    const token = await this.getToken();

    if (!token) {
      throw new Error("No authentication token available");
    }

    const url = `${this.baseUrl}/invocations`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Add session ID header if available
    const effectiveSessionId = sessionId || this.currentSessionId;
    if (effectiveSessionId) {
      headers["X-Amzn-Bedrock-AgentCore-Runtime-Session-Id"] = effectiveSessionId;
    }

    console.log("[AgentCoreClient] Invoking:", {
      url,
      request,
      sessionId: effectiveSessionId,
    });

    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });
  }

  /**
   * Create a new session or resume an existing one
   *
   * @param request - Session creation parameters
   * @returns Session information
   */
  async createSession(
    request: CreateSessionRequest = {}
  ): Promise<AgentCoreSession> {
    const invocationRequest: InvocationRequest = {
      path: "/sessions",
      method: "POST",
      payload: request as unknown as Record<string, unknown>,
    };

    const response = await this.invoke(invocationRequest);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new AgentCoreAuthError(
          `Authentication failed: ${response.status} - ${errorText}`,
          response.status
        );
      }
      throw new Error(
        `Failed to create session: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const session = (await response.json()) as AgentCoreSession;

    // Store session ID for subsequent requests
    this.currentSessionId = session.session_id;

    return session;
  }

  /**
   * Send a message to a session (non-streaming)
   *
   * @param sessionId - The session ID
   * @param request - Message request
   * @returns Response from the agent
   */
  async sendMessage(
    sessionId: string,
    request: SendMessageRequest
  ): Promise<{
    messages: Array<{
      type: string;
      content?: string;
      tool_name?: string;
      tool_input?: Record<string, unknown>;
    }>;
    session_id: string;
    cost_usd?: number;
    num_turns?: number;
  }> {
    const invocationRequest: InvocationRequest = {
      path: `/sessions/${sessionId}/messages`,
      method: "POST",
      payload: request as unknown as Record<string, unknown>,
      path_params: { session_id: sessionId },
    };

    const response = await this.invoke(invocationRequest, sessionId);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new AgentCoreAuthError(
          `Authentication failed: ${response.status} - ${errorText}`,
          response.status
        );
      }
      throw new Error(
        `Failed to send message: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Send a message to a session with streaming response (SSE)
   *
   * This method returns an async iterable that yields events as they arrive
   * from the AgentCore backend.
   *
   * @param sessionId - The session ID
   * @param request - Message request
   * @returns Async iterable of events
   */
  async *sendMessageStream(
    sessionId: string,
    request: SendMessageRequest
  ): AsyncIterable<AgentCoreEvent> {
    const token = await this.getToken();

    if (!token) {
      throw new Error("No authentication token available");
    }

    const invocationRequest: InvocationRequest = {
      path: `/sessions/${sessionId}/messages/stream`,
      method: "POST",
      payload: request as unknown as Record<string, unknown>,
      path_params: { session_id: sessionId },
    };

    const url = `${this.baseUrl}/invocations`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
      "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": sessionId,
    };

    console.log("[AgentCoreClient] Streaming invocation:", {
      url,
      request: invocationRequest,
      sessionId,
    });

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(invocationRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new AgentCoreAuthError(
          `Authentication failed: ${response.status} - ${errorText}`,
          response.status
        );
      }
      throw new Error(
        `Failed to stream message: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data && data !== "[DONE]") {
                  try {
                    yield JSON.parse(data) as AgentCoreEvent;
                  } catch (e) {
                    console.error("[AgentCoreClient] Parse error:", e, "Data:", data);
                  }
                }
              }
            }
          }
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data && data !== "[DONE]") {
              try {
                yield JSON.parse(data) as AgentCoreEvent;
              } catch (e) {
                console.error("[AgentCoreClient] Parse error:", e, "Data:", data);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get the status of a session
   *
   * @param sessionId - The session ID
   * @returns Session status including pending permissions
   */
  async getSessionStatus(sessionId: string): Promise<{
    session_id: string;
    status: string;
    pending_permission?: {
      request_id: string;
      tool_name: string;
      tool_input: Record<string, unknown>;
      suggestions: Array<Record<string, unknown>>;
    };
    current_model?: string;
  }> {
    const invocationRequest: InvocationRequest = {
      path: `/sessions/${sessionId}/status`,
      method: "GET",
      path_params: { session_id: sessionId },
    };

    const response = await this.invoke(invocationRequest, sessionId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get session status: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Close a session
   *
   * @param sessionId - The session ID to close
   */
  async closeSession(sessionId: string): Promise<void> {
    const invocationRequest: InvocationRequest = {
      path: `/sessions/${sessionId}`,
      method: "DELETE",
      path_params: { session_id: sessionId },
    };

    const response = await this.invoke(invocationRequest, sessionId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to close session: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }

  /**
   * Interrupt the current operation in a session
   *
   * @param sessionId - The session ID
   */
  async interruptSession(sessionId: string): Promise<void> {
    const invocationRequest: InvocationRequest = {
      path: `/sessions/${sessionId}/interrupt`,
      method: "POST",
      path_params: { session_id: sessionId },
    };

    const response = await this.invoke(invocationRequest, sessionId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to interrupt session: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }

  /**
   * Respond to a permission request
   *
   * @param sessionId - The session ID
   * @param requestId - The permission request ID
   * @param allowed - Whether to allow the operation
   * @param applySuggestions - Whether to apply suggested changes
   */
  async respondToPermission(
    sessionId: string,
    requestId: string,
    allowed: boolean,
    applySuggestions: boolean = false
  ): Promise<void> {
    const invocationRequest: InvocationRequest = {
      path: `/sessions/${sessionId}/permissions/respond`,
      method: "POST",
      payload: {
        request_id: requestId,
        allowed,
        apply_suggestions: applySuggestions,
      },
      path_params: { session_id: sessionId },
    };

    const response = await this.invoke(invocationRequest, sessionId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to respond to permission: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }
}

/**
 * Create an AgentCore client instance with the configured runtime URL
 *
 * @param getToken - Function to get the Cognito JWT token
 * @returns AgentCore client or null if runtime URL is not configured
 */
export function createAgentCoreClient(getToken: GetTokenFn): AgentCoreClient | null {
  const runtimeUrl = env.AGENTCORE_RUNTIME_URL;

  if (!runtimeUrl) {
    console.warn(
      "[AgentCoreClient] AGENTCORE_RUNTIME_URL not configured, AgentCore features disabled"
    );
    return null;
  }

  return new AgentCoreClient(runtimeUrl, getToken);
}
