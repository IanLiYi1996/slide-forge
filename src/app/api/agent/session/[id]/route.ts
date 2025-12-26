/**
 * Agent 单个会话 API
 * 处理单个会话的获取、更新、删除等操作
 */

import { auth } from "@/server/auth";
import { sessionManager } from "@/lib/agent/session-manager";
import { NextResponse } from "next/server";

/**
 * GET - 获取单个会话详情
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const agentSession = await sessionManager.getSession(id, session.user.id);

    if (!agentSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      session: agentSession,
    });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH - 更新会话信息
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, status } = body;

    // 验证会话存在
    const agentSession = await sessionManager.getSession(id, session.user.id);
    if (!agentSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 更新标题
    if (title) {
      await sessionManager.updateTitle(id, session.user.id, title);
    }

    // 更新状态
    if (status && ["active", "completed", "archived"].includes(status)) {
      await sessionManager.updateStatus(id, session.user.id, status);
    }

    // 获取更新后的会话
    const updatedSession = await sessionManager.getSession(
      id,
      session.user.id,
    );

    return NextResponse.json({
      session: updatedSession,
      message: "Session updated successfully",
    });
  } catch (error) {
    console.error("Update session error:", error);
    return NextResponse.json(
      {
        error: "Failed to update session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE - 删除会话
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 验证会话存在
    const agentSession = await sessionManager.getSession(id, session.user.id);
    if (!agentSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 删除会话
    await sessionManager.deleteSession(id, session.user.id);

    return NextResponse.json({
      message: "Session deleted successfully",
    });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
