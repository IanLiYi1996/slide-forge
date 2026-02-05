/**
 * Smart Document Hub - Input Type Detection
 * Analyzes input (file or text) and suggests the best processing mode
 */

import type {
  InputType,
  InputMetadata,
  ProcessingMode,
} from '@/types/smart-hub';

// ==================== Constants ====================

/** Minimum text length to suggest generate mode with high confidence */
const MIN_TEXT_FOR_GENERATE = 50;

/** Page count threshold for suggesting extract mode over process */
const LARGE_DOCUMENT_THRESHOLD = 10;

/** Supported MIME types */
const SUPPORTED_MIME_TYPES: Record<string, InputType> = {
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

/** File extensions to input types */
const EXTENSION_TO_TYPE: Record<string, InputType> = {
  '.pdf': 'pdf',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.docx': 'docx',
  '.md': 'markdown',
  '.txt': 'text',
};

// ==================== Type Detection Functions ====================

/**
 * Detect input type from a file
 */
export function detectFileType(file: File): InputType | null {
  // First try MIME type
  const mimeType = SUPPORTED_MIME_TYPES[file.type];
  if (mimeType) {
    return mimeType;
  }

  // Fall back to extension
  const fileName = file.name.toLowerCase();
  for (const [ext, type] of Object.entries(EXTENSION_TO_TYPE)) {
    if (fileName.endsWith(ext)) {
      return type;
    }
  }

  return null;
}

/**
 * Check if content appears to be markdown
 */
function isMarkdownContent(text: string): boolean {
  const markdownPatterns = [
    /^#+\s/m, // Headers
    /^\*\s/m, // Unordered list
    /^\d+\.\s/m, // Ordered list
    /\[.+\]\(.+\)/, // Links
    /\*\*.+\*\*/, // Bold
    /_.+_/, // Italic
    /```[\s\S]*```/, // Code blocks
  ];

  let matches = 0;
  for (const pattern of markdownPatterns) {
    if (pattern.test(text)) {
      matches++;
    }
  }

  // Consider it markdown if at least 2 patterns match
  return matches >= 2;
}

/**
 * Count approximate PDF pages from file size (rough estimate)
 * Average PDF page is ~100KB for text-heavy, ~500KB for image-heavy
 */
function estimatePdfPages(fileSizeBytes: number): number {
  const avgPageSizeKB = 200; // Conservative average
  return Math.max(1, Math.ceil(fileSizeBytes / (avgPageSizeKB * 1024)));
}

// ==================== Mode Detection ====================

/**
 * Suggest the best processing mode based on input type
 */
function suggestMode(
  type: InputType,
  hasText: boolean,
  _hasImages: boolean, // Reserved for future image-based mode detection
  pageCount: number
): { mode: ProcessingMode; confidence: number } {
  // Text input → Generate mode (create presentations from text)
  if (type === 'text' || type === 'markdown') {
    return {
      mode: 'generate',
      confidence: hasText ? 0.95 : 0.7,
    };
  }

  // Images → Process mode (modify/enhance images)
  if (type === 'image') {
    return {
      mode: 'process',
      confidence: 0.9,
    };
  }

  // PDF handling depends on size and content
  if (type === 'pdf') {
    // Large PDFs → Extract mode (extract content to create new presentations)
    if (pageCount > LARGE_DOCUMENT_THRESHOLD) {
      return {
        mode: 'extract',
        confidence: 0.85,
      };
    }

    // Small PDFs → Process mode (likely modifying existing slides)
    return {
      mode: 'process',
      confidence: 0.8,
    };
  }

  // DOCX → Extract mode (extract content and recreate as slides)
  if (type === 'docx') {
    return {
      mode: 'extract',
      confidence: 0.85,
    };
  }

  // Default to generate mode with low confidence
  return {
    mode: 'generate',
    confidence: 0.5,
  };
}

// ==================== Main Detection Function ====================

/**
 * Analyze input (file or text) and return metadata with suggested mode
 */
export async function detectInputType(
  input: File | string
): Promise<InputMetadata> {
  // Handle text input
  if (typeof input === 'string') {
    const hasContent = input.trim().length > 0;
    const isMarkdown = isMarkdownContent(input);

    return {
      type: isMarkdown ? 'markdown' : 'text',
      hasText: hasContent,
      hasImages: false,
      suggestedMode: 'generate',
      confidence: hasContent && input.length >= MIN_TEXT_FOR_GENERATE ? 0.95 : 0.7,
    };
  }

  // Handle file input
  const file = input;
  const type = detectFileType(file);

  if (!type) {
    // Unsupported file type
    return {
      type: 'text',
      fileName: file.name,
      fileSize: file.size,
      hasText: false,
      hasImages: false,
      suggestedMode: 'generate',
      confidence: 0.3,
    };
  }

  // Determine content characteristics
  let hasText = false;
  let hasImages = false;
  let pageCount = 1;

  switch (type) {
    case 'text':
    case 'markdown':
      hasText = true;
      hasImages = false;
      break;

    case 'image':
      hasText = false;
      hasImages = true;
      break;

    case 'pdf':
      hasText = true;
      hasImages = true;
      pageCount = await countPdfPages(file);
      break;

    case 'docx':
      hasText = true;
      hasImages = true; // DOCX might contain images
      break;
  }

  const { mode, confidence } = suggestMode(type, hasText, hasImages, pageCount);

  return {
    type,
    fileName: file.name,
    fileSize: file.size,
    pageCount,
    hasText,
    hasImages,
    suggestedMode: mode,
    confidence,
  };
}

/**
 * Count actual PDF pages using pdf.js
 */
export async function countPdfPages(file: File): Promise<number> {
  try {
    // Dynamic import to avoid loading pdf.js on server
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker path if not already set
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    return pdf.numPages;
  } catch (error) {
    console.warn('Failed to count PDF pages, using estimate:', error);
    return estimatePdfPages(file.size);
  }
}

/**
 * Check if a file type is supported
 */
export function isFileTypeSupported(file: File): boolean {
  return detectFileType(file) !== null;
}

/**
 * Get human-readable description of supported file types
 */
export function getSupportedFileTypesDescription(): string {
  return 'PDF, Images (PNG, JPG, WebP, GIF), Word Documents (DOCX), Markdown, and Text files';
}

/**
 * Get accepted file types string for input elements
 */
export function getAcceptedFileTypes(): string {
  return [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain',
    '.pdf',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.docx',
    '.md',
    '.txt',
  ].join(',');
}

// ==================== Mode Descriptions ====================

/**
 * Get description for a processing mode
 */
export function getModeDescription(mode: ProcessingMode): {
  title: string;
  description: string;
  icon: string;
  useCases: string[];
} {
  switch (mode) {
    case 'generate':
      return {
        title: 'Generate',
        description: 'Create beautiful presentations from your text content',
        icon: '✨',
        useCases: [
          'Convert text or ideas into slide presentations',
          'Generate slides from markdown content',
          'Create presentations with AI-generated visuals',
        ],
      };

    case 'process':
      return {
        title: 'Process',
        description: 'Enhance and modify your existing documents or images',
        icon: '🔄',
        useCases: [
          'Modify existing PDF slides',
          'Enhance images with AI',
          'Apply consistent styling to documents',
        ],
      };

    case 'extract':
      return {
        title: 'Extract & Transform',
        description: 'Extract content from documents and transform into new formats',
        icon: '📑',
        useCases: [
          'Extract text and images from PDFs',
          'Convert Word documents to presentations',
          'Restructure existing content into slides',
        ],
      };
  }
}

/**
 * Get all mode descriptions
 */
export function getAllModeDescriptions() {
  return {
    generate: getModeDescription('generate'),
    process: getModeDescription('process'),
    extract: getModeDescription('extract'),
  };
}
