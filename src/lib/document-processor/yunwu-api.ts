/**
 * Yunwu API integration for image processing
 */

export interface YunwuProcessRequest {
  imageDataUrl: string;
  instruction: string;
  apiKey: string;
}

export interface YunwuProcessResponse {
  success: boolean;
  processedImageUrl?: string;
  error?: string;
}

/**
 * Process an image using Yunwu API with user instruction
 */
export async function processImageWithYunwu(
  request: YunwuProcessRequest
): Promise<YunwuProcessResponse> {
  try {
    const response = await fetch("/api/document-processor/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageDataUrl: request.imageDataUrl,
        instruction: request.instruction,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || "Failed to process image",
      };
    }

    const result = await response.json();
    return {
      success: true,
      processedImageUrl: result.processedImageUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
