/**
 * Smart Document Hub - Unified Types
 * Combines presentation generation and document processing features
 */

// ==================== Processing Modes ====================

/** The three processing modes available in Smart Document Hub */
export type ProcessingMode = 'generate' | 'process' | 'extract';

/** Session status for all modes */
export type HubSessionStatus =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'outline_generation'
  | 'slide_generation'
  | 'page_processing'
  | 'extracting'
  | 'completed'
  | 'error';

// ==================== Input Types ====================

/** Supported input file types */
export type InputType = 'text' | 'pdf' | 'image' | 'docx' | 'markdown';

/** Metadata about the input, used for mode detection */
export interface InputMetadata {
  type: InputType;
  fileName?: string;
  fileSize?: number;
  pageCount?: number;
  hasText: boolean;
  hasImages: boolean;
  suggestedMode: ProcessingMode;
  confidence: number; // 0-1 confidence score for the suggested mode
}

// ==================== Conversation Types ====================

/** Message in a conversation history */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrl?: string; // Optional image attachment
  timestamp: string;
}

/** Multi-turn conversation for image generation/modification */
export interface ImageConversationTurn {
  role: 'user' | 'assistant';
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data?: string; // base64 (optional, for API requests)
      url?: string; // permanent URL (for storage and display)
    };
  }>;
}

// ==================== Page/Slide Types ====================

/** Page status in the processing workflow */
export type PageStatus = 'pending' | 'processing' | 'ready' | 'error';

/** Source type for a page */
export type PageSourceType = 'text' | 'image' | 'extracted';

/** Unified page/slide structure */
export interface HubPage {
  id: string;
  index: number;
  sourceType: PageSourceType;

  // Content
  textContent?: string; // Text content (outline item or extracted text)
  imageDataUrl?: string; // Original image (for process mode)

  // Processing status
  status: PageStatus;
  errorMessage?: string;

  // Output
  outputImageUrl?: string; // Generated/processed image URL
  extractedContent?: string; // Extracted text from image

  // Conversation history for iterative refinement
  conversationHistory: ImageConversationTurn[];
  modificationCount: number;

  // Timestamps
  createdAt: string;
  processedAt?: string;
}

// ==================== Configuration Types ====================

/** Aspect ratio options for image generation */
export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';

/** Image resolution/quality options */
export type ImageSize = '1K' | '2K' | '4K';

/** Presentation style options */
export type PresentationStyle = 'professional' | 'creative' | 'minimal' | 'bold';

/** Presentation theme options */
export type PresentationTheme = 'default' | 'corporate' | 'tech' | 'nature' | 'elegant' | 'vibrant';

/** Image generation provider */
export type ImageGenerationProvider = 'yunwu' | 'z-image-turbo';

/** Configuration for generate mode (text to slides) */
export interface GenerateConfig {
  numberOfSlides: number;
  language: string;
  tone: 'professional' | 'casual' | 'creative' | 'academic';
  style: PresentationStyle;
  theme?: PresentationTheme;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  imageProvider?: ImageGenerationProvider;
  promptExtend?: boolean;  // For z-image-turbo provider
  templateId?: string;
  enableWebSearch: boolean;
  customInstructions?: string;
  customStylePrompt?: string;  // Custom style description for AI generation
}

/** Configuration for process mode (image modification) */
export interface ProcessConfig {
  defaultInstruction?: string;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputQuality: number; // 0-100
  preserveOriginals: boolean;
}

/** Configuration for extract mode (image to content) */
export interface ExtractConfig {
  extractionType: 'text' | 'structure' | 'both';
  outputFormat: 'slides' | 'document' | 'markdown';
  preserveLayout: boolean;
  enhanceExtracted: boolean;
}

// ==================== Session Types ====================

/** The unified session structure for Smart Document Hub */
export interface HubSession {
  // Identifiers
  id: string;
  sessionId: string;
  userId: string;

  // Mode and status
  mode: ProcessingMode;
  status: HubSessionStatus;

  // Basic info
  title: string;
  description?: string;

  // Input information
  inputMetadata: InputMetadata;
  inputText?: string; // For text input (generate mode)

  // Pages (all modes)
  pages: HubPage[];
  currentPageIndex: number;

  // Mode-specific configurations
  generateConfig?: GenerateConfig;
  processConfig?: ProcessConfig;
  extractConfig?: ExtractConfig;

  // Outline (for generate and extract modes)
  outline?: string[];
  outlineTitle?: string;

  // Export tracking
  exportedAt?: string;
  exportFormat?: string;
  exportCount: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

// ==================== API Request/Response Types ====================

/** Request to create a new session */
export interface CreateSessionRequest {
  mode: ProcessingMode;
  title?: string;
  inputType?: InputType;
}

/** Response from creating a session */
export interface CreateSessionResponse {
  success: boolean;
  session?: HubSession;
  error?: string;
}

/** Request to detect input type */
export interface DetectInputRequest {
  file?: File;
  text?: string;
}

/** Response from input detection */
export interface DetectInputResponse {
  success: boolean;
  metadata?: InputMetadata;
  error?: string;
}

/** Request for outline generation */
export interface GenerateOutlineRequest {
  sessionId: string;
  inputText: string;
  config: GenerateConfig;
}

/** Response from outline generation */
export interface GenerateOutlineResponse {
  success: boolean;
  outline?: string[];
  title?: string;
  error?: string;
}

/** Request for slide/page generation */
export interface GeneratePageRequest {
  sessionId: string;
  pageIndex: number;
  content: string;
  instruction?: string;
}

/** Response from page generation */
export interface GeneratePageResponse {
  success: boolean;
  page?: HubPage;
  error?: string;
}

/** Request for image processing */
export interface ProcessImageRequest {
  sessionId: string;
  pageIndex: number;
  imageDataUrl: string;
  instruction: string;
}

/** Response from image processing */
export interface ProcessImageResponse {
  success: boolean;
  processedImageUrl?: string;
  error?: string;
}

/** Request for content extraction */
export interface ExtractContentRequest {
  sessionId: string;
  imageDataUrl: string;
  config: ExtractConfig;
}

/** Response from content extraction */
export interface ExtractContentResponse {
  success: boolean;
  extractedContent?: string;
  structuredData?: unknown;
  error?: string;
}

// ==================== Export Types ====================

/** Supported export formats */
export type ExportFormat = 'pdf' | 'pptx' | 'png' | 'zip' | 'markdown';

/** Export request */
export interface ExportRequest {
  sessionId: string;
  format: ExportFormat;
  pageIndices?: number[]; // If not provided, export all pages
  options?: {
    quality?: number;
    includeOriginals?: boolean;
  };
}

/** Export response */
export interface ExportResponse {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}

// ==================== Default Configurations ====================

export const DEFAULT_GENERATE_CONFIG: GenerateConfig = {
  numberOfSlides: 10,
  language: 'en-US',
  tone: 'professional',
  style: 'professional',
  theme: 'default',
  aspectRatio: '16:9',
  imageSize: '2K',
  enableWebSearch: true,
};

export const DEFAULT_PROCESS_CONFIG: ProcessConfig = {
  outputFormat: 'png',
  outputQuality: 90,
  preserveOriginals: true,
};

export const DEFAULT_EXTRACT_CONFIG: ExtractConfig = {
  extractionType: 'both',
  outputFormat: 'slides',
  preserveLayout: true,
  enhanceExtracted: false,
};
