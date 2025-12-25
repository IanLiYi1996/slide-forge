export interface FileUploadMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: Date;
}

export interface ParseFileResponse {
  success: boolean;
  text?: string;
  error?: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
  };
}
