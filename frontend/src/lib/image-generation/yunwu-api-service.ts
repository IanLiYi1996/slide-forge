// 注意：这是一个服务类文件，不需要 "use server" 指令
// 它会被 Server Actions 调用，而 Server Actions 文件有 "use server"

import { env } from "@/env";
import type {
  IImageGeneratorService,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ConversationMessage,
} from "./image-generator-service";
import { uploadBase64ToDualStorage } from "./dual-storage-service";
import type { ImageUrls } from "@/types/smart-hub";

// yunwu API 响应类型（保持原有定义）
interface YunwuApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
}

/**
 * yunwu API 图片生成服务实现
 * 使用 Gemini 3 Pro Image 模型
 */
export class YunwuService implements IImageGeneratorService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    if (!env.YUNWU_API_KEY) {
      throw new Error("YUNWU_API_KEY is not configured");
    }
    this.apiKey = env.YUNWU_API_KEY;
    this.apiUrl = `https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${this.apiKey}`;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      console.log(`[yunwu] Generating image`);

      // 构建请求（复用原有逻辑）
      const promptText = request.modificationPrompt || request.prompt;

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: request.aspectRatio,
            imageSize: request.imageSize,
          },
        },
      };

      console.log(`[yunwu] Request config: ${request.aspectRatio} ${request.imageSize}`);

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yunwu] API error:`, errorText);
        throw new Error(`yunwu API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as YunwuApiResponse;
      console.log(`[yunwu] Response received`);

      // 提取图片和文本
      let imageBase64: string | undefined;
      let responseText: string | undefined;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No candidates in yunwu API response");
      }

      for (const candidate of data.candidates) {
        if (!candidate.content?.parts) continue;

        for (const part of candidate.content.parts) {
          if (part.text) {
            responseText = part.text;
            console.log(`[yunwu] Generated text: ${part.text.substring(0, 50)}...`);
          }
          if (part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            console.log(`[yunwu] Image data found, mimeType: ${part.inlineData.mimeType}`);
          }
        }
      }

      if (!imageBase64) {
        throw new Error("No image data in yunwu API response");
      }

      // 上传到双重存储 (UploadThing + S3)
      const filename = `yunwu_${Date.now()}.png`;
      const uploadResult = await uploadBase64ToDualStorage(imageBase64, filename);

      if (!uploadResult.success || !uploadResult.urls) {
        throw new Error(uploadResult.error || "Failed to upload image");
      }

      const imageUrls: ImageUrls = uploadResult.urls;
      const primaryUrl = imageUrls.primary;

      console.log(`[yunwu] Dual storage success - Primary: ${primaryUrl}, Backup: ${imageUrls.backup || 'N/A'}`);

      // 构建对话历史
      const newUserMessage: ConversationMessage = {
        role: "user",
        parts: [{ text: promptText }],
      };

      const newAssistantMessage: ConversationMessage = {
        role: "assistant",
        parts: [
          ...(responseText ? [{ text: responseText }] : []),
          {
            inlineData: {
              mimeType: "image/png",
              url: primaryUrl,
            },
          },
        ],
      };

      const updatedHistory = [
        ...(request.conversationHistory || []),
        newUserMessage,
        newAssistantMessage,
      ];

      return {
        success: true,
        imageUrl: primaryUrl,
        imageUrls: imageUrls,
        image: { url: primaryUrl, id: `yunwu-${Date.now()}` },
        responseText: responseText || "Image generated successfully",
        conversationHistory: updatedHistory,
      };
    } catch (error) {
      console.error(`[yunwu] Error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate image",
      };
    }
  }

}
