import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import {
  getDocProcessorSessionByUserId,
  updateDocProcessorSession,
  deleteDocProcessorSession,
} from "@/services/s3";

function transformToLegacyFormat(s: NonNullable<Awaited<ReturnType<typeof getDocProcessorSessionByUserId>>>) {
  return {
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
  };
}

// GET - Fetch single session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const documentSession = await getDocProcessorSessionByUserId(
      sessionId,
      session.user.id
    );

    if (!documentSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: transformToLegacyFormat(documentSession) });
  } catch (error) {
    console.error("Error fetching document session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

// PUT - Update session
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const body = await request.json();
    const {
      title,
      processedPages,
      processedImages,
      instructions,
      status,
    } = body;

    const updatedSession = await updateDocProcessorSession(
      sessionId,
      session.user.id,
      {
        ...(title !== undefined && { title }),
        ...(processedPages !== undefined && { processedPages }),
        ...(processedImages !== undefined && { processedImages }),
        ...(instructions !== undefined && { instructions }),
        ...(status !== undefined && { status }),
      }
    );

    if (!updatedSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: transformToLegacyFormat(updatedSession) });
  } catch (error) {
    console.error("Error updating document session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE - Delete session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const deleted = await deleteDocProcessorSession(sessionId, session.user.id);

    if (!deleted) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
