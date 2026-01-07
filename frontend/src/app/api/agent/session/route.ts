/**
 * Agent 会话 API
 * 处理会话的创建、列表查询等操作
 */

import { auth } from "@/server/auth";
import { sessionManager } from "@/lib/agent/session-manager";
import { NextResponse } from "next/server";

/**
 * GET - 获取用户的所有会话
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await sessionManager.getUserSessions(session.user.id);

    return NextResponse.json({
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch sessions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST - 创建新会话
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title } = body;

    const newSession = await sessionManager.createSession({
      userId: session.user.id,
      title: title || "New Agent Session",
    });

    return NextResponse.json({
      session: newSession,
      message: "Session created successfully",
    });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json(
      {
        error: "Failed to create session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
