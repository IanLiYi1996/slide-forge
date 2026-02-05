import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import {
  getHubSessionByUserId,
  updatePageInSession,
} from '@/services/s3/hub-session-service';
import { YunwuService } from '@/lib/image-generation/yunwu-api-service';
import type { AspectRatio, ImageSize } from '@/app/_actions/image/generate';

// POST /api/smart-hub/process - Process an image with AI instruction
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, pageIndex, imageDataUrl, instruction, aspectRatio, imageSize } = body as {
      sessionId: string;
      pageIndex: number;
      imageDataUrl: string;
      instruction: string;
      aspectRatio?: string;
      imageSize?: string;
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

    // Call YunwuService directly for image processing
    const yunwuService = new YunwuService();

    // Build the modification prompt that includes the original image reference
    const modificationPrompt = `Based on the attached image, please: ${instruction}

Important: Maintain the overall structure and layout of the original image while applying the requested changes.`;

    // Extract base64 data from data URL
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');

    const result = await yunwuService.generateImage({
      prompt: modificationPrompt,
      modificationPrompt: modificationPrompt,
      aspectRatio: (aspectRatio as AspectRatio) || '16:9',
      imageSize: (imageSize as ImageSize) || '1K',
      conversationHistory: [
        {
          role: 'user',
          parts: [
            { text: 'Here is the image I want to modify:' },
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    if (!result.success || !result.imageUrl) {
      console.error('Yunwu processing error:', result.error);
      await updatePageInSession(sessionId, session.user.id, pageIndex, {
        status: 'error',
        errorMessage: result.error || 'Processing failed',
      });
      return NextResponse.json(
        { error: result.error || 'Processing failed' },
        { status: 500 }
      );
    }

    // Update page with processed image
    const updatedSession = await updatePageInSession(
      sessionId,
      session.user.id,
      pageIndex,
      {
        status: 'ready',
        outputImageUrl: result.imageUrl,
        outputImageUrls: result.imageUrls,
        modificationCount: (hubSession.pages[pageIndex]?.modificationCount || 0) + 1,
      }
    );

    return NextResponse.json({
      success: true,
      processedImageUrl: result.imageUrl,
      imageUrls: result.imageUrls,
      session: updatedSession,
    });
  } catch (error) {
    console.error('Error processing image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
