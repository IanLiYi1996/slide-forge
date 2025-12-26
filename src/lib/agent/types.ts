/**
 * Agent 相关的类型定义
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface AgentConfig {
  allowedTools?: string[];
  systemPrompt?: string;
  maxSteps?: number;
}

export interface AgentSessionData {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  messages: Message[];
  context?: any;
  generatedOutline: string[];
  generatedSlides?: any;
  presentationId?: string;
  status: "active" | "completed" | "archived";
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface CreateSessionParams {
  userId: string;
  title?: string;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  files?: UploadedFile[];
}

export interface UploadedFile {
  name: string;
  content: string;
  type: string;
  size?: number;
}

export interface OutlineGenerationRequest {
  topic: string;
  numberOfSlides: number;
  language: string;
  enableWebSearch?: boolean;
  sessionId: string;
}

export interface SlidesGenerationRequest {
  outline: string[];
  title: string;
  language: string;
  sessionId: string;
}

export interface AgentChunk {
  type: string;
  content?: string;
  toolUse?: any;
  result?: string;
}
