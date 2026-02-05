import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import {
  getHubSessionByUserId,
  updateHubSession,
  deleteHubSession,
} from '@/services/s3/hub-session-service';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// GET /api/smart-hub/session/[sessionId] - Get session details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const hubSession = await getHubSessionByUserId(sessionId, session.user.id);

    if (!hubSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: hubSession });
  } catch (error) {
    console.error('Error getting hub session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// PATCH /api/smart-hub/session/[sessionId] - Update session
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await request.json();

    // Remove fields that shouldn't be updated directly
    const { id, userId, sessionId: _, createdAt, ...updates } = body;

    const updatedSession = await updateHubSession(
      sessionId,
      session.user.id,
      updates
    );

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error('Error updating hub session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE /api/smart-hub/session/[sessionId] - Delete session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const success = await deleteHubSession(sessionId, session.user.id);

    if (!success) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting hub session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
