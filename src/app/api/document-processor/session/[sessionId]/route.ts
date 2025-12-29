import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

// GET - Fetch single session
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    const documentSession = await db.documentProcessorSession.findFirst({
      where: {
        sessionId: params.sessionId,
        userId: user.id,
      },
    });

    if (!documentSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: documentSession });
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
  { params }: { params: { sessionId: string } }
) {
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
    const {
      title,
      processedPages,
      processedImages,
      instructions,
      status,
    } = body;

    const updatedSession = await db.documentProcessorSession.updateMany({
      where: {
        sessionId: params.sessionId,
        userId: user.id,
      },
      data: {
        ...(title !== undefined && { title }),
        ...(processedPages !== undefined && { processedPages }),
        ...(processedImages !== undefined && { processedImages }),
        ...(instructions !== undefined && { instructions }),
        ...(status !== undefined && { status }),
        lastActivityAt: new Date(),
      },
    });

    if (updatedSession.count === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch updated session
    const documentSession = await db.documentProcessorSession.findFirst({
      where: {
        sessionId: params.sessionId,
        userId: user.id,
      },
    });

    return NextResponse.json({ session: documentSession });
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
  { params }: { params: { sessionId: string } }
) {
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

    const result = await db.documentProcessorSession.deleteMany({
      where: {
        sessionId: params.sessionId,
        userId: user.id,
      },
    });

    if (result.count === 0) {
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
