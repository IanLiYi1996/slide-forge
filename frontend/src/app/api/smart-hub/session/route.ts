import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import {
  createHubSession,
  getUserHubSessions,
} from '@/services/s3/hub-session-service';
import { type ProcessingMode, type InputMetadata } from '@/types/smart-hub';

// GET /api/smart-hub/session - List user's hub sessions
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional mode filter
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') as ProcessingMode | null;

    const sessions = await getUserHubSessions(session.user.id, mode || undefined);

    // Return simplified session list for the landing page
    const simplifiedSessions = sessions.map(s => ({
      sessionId: s.sessionId,
      title: s.title,
      mode: s.mode,
      status: s.status,
      pageCount: s.pages.length,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }));

    return NextResponse.json({ sessions: simplifiedSessions });
  } catch (error) {
    console.error('Error listing hub sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

// POST /api/smart-hub/session - Create new hub session
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { mode, title, inputMetadata, inputText } = body as {
      mode: ProcessingMode;
      title?: string;
      inputMetadata?: InputMetadata;
      inputText?: string;
    };

    if (!mode || !['generate', 'process', 'extract'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid processing mode' },
        { status: 400 }
      );
    }

    const hubSession = await createHubSession({
      userId: session.user.id,
      mode,
      title,
      inputMetadata,
      inputText,
    });

    return NextResponse.json({ session: hubSession }, { status: 201 });
  } catch (error) {
    console.error('Error creating hub session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
