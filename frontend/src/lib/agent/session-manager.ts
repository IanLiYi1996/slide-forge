/**
 * Agent 会话管理器
 * 负责会话的创建、读取、更新、删除等操作
 * Now backed by S3 storage instead of PostgreSQL
 */

import {
  createAgentSession,
  getAgentSession,
  getAgentSessionByUserId,
  updateAgentSession,
  updateAgentSessionMessages,
  saveAgentSessionOutline,
  saveAgentSessionSlides,
  updateAgentSessionStatus,
  deleteAgentSession,
  getUserAgentSessions,
  cleanupOldAgentSessions,
  type Message,
  type AgentSessionData,
  type SessionStatus,
} from "@/services/s3";
import type { CreateSessionParams, Message as AgentMessage } from "./types";
import { randomUUID } from "node:crypto";

// Convert agent message (with Date timestamp) to S3 message (with string timestamp)
function convertMessagesToS3Format(messages: AgentMessage[]): Message[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp ? msg.timestamp.toISOString() : undefined,
  }));
}

// Transform S3 session data to legacy format for backward compatibility
function transformToLegacyFormat(session: AgentSessionData) {
  return {
    id: session.id,
    userId: session.userId,
    sessionId: session.sessionId,
    sdkSessionId: session.sdkSessionId,
    title: session.title,
    messages: session.messages,
    context: session.context,
    generatedOutline: session.generatedOutline,
    generatedSlides: session.generatedSlides,
    presentationId: session.presentationId,
    status: session.status,
    workflowStage: session.workflowStage,
    workflowState: session.workflowState,
    outline: session.outline,
    outlineTitle: session.outlineTitle,
    slides: session.slides,
    currentSlideIndex: session.currentSlideIndex,
    modificationHistory: session.modificationHistory,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
    lastActivityAt: new Date(session.lastActivityAt),
  };
}

export class SessionManager {
  /**
   * 创建新会话
   */
  async createSession(params: CreateSessionParams) {
    const { userId, title } = params;
    const session = await createAgentSession({
      userId,
      sessionId: randomUUID(),
      title: title || "New Agent Session",
    });
    return transformToLegacyFormat(session);
  }

  /**
   * ✨ 创建新会话（使用自定义 sessionId）
   */
  async createSessionWithId(sessionId: string, userId: string, title?: string) {
    const session = await createAgentSession({
      userId,
      sessionId,
      title: title || "New Agent Session",
    });
    return transformToLegacyFormat(session);
  }

  /**
   * 获取用户的所有会话
   */
  async getUserSessions(userId: string) {
    const sessions = await getUserAgentSessions(userId);
    return sessions.map(transformToLegacyFormat);
  }

  /**
   * 获取单个会话
   */
  async getSession(sessionId: string, userId: string) {
    const session = await getAgentSessionByUserId(sessionId, userId);
    return session ? transformToLegacyFormat(session) : null;
  }

  /**
   * 通过数据库 ID 获取会话
   */
  async getSessionById(id: string, userId: string) {
    // Since we store by sessionId, we need to find by scanning
    // This is inefficient but maintains API compatibility
    const sessions = await getUserAgentSessions(userId);
    const session = sessions.find((s) => s.id === id);
    return session ? transformToLegacyFormat(session) : null;
  }

  /**
   * 更新会话消息
   * Accepts either S3 Message format or Agent Message format (with Date timestamp)
   */
  async updateMessages(sessionId: string, userId: string, messages: AgentMessage[] | Message[]) {
    // Convert to S3 format if needed
    const s3Messages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
        ? msg.timestamp instanceof Date
          ? msg.timestamp.toISOString()
          : msg.timestamp
        : undefined,
    })) as Message[];
    const session = await updateAgentSessionMessages(sessionId, userId, s3Messages);
    return session ? transformToLegacyFormat(session) : null;
  }

  /**
   * 更新会话标题
   */
  async updateTitle(sessionId: string, userId: string, title: string) {
    const session = await updateAgentSession(sessionId, userId, { title });
    return session ? transformToLegacyFormat(session) : null;
  }

  /**
   * 保存生成的大纲
   */
  async saveOutline(sessionId: string, userId: string, outline: string[]) {
    const session = await saveAgentSessionOutline(sessionId, userId, outline);
    return session ? transformToLegacyFormat(session) : null;
  }

  /**
   * 保存生成的幻灯片
   */
  async saveSlides(sessionId: string, userId: string, slides: unknown) {
    const session = await saveAgentSessionSlides(sessionId, userId, slides);
    return session ? transformToLegacyFormat(session) : null;
  }

  /**
   * 更新会话状态
   */
  async updateStatus(
    sessionId: string,
    userId: string,
    status: "active" | "completed" | "archived"
  ) {
    const session = await updateAgentSessionStatus(sessionId, userId, status as SessionStatus);
    return session ? transformToLegacyFormat(session) : null;
  }

  /**
   * 更新会话（通用方法）
   */
  async updateSession(sessionId: string, userId: string, data: Partial<AgentSessionData>) {
    const session = await updateAgentSession(sessionId, userId, data);
    return session ? transformToLegacyFormat(session) : null;
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string, userId: string) {
    const deleted = await deleteAgentSession(sessionId, userId);
    return deleted ? { sessionId } : null;
  }

  /**
   * 清理旧会话（可选）
   * @param daysOld 清理多少天前的会话
   */
  async cleanupOldSessions(daysOld: number = 30) {
    // This would need to iterate through all users
    // For now, this is a placeholder - implement with a separate cleanup job
    console.warn(
      "cleanupOldSessions requires iterating through all users. Consider implementing as a scheduled job."
    );
    return { count: 0 };
  }
}

// 导出单例实例
export const sessionManager = new SessionManager();
