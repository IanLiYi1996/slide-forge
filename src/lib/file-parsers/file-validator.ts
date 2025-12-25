export const SUPPORTED_FILE_TYPES = {
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/pdf": [".pdf"],
} as const;

export const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidationResult {
  // Check file type
  const supportedTypes = Object.keys(SUPPORTED_FILE_TYPES);
  const fileExtension = file.name.toLowerCase().split(".").pop();

  // Check if MIME type is supported
  const isMimeTypeSupported = supportedTypes.includes(file.type);

  // Check if extension is supported (fallback for cases where MIME type is missing or incorrect)
  const isExtensionSupported = Object.values(SUPPORTED_FILE_TYPES)
    .flat()
    .some((ext) => ext === `.${fileExtension}`);

  if (!isMimeTypeSupported && !isExtensionSupported) {
    return {
      valid: false,
      error: "Unsupported file type. Please upload .txt, .md, .docx, or .pdf files.",
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / 1024 / 1024;
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB`,
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty. Please upload a file with content.",
    };
  }

  return { valid: true };
}
