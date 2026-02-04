import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import {
  getHubSessionByUserId,
  updatePageInSession,
} from '@/services/s3/hub-session-service';

// POST /api/smart-hub/process - Process an image with AI instruction
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, pageIndex, imageDataUrl, instruction } = body as {
      sessionId: string;
      pageIndex: number;
      imageDataUrl: string;
      instruction: string;
    };

    if (!sessionId || pageIndex === undefined || !imageDataUrl || !instruction) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify session ownership
    const hubSession = await getHubSessionByUserId(sessionId, session.user.id);
    if (!hubSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update page status to processing
    await updatePageInSession(sessionId, session.user.id, pageIndex, {
      status: 'processing',
    });

    // Call the existing document processor API
    const processResponse = await fetch(
      `${process.env.NEXTAUTH_URL || ''}/api/document-processor/process`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          imageDataUrl,
          instruction,
        }),
      }
    );

    if (!processResponse.ok) {
      const error = await processResponse.json();
      await updatePageInSession(sessionId, session.user.id, pageIndex, {
        status: 'error',
        errorMessage: error.message || 'Processing failed',
      });
      return NextResponse.json(
        { error: error.message || 'Processing failed' },
        { status: processResponse.status }
      );
    }

    const result = await processResponse.json();

    // Update page with processed image
    const updatedSession = await updatePageInSession(
      sessionId,
      session.user.id,
      pageIndex,
      {
        status: 'ready',
        outputImageUrl: result.processedImageUrl,
        modificationCount: (hubSession.pages[pageIndex]?.modificationCount || 0) + 1,
      }
    );

    return NextResponse.json({
      success: true,
      processedImageUrl: result.processedImageUrl,
      session: updatedSession,
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    );
  }
}
