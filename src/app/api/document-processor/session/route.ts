import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { nanoid } from "nanoid";

// GET - Fetch all sessions for current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const sessions = await db.documentProcessorSession.findMany({
      where: { userId: user.id },
      orderBy: { lastActivityAt: "desc" },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error fetching document sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// POST - Create new session
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, fileName, fileType, totalPages, images } = body;

    const sessionId = nanoid();

    const newSession = await db.documentProcessorSession.create({
      data: {
        userId: user.id,
        sessionId,
        title: title || `Document ${fileName || "Processing"}`,
        fileName,
        fileType,
        totalPages: totalPages || 0,
        processedPages: 0,
        images: images || [],
        processedImages: {},
        instructions: {},
        status: "active",
        lastActivityAt: new Date(),
      },
    });

    return NextResponse.json({ session: newSession });
  } catch (error) {
    console.error("Error creating document session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
