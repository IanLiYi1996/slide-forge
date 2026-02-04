import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import {
  getHubSessionByUserId,
  recordExport,
} from '@/services/s3/hub-session-service';
import PptxGenJS from 'pptxgenjs';

// POST /api/smart-hub/export/pptx - Export session as PPTX
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

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

    // Create PPTX presentation
    const pptx = new PptxGenJS();
    pptx.title = hubSession.title;
    pptx.author = 'Smart Document Hub';
    pptx.subject = 'Generated Presentation';
    pptx.layout = 'LAYOUT_16x9';

    // Add slides
    for (const page of hubSession.pages) {
      const slide = pptx.addSlide();

      if (page.outputImageUrl) {
        // Fetch image and convert to base64 if it's a URL
        try {
          const imageData = await fetchImageAsBase64(page.outputImageUrl);
          slide.addImage({
            data: imageData,
            x: 0,
            y: 0,
            w: '100%',
            h: '100%',
            sizing: { type: 'contain', w: '100%', h: '100%' },
          });
        } catch (error) {
          console.error(`Failed to add image for page ${page.index}:`, error);
          // Add placeholder if image fails
          slide.addText(page.textContent || `Slide ${page.index + 1}`, {
            x: '10%',
            y: '40%',
            w: '80%',
            h: '20%',
            fontSize: 24,
            align: 'center',
            valign: 'middle',
          });
        }
      } else if (page.imageDataUrl) {
        // Use data URL directly
        slide.addImage({
          data: page.imageDataUrl,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
          sizing: { type: 'contain', w: '100%', h: '100%' },
        });
      } else if (page.textContent) {
        // Text-only slide
        slide.addText(page.textContent, {
          x: '10%',
          y: '10%',
          w: '80%',
          h: '80%',
          fontSize: 18,
          align: 'left',
          valign: 'top',
          wrap: true,
        });
      }
    }

    // Generate PPTX buffer
    const pptxBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;

    // Record the export
    await recordExport(sessionId, session.user.id, 'pptx');

    // Return as downloadable file
    return new NextResponse(pptxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${hubSession.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting PPTX:', error);
    return NextResponse.json(
      { error: 'Failed to export PPTX' },
      { status: 500 }
    );
  }
}

async function fetchImageAsBase64(url: string): Promise<string> {
  // If already a data URL, return as-is
  if (url.startsWith('data:')) {
    return url;
  }

  // Fetch the image
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/png';

  return `data:${contentType};base64,${base64}`;
}
