import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { getBedrockClaudeService } from '@/lib/bedrock/bedrock-claude-service';
import {
  getHubSessionByUserId,
  updateHubSession,
  updatePageInSession,
} from '@/services/s3/hub-session-service';

// POST /api/smart-hub/extract - Extract content from images
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, extractAll, pageIndex } = body as {
      sessionId: string;
      extractAll?: boolean;
      pageIndex?: number;
    };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Verify session ownership
    const hubSession = await getHubSessionByUserId(sessionId, session.user.id);
    if (!hubSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update session status
    await updateHubSession(sessionId, session.user.id, {
      status: 'extracting',
    });

    const bedrockService = getBedrockClaudeService();

    if (extractAll) {
      // Extract content from all pages
      for (let i = 0; i < hubSession.pages.length; i++) {
        const page = hubSession.pages[i];
        if (!page || !page.imageDataUrl || page.extractedContent) continue;

        await updatePageInSession(sessionId, session.user.id, i, {
          status: 'processing',
        });

        try {
          const extractedContent = await extractContentFromImage(
            bedrockService,
            page.imageDataUrl
          );

          await updatePageInSession(sessionId, session.user.id, i, {
            status: 'ready',
            extractedContent,
          });
        } catch (error) {
          console.error(`Error extracting page ${i}:`, error);
          await updatePageInSession(sessionId, session.user.id, i, {
            status: 'error',
            errorMessage: 'Extraction failed',
          });
        }
      }
    } else if (pageIndex !== undefined) {
      // Extract content from specific page
      const page = hubSession.pages[pageIndex];
      if (!page || !page.imageDataUrl) {
        return NextResponse.json(
          { error: 'Page not found or has no image' },
          { status: 400 }
        );
      }

      await updatePageInSession(sessionId, session.user.id, pageIndex, {
        status: 'processing',
      });

      const extractedContent = await extractContentFromImage(
        bedrockService,
        page.imageDataUrl
      );

      await updatePageInSession(sessionId, session.user.id, pageIndex, {
        status: 'ready',
        extractedContent,
      });
    }

    // Get updated session
    const updatedSession = await getHubSessionByUserId(sessionId, session.user.id);

    // Check if all pages are extracted
    const allExtracted = updatedSession?.pages.every(
      (p) => p.extractedContent || p.status === 'error'
    );

    if (allExtracted && updatedSession) {
      await updateHubSession(sessionId, session.user.id, {
        status: 'completed',
      });
    }

    return NextResponse.json({
      success: true,
      session: await getHubSessionByUserId(sessionId, session.user.id),
    });
  } catch (error) {
    console.error('Error extracting content:', error);
    return NextResponse.json(
      { error: 'Failed to extract content' },
      { status: 500 }
    );
  }
}

async function extractContentFromImage(
  service: ReturnType<typeof getBedrockClaudeService>,
  imageDataUrl: string
): Promise<string> {
  // Parse base64 image data
  const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match || !base64Match[1] || !base64Match[2]) {
    throw new Error('Invalid image data URL');
  }

  const mimeType = `image/${base64Match[1]}`;
  const imageData = base64Match[2];

  // Use Bedrock Claude to analyze the image and extract content
  const result = await service.analyzeImageForSlides({
    imageData,
    mimeType,
    language: 'auto', // Auto-detect language
    additionalContext: 'Extract all text content from this image. Preserve the structure and formatting as much as possible.',
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to extract content');
  }

  // Return the raw content or combine outline into text
  if (result.content) {
    return result.content;
  }

  if (result.outline && result.outline.length > 0) {
    return result.outline.join('\n\n');
  }

  return result.error || 'No content could be extracted from this image.';
}
