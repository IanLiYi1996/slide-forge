import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { type InputMetadata, type InputType, type ProcessingMode } from '@/types/smart-hub';

// POST /api/smart-hub/detect - Detect input type and suggest mode
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string | null;

    if (!file && !text) {
      return NextResponse.json(
        { error: 'Either file or text is required' },
        { status: 400 }
      );
    }

    let metadata: InputMetadata;

    if (text && text.trim().length > 0) {
      // Text input detection
      const isMarkdown = checkIfMarkdown(text);
      metadata = {
        type: isMarkdown ? 'markdown' : 'text',
        hasText: true,
        hasImages: false,
        suggestedMode: 'generate',
        confidence: text.length >= 50 ? 0.95 : 0.7,
      };
    } else if (file) {
      // File input detection
      const type = detectFileType(file);
      const pageCount = await estimatePageCount(file);

      const { mode, confidence } = suggestMode(type, pageCount);

      metadata = {
        type,
        fileName: file.name,
        fileSize: file.size,
        pageCount,
        hasText: type !== 'image',
        hasImages: type === 'image' || type === 'pdf',
        suggestedMode: mode,
        confidence,
      };
    } else {
      metadata = {
        type: 'text',
        hasText: false,
        hasImages: false,
        suggestedMode: 'generate',
        confidence: 0.5,
      };
    }

    return NextResponse.json({ metadata });
  } catch (error) {
    console.error('Error detecting input type:', error);
    return NextResponse.json(
      { error: 'Failed to detect input type' },
      { status: 500 }
    );
  }
}

function detectFileType(file: File): InputType {
  const mimeMap: Record<string, InputType> = {
    'application/pdf': 'pdf',
    'image/png': 'image',
    'image/jpeg': 'image',
    'image/jpg': 'image',
    'image/webp': 'image',
    'image/gif': 'image',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/markdown': 'markdown',
    'text/plain': 'text',
  };

  return mimeMap[file.type] || 'text';
}

async function estimatePageCount(file: File): Promise<number> {
  // For PDF, estimate based on file size (rough approximation)
  if (file.type === 'application/pdf') {
    // Average PDF page is ~100-500KB
    const avgPageSizeKB = 200;
    return Math.max(1, Math.ceil(file.size / (avgPageSizeKB * 1024)));
  }

  // Images are single page
  if (file.type.startsWith('image/')) {
    return 1;
  }

  // DOCX - estimate based on size
  if (file.type.includes('wordprocessingml')) {
    const avgPageSizeKB = 50;
    return Math.max(1, Math.ceil(file.size / (avgPageSizeKB * 1024)));
  }

  return 1;
}

function suggestMode(
  type: InputType,
  pageCount: number
): { mode: ProcessingMode; confidence: number } {
  if (type === 'text' || type === 'markdown') {
    return { mode: 'generate', confidence: 0.95 };
  }

  if (type === 'image') {
    return { mode: 'process', confidence: 0.9 };
  }

  if (type === 'pdf') {
    if (pageCount > 10) {
      return { mode: 'extract', confidence: 0.85 };
    }
    return { mode: 'process', confidence: 0.8 };
  }

  if (type === 'docx') {
    return { mode: 'extract', confidence: 0.85 };
  }

  return { mode: 'generate', confidence: 0.5 };
}

function checkIfMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#+\s/m,
    /^\*\s/m,
    /^\d+\.\s/m,
    /\[.+\]\(.+\)/,
    /\*\*.+\*\*/,
    /```[\s\S]*```/,
  ];

  let matches = 0;
  for (const pattern of markdownPatterns) {
    if (pattern.test(text)) matches++;
  }

  return matches >= 2;
}
