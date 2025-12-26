/**
 * Agent 会话管理器
 * 负责会话的创建、读取、更新、删除等操作
 */

import { db } from "@/server/db";
import type { Message, CreateSessionParams } from "./types";
import { randomUUID } from "node:crypto";

export class SessionManager {
  /**
   * 创建新会话
   */
  async createSession(params: CreateSessionParams) {
    const { userId, title } = params;
    return await db.agentSession.create({
      data: {
        userId,
        sessionId: randomUUID(),
        title: title || "New Agent Session",
        messages: [],
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * 获取用户的所有会话
   */
  async getUserSessions(userId: string) {
    return await db.agentSession.findMany({
      where: { userId },
      orderBy: { lastActivityAt: "desc" },
    });
  }

  /**
   * 获取单个会话
   */
  async getSession(sessionId: string, userId: string) {
    return await db.agentSession.findFirst({
      where: { sessionId, userId },
    });
  }

  /**
   * 通过数据库 ID 获取会话
   */
  async getSessionById(id: string, userId: string) {
    return await db.agentSession.findFirst({
      where: { id, userId },
    });
  }

  /**
   * 更新会话消息
   */
  async updateMessages(sessionId: string, userId: string, messages: Message[]) {
    return await db.agentSession.update({
      where: { sessionId },
      data: {
        messages: messages as any,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * 更新会话标题
   */
  async updateTitle(sessionId: string, userId: string, title: string) {
    return await db.agentSession.update({
      where: { sessionId },
      data: {
        title,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * 保存生成的大纲
   */
  async saveOutline(sessionId: string, userId: string, outline: string[]) {
    return await db.agentSession.update({
      where: { sessionId },
      data: {
        generatedOutline: outline,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * 保存生成的幻灯片
   */
  async saveSlides(sessionId: string, userId: string, slides: any) {
    return await db.agentSession.update({
      where: { sessionId },
      data: {
        generatedSlides: slides,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * 更新会话状态
   */
  async updateStatus(
    sessionId: string,
    userId: string,
    status: "active" | "completed" | "archived",
  ) {
    return await db.agentSession.update({
      where: { sessionId },
      data: {
        status,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string, userId: string) {
    return await db.agentSession.delete({
      where: { sessionId },
    });
  }

  /**
   * 清理旧会话（可选）
   * @param daysOld 清理多少天前的会话
   */
  async cleanupOldSessions(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await db.agentSession.deleteMany({
      where: {
        status: "archived",
        lastActivityAt: {
          lt: cutoffDate,
        },
      },
    });
  }
}

// 导出单例实例
export const sessionManager = new SessionManager();
