import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import {
  createDocProcessorSession,
  getUserDocProcessorSessions,
} from "@/services/s3";
import { nanoid } from "nanoid";

// GET - Fetch all sessions for current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await getUserDocProcessorSessions(session.user.id);

    // Transform to legacy format
    const legacySessions = sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      sessionId: s.sessionId,
      title: s.title,
      fileName: s.fileName,
      fileType: s.fileType,
      totalPages: s.totalPages,
      processedPages: s.processedPages,
      images: s.images,
      processedImages: s.processedImages,
      instructions: s.instructions,
      status: s.status,
      exportedAt: s.exportedAt ? new Date(s.exportedAt) : null,
      exportFormat: s.exportFormat,
      exportCount: s.exportCount,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      lastActivityAt: new Date(s.lastActivityAt),
    }));

    return NextResponse.json({ sessions: legacySessions });
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, fileName, fileType, totalPages, images } = body;

    const sessionId = nanoid();

    const newSession = await createDocProcessorSession({
      userId: session.user.id,
      sessionId,
      title: title || `Document ${fileName || "Processing"}`,
      fileName,
      fileType,
      totalPages: totalPages || 0,
    });

    // Transform to legacy format
    const legacySession = {
      id: newSession.id,
      userId: newSession.userId,
      sessionId: newSession.sessionId,
      title: newSession.title,
      fileName: newSession.fileName,
      fileType: newSession.fileType,
      totalPages: newSession.totalPages,
      processedPages: newSession.processedPages,
      images: newSession.images,
      processedImages: newSession.processedImages,
      instructions: newSession.instructions,
      status: newSession.status,
      exportedAt: newSession.exportedAt ? new Date(newSession.exportedAt) : null,
      exportFormat: newSession.exportFormat,
      exportCount: newSession.exportCount,
      createdAt: new Date(newSession.createdAt),
      updatedAt: new Date(newSession.updatedAt),
      lastActivityAt: new Date(newSession.lastActivityAt),
    };

    return NextResponse.json({ session: legacySession });
  } catch (error) {
    console.error("Error creating document session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
