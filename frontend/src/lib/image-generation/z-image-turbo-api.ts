// 注意：这是一个服务类文件，不需要 "use server" 指令
// 它会被 Server Actions 调用，而 Server Actions 文件有 "use server"

import { env } from "@/env";
import type {
  IImageGeneratorService,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ConversationMessage,
} from "./image-generator-service";
import { uploadFromUrlToDualStorage } from "./dual-storage-service";
import type { ImageUrls } from "@/types/smart-hub";

// z-image-turbo API 响应类型
interface ZImageTurboResponse {
  output: {
    choices: Array<{
      finish_reason: string;
      message: {
        role: string;
        content: Array<{
          image?: string; // URL
          text?: string;
        }>;
        reasoning_content?: string;
      };
    }>;
  };
  usage: {
    width: number;
    height: number;
    image_count: number;
  };
  request_id: string;
}

// 宽高比映射（从 aspectRatio 到 z-image-turbo 的 size 参数）
const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  "16:9": "1536*864",   // 总像素约 1.3M (推荐范围)
  "9:16": "864*1536",
  "4:3": "1152*864",
  "3:4": "864*1152",
  "1:1": "1024*1024",
  "21:9": "1680*720",
  "3:2": "1248*832",
  "2:3": "832*1248",
  "4:5": "1024*1280",
  "5:4": "1280*1024",
};

// 分辨率映射（调整总像素范围）
const IMAGE_SIZE_MULTIPLIER: Record<string, number> = {
  "1K": 0.7,  // 降低分辨率
  "2K": 1.0,  // 标准（推荐范围）
  "4K": 1.3,  // 提高分辨率（接近上限 2048*2048）
};

/**
 * z-image-turbo 图片生成服务实现
 */
export class ZImageTurboService implements IImageGeneratorService {
  private readonly apiUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
  private readonly apiKey: string;

  constructor() {
    if (!env.DASHSCOPE_API_KEY) {
      throw new Error("DASHSCOPE_API_KEY is not configured");
    }
    this.apiKey = env.DASHSCOPE_API_KEY;
  }

  /**
   * 生成图片的主方法
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      console.log(`[z-image-turbo] Generating image`);

      // 构建请求体
      const size = this.calculateSize(request.aspectRatio, request.imageSize);
      const promptText = request.modificationPrompt || request.prompt;

      // 🆕 使用 request.promptExtend 参数，默认为 true
      const promptExtend = request.promptExtend !== undefined ? request.promptExtend : true;

      const requestBody = {
        model: "z-image-turbo",
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  text: promptText,
                },
              ],
            },
          ],
        },
        parameters: {
          prompt_extend: promptExtend, // 🆕 启用智能提示词改写
          size: size,
        },
      };

      console.log(`[z-image-turbo] Request size: ${size}, prompt_extend: ${promptExtend}`);

      // 调用 API
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
        console.error(`[z-image-turbo] API error:`, errorText);
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as ZImageTurboResponse;
      console.log(`[z-image-turbo] Response received`);

      // 提取图片 URL
      const imageUrl = data.output.choices[0]?.message.content.find((c) => c.image)?.image;
      const responseText = data.output.choices[0]?.message.content.find((c) => c.text)?.text;

      if (!imageUrl) {
        throw new Error("No image URL in response");
      }

      console.log(`[z-image-turbo] Image URL received: ${imageUrl.substring(0, 50)}...`);

      // 上传到双重存储 (UploadThing + S3)
      const filename = `z-image-turbo_${Date.now()}.png`;
      const uploadResult = await uploadFromUrlToDualStorage(imageUrl, filename);

      if (!uploadResult.success || !uploadResult.urls) {
        throw new Error(uploadResult.error || "Failed to upload image");
      }

      const imageUrls: ImageUrls = uploadResult.urls;
      const primaryUrl = imageUrls.primary;

      console.log(`[z-image-turbo] Dual storage success - Primary: ${primaryUrl}, Backup: ${imageUrls.backup || 'N/A'}`);

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
        image: { url: primaryUrl, id: `z-image-turbo-${Date.now()}` },
        responseText: responseText || "Image generated successfully",
        conversationHistory: updatedHistory,
      };
    } catch (error) {
      console.error(`[z-image-turbo] Error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate image",
      };
    }
  }

  /**
   * 计算合适的图片尺寸
   */
  private calculateSize(aspectRatio: string, imageSize: string): string {
    const baseSize = ASPECT_RATIO_TO_SIZE[aspectRatio] || "1024*1024";
    const multiplier = IMAGE_SIZE_MULTIPLIER[imageSize] || 1.0;

    if (multiplier === 1.0) {
      return baseSize;
    }

    // 调整分辨率
    const [width, height] = baseSize.split("*").map(Number);
    const newWidth = Math.round((width as number) * multiplier);
    const newHeight = Math.round((height as number) * multiplier);

    // 确保在允许范围内 [512*512, 2048*2048]
    const totalPixels = newWidth * newHeight;
    if (totalPixels < 512 * 512 || totalPixels > 2048 * 2048) {
      console.warn(`[z-image-turbo] Size ${newWidth}*${newHeight} out of range, using base size`);
      return baseSize;
    }

    return `${newWidth}*${newHeight}`;
  }

}
