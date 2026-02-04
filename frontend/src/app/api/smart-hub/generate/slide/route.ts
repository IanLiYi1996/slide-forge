import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import {
  getHubSessionByUserId,
  updatePageInSession,
  updateHubSession,
} from '@/services/s3/hub-session-service';
import { YunwuService } from '@/lib/image-generation/yunwu-api-service';
import { ZImageTurboService } from '@/lib/image-generation/z-image-turbo-api';
import { type IImageGeneratorService } from '@/lib/image-generation/image-generator-service';
import { type GenerateConfig, type AspectRatio, type ImageSize, type ImageGenerationProvider } from '@/types/smart-hub';
import { env } from '@/env';

// Helper to get the appropriate image service based on config
function getImageService(provider?: ImageGenerationProvider): IImageGeneratorService {
  // If z-image-turbo is requested and DASHSCOPE_API_KEY is available
  if (provider === 'z-image-turbo' && env.DASHSCOPE_API_KEY) {
    console.log('[slide] Using Z-Image-Turbo service');
    return new ZImageTurboService();
  }
  // Default to Yunwu
  console.log('[slide] Using Yunwu service');
  return new YunwuService();
}

// POST /api/smart-hub/generate/slide - Generate a slide image
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, pageIndex, content, instruction } = body as {
      sessionId: string;
      pageIndex: number;
      content: string;
      instruction?: string;
    };

    if (!sessionId || pageIndex === undefined || !content) {
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

    // Get the image generator service based on config
    const imageService = getImageService(hubSession.generateConfig?.imageProvider);

    // Build the slide generation prompt
    const config = hubSession.generateConfig;
    const prompt = buildSlidePrompt(content, pageIndex, config);

    // Get existing conversation history for this page
    const page = hubSession.pages[pageIndex];
    const conversationHistory = page?.conversationHistory || [];

    // Use config values or defaults
    const aspectRatio: AspectRatio = config?.aspectRatio || '16:9';
    const imageSize: ImageSize = config?.imageSize || '2K';

    // Generate the slide image
    const result = await imageService.generateImage({
      prompt,
      modificationPrompt: instruction,
      aspectRatio,
      imageSize,
      conversationHistory,
    });

    if (!result.success || !result.imageUrl) {
      await updatePageInSession(sessionId, session.user.id, pageIndex, {
        status: 'error',
        errorMessage: result.error || 'Failed to generate slide',
      });
      return NextResponse.json(
        { error: result.error || 'Failed to generate slide' },
        { status: 500 }
      );
    }

    // Update page with generated image
    const updatedSession = await updatePageInSession(
      sessionId,
      session.user.id,
      pageIndex,
      {
        status: 'ready',
        outputImageUrl: result.imageUrl,
        conversationHistory: result.conversationHistory || conversationHistory,
        modificationCount: (page?.modificationCount || 0) + 1,
      }
    );

    // Check if all pages are ready
    const allReady = updatedSession?.pages.every((p) => p.status === 'ready');
    if (allReady && updatedSession) {
      await updateHubSession(sessionId, session.user.id, {
        status: 'completed',
      });
    }

    return NextResponse.json({
      success: true,
      page: updatedSession?.pages[pageIndex],
      session: await getHubSessionByUserId(sessionId, session.user.id),
    });
  } catch (error) {
    console.error('Error generating slide:', error);
    return NextResponse.json(
      { error: 'Failed to generate slide' },
      { status: 500 }
    );
  }
}

function buildSlidePrompt(
  content: string,
  slideIndex: number,
  config?: GenerateConfig
): string {
  const language = config?.language || 'en-US';
  const tone = config?.tone || 'professional';
  const style = config?.style || 'professional';
  const aspectRatio = config?.aspectRatio || '16:9';

  const isFirstSlide = slideIndex === 0;
  const slideType = isFirstSlide ? 'title slide' : 'content slide';

  // Style-specific design instructions
  const styleInstructions: Record<string, string> = {
    professional: 'Clean corporate design with subtle colors, professional fonts, and structured layouts',
    creative: 'Bold vibrant colors, creative layouts, artistic elements, and dynamic compositions',
    minimal: 'Simple clean design with lots of white space, minimal elements, and focused content',
    bold: 'High contrast design, large impactful text, strong visual hierarchy, and eye-catching elements',
  };

  const styleGuide = styleInstructions[style] || styleInstructions.professional;

  return `Create a ${tone} presentation slide image with the following specifications:

SLIDE TYPE: ${slideType} (Slide ${slideIndex + 1})

CONTENT:
${content}

DESIGN STYLE: ${style.toUpperCase()}
${styleGuide}

REQUIREMENTS:
- Design a visually appealing slide with modern aesthetics
- Use a ${tone}, ${style} design approach
- Include relevant icons or graphics that match the ${style} style
- Ensure text is readable with good contrast
- Use the appropriate layout for a ${slideType}
- Language: ${language.includes('zh') ? 'Chinese' : language.includes('ja') ? 'Japanese' : language.includes('ko') ? 'Korean' : 'English'}
- Aspect ratio: ${aspectRatio}

${isFirstSlide ? 'This is the title slide - make it impactful and visually striking with the ' + style + ' aesthetic.' : 'Present the key points clearly with supporting visuals in the ' + style + ' style.'}`;
}
