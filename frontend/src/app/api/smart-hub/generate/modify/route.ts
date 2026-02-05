import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { streamText } from 'ai';
import { modelPicker } from '@/lib/model-picker';
import {
  getHubSessionByUserId,
  updatePageInSession,
} from '@/services/s3/hub-session-service';
import { YunwuService } from '@/lib/image-generation/yunwu-api-service';
import { ZImageTurboService } from '@/lib/image-generation/z-image-turbo-api';
import { type IImageGeneratorService } from '@/lib/image-generation/image-generator-service';
import { type ImageConversationTurn, type AspectRatio, type ImageSize, type ImageGenerationProvider } from '@/types/smart-hub';
import { env } from '@/env';

// Helper to get the appropriate image service based on config
function getImageService(provider?: ImageGenerationProvider): IImageGeneratorService {
  // If z-image-turbo is requested and DASHSCOPE_API_KEY is available
  if (provider === 'z-image-turbo' && env.DASHSCOPE_API_KEY) {
    console.log('[modify] Using Z-Image-Turbo service');
    return new ZImageTurboService();
  }
  // Default to Yunwu
  console.log('[modify] Using Yunwu service');
  return new YunwuService();
}

export const maxDuration = 120; // 2 minutes

/**
 * POST /api/smart-hub/generate/modify
 * Modify an existing slide based on user feedback using conversation history
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, pageIndex, modification, regenerate = false } = body as {
      sessionId: string;
      pageIndex: number;
      modification: string;
      regenerate?: boolean;
    };

    if (!sessionId || pageIndex === undefined || !modification) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, pageIndex, modification' },
        { status: 400 }
      );
    }

    // Verify session ownership
    const hubSession = await getHubSessionByUserId(sessionId, session.user.id);
    if (!hubSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const page = hubSession.pages[pageIndex];
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Update page status to processing
    await updatePageInSession(sessionId, session.user.id, pageIndex, {
      status: 'processing',
    });

    // Get conversation history
    const conversationHistory: ImageConversationTurn[] = page.conversationHistory || [];

    // Add user's modification request to conversation
    conversationHistory.push({
      role: 'user',
      parts: [{ text: modification }],
    });

    // Get config from session
    const config = hubSession.generateConfig;
    const aspectRatio: AspectRatio = config?.aspectRatio || '16:9';
    const imageSize: ImageSize = config?.imageSize || '2K';

    // Build the modification prompt
    const originalContent = page.textContent || hubSession.outline?.[pageIndex] || '';
    const modificationPrompt = buildModificationPrompt(
      originalContent,
      modification,
      pageIndex,
      config
    );

    // Get the image generator service based on config
    const imageService = getImageService(config?.imageProvider);

    // Generate modified slide
    const result = await imageService.generateImage({
      prompt: modificationPrompt,
      modificationPrompt: modification,
      aspectRatio,
      imageSize,
      conversationHistory: regenerate ? [] : conversationHistory,
    });

    if (!result.success || !result.imageUrl) {
      // Revert status on failure
      await updatePageInSession(sessionId, session.user.id, pageIndex, {
        status: page.outputImageUrl ? 'ready' : 'error',
        errorMessage: result.error || 'Failed to modify slide',
      });

      return NextResponse.json(
        { error: result.error || 'Failed to modify slide' },
        { status: 500 }
      );
    }

    // Add assistant response to conversation
    conversationHistory.push({
      role: 'assistant',
      parts: [
        { text: `Modified slide based on your request: "${modification}"` },
        {
          inlineData: {
            mimeType: 'image/png',
            url: result.imageUrl,
          },
        },
      ],
    });

    // Update page with modified image
    const updatedSession = await updatePageInSession(
      sessionId,
      session.user.id,
      pageIndex,
      {
        status: 'ready',
        outputImageUrl: result.imageUrl,
        conversationHistory: result.conversationHistory || conversationHistory,
        modificationCount: (page.modificationCount || 0) + 1,
      }
    );

    return NextResponse.json({
      success: true,
      page: updatedSession?.pages[pageIndex],
      session: updatedSession,
      modificationCount: (page.modificationCount || 0) + 1,
    });
  } catch (error) {
    console.error('Error modifying slide:', error);
    return NextResponse.json(
      { error: 'Failed to modify slide' },
      { status: 500 }
    );
  }
}

/**
 * Build the modification prompt for the AI
 */
function buildModificationPrompt(
  originalContent: string,
  modification: string,
  slideIndex: number,
  config?: {
    language?: string;
    tone?: string;
    style?: string;
    theme?: string;
    aspectRatio?: string;
    customStylePrompt?: string;
  }
): string {
  const language = config?.language || 'en-US';
  const tone = config?.tone || 'professional';
  const style = config?.style || 'professional';
  const theme = config?.theme || 'default';
  const aspectRatio = config?.aspectRatio || '16:9';
  const customStylePrompt = config?.customStylePrompt;

  const isFirstSlide = slideIndex === 0;
  const slideType = isFirstSlide ? 'title slide' : 'content slide';

  // If custom style is provided, include it in the prompt
  const styleSection = customStylePrompt && customStylePrompt.trim()
    ? `**CUSTOM STYLE:**
${customStylePrompt}

Apply this custom style consistently.`
    : `- Style: ${style}
- Theme: ${theme}`;

  return `Modify an existing presentation slide based on user feedback.

ORIGINAL SLIDE CONTENT:
${originalContent}

USER MODIFICATION REQUEST:
${modification}

SLIDE INFO:
- Type: ${slideType} (Slide ${slideIndex + 1})
${styleSection}
- Tone: ${tone}
- Aspect Ratio: ${aspectRatio}
- Language: ${language.includes('zh') ? 'Chinese' : language.includes('ja') ? 'Japanese' : 'English'}

INSTRUCTIONS:
1. Keep the overall structure and visual style of the slide
2. Apply the user's requested changes precisely
3. Maintain visual consistency with the existing design
4. Ensure text remains readable with good contrast
5. Preserve any existing design elements unless specifically asked to change them

Generate the modified slide image:`;
}

/**
 * GET /api/smart-hub/generate/modify
 * Get modification history for a slide
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const pageIndex = searchParams.get('pageIndex');

    if (!sessionId || pageIndex === null) {
      return NextResponse.json(
        { error: 'Missing sessionId or pageIndex' },
        { status: 400 }
      );
    }

    const hubSession = await getHubSessionByUserId(sessionId, session.user.id);
    if (!hubSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const page = hubSession.pages[parseInt(pageIndex)];
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({
      conversationHistory: page.conversationHistory || [],
      modificationCount: page.modificationCount || 0,
    });
  } catch (error) {
    console.error('Error getting modification history:', error);
    return NextResponse.json(
      { error: 'Failed to get modification history' },
      { status: 500 }
    );
  }
}
