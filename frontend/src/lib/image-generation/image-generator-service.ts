// 注意：这是一个类型定义文件，不需要 "use server" 指令
// 它只定义接口和类型，会被 Server Actions 使用

import type { AspectRatio, ImageSize } from "@/app/_actions/image/generate";
import type { ImageUrls } from "@/types/smart-hub";

// 统一的图片生成请求接口
export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  conversationHistory?: ConversationMessage[];
  modificationPrompt?: string;
  promptExtend?: boolean; // 🆕 是否启用智能提示词改写（主要用于 z-image-turbo）
}

// 对话消息格式（与现有格式兼容）
export interface ConversationMessage {
  role: "user" | "assistant";
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data?: string;
      url?: string;
    };
  }>;
}

// 统一的响应格式
export interface ImageGenerationResponse {
  success: boolean;
  imageUrl?: string;          // Primary URL (for backward compatibility)
  imageUrls?: ImageUrls;      // Both primary and backup URLs
  image?: { url: string; id: string };
  responseText?: string;
  conversationHistory?: ConversationMessage[];
  error?: string;
}

// 图片生成服务抽象接口
export interface IImageGeneratorService {
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
}
