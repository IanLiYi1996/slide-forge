// 注意：这是一个服务类文件，不需要 "use server" 指令
// 它会被 Server Actions 调用，而 Server Actions 文件有 "use server"

import { env } from "@/env";
import type {
  IImageGeneratorService,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ConversationMessage,
} from "./image-generator-service";

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

      // 上传到 UploadThing
      const permanentUrl = await this.uploadBase64Image(imageBase64);

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
              url: permanentUrl,
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
        imageUrl: permanentUrl,
        image: { url: permanentUrl, id: `yunwu-${Date.now()}` },
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

  /**
   * 上传 base64 编码的图片到 UploadThing
   */
  private async uploadBase64Image(base64Data: string): Promise<string> {
    const imageBuffer = Buffer.from(base64Data, "base64");
    console.log(`[yunwu] Image buffer size: ${imageBuffer.length} bytes`);

    const filename = `yunwu_${Date.now()}.png`;
    const { utapi } = await import("@/app/api/uploadthing/core");
    const { UTFile } = await import("uploadthing/server");

    const uint8Array = new Uint8Array(imageBuffer);
    const utFile = new UTFile([uint8Array], filename);

    console.log(`[yunwu] Uploading to UploadThing...`);
    const uploadResult = await utapi.uploadFiles([utFile]);

    if (!uploadResult[0]?.data?.ufsUrl) {
      console.error(`[yunwu] Upload error:`, uploadResult[0]?.error);
      throw new Error("Failed to upload to UploadThing");
    }

    const permanentUrl = uploadResult[0].data.ufsUrl;
    console.log(`[yunwu] Upload successful: ${permanentUrl}`);

    return permanentUrl;
  }
}
