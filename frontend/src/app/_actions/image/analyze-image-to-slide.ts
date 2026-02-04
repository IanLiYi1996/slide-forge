"use server";

import { auth } from "@/server/auth";
import { getBedrockClaudeService } from "@/lib/bedrock/bedrock-claude-service";

/**
 * 图片分析请求参数
 */
export interface AnalyzeImageRequest {
  imageDataUrl: string; // data:image/jpeg;base64,... 格式
  language?: string;
  slideCount?: number;
  additionalContext?: string;
}

/**
 * 图片分析响应
 */
export interface AnalyzeImageResponse {
  success: boolean;
  title?: string;
  outline?: string[];
  content?: string;
  error?: string;
}

/**
 * 内容生成请求参数
 */
export interface GenerateContentRequest {
  topic: string;
  slideCount: number;
  language?: string;
  tone?: string;
  additionalContext?: string;
}

/**
 * 内容生成响应
 */
export interface GenerateContentResponse {
  success: boolean;
  title?: string;
  outline?: string[];
  error?: string;
}

/**
 * 从 data URL 中提取 base64 数据和 MIME 类型
 */
function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return {
    mimeType: match[1],
    data: match[2],
  };
}

/**
 * Server Action: 分析图片并生成幻灯片大纲
 *
 * 使用 Bedrock Claude Sonnet 4.5 分析用户上传的图片，
 * 提取关键信息并生成演示文稿大纲。
 *
 * @param request - 图片分析请求参数
 * @returns 分析结果，包含标题和大纲
 */
export async function analyzeImageToSlideAction(
  request: AnalyzeImageRequest
): Promise<AnalyzeImageResponse> {
  // 验证用户身份
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be logged in to analyze images",
    };
  }

  try {
    console.log("[analyzeImageToSlideAction] Starting image analysis");

    // 解析 data URL
    const parsed = parseDataUrl(request.imageDataUrl);
    if (!parsed) {
      return {
        success: false,
        error: "Invalid image data URL format. Expected: data:image/xxx;base64,...",
      };
    }

    // 获取 Bedrock Claude 服务
    const service = getBedrockClaudeService();

    // 调用图片分析
    const result = await service.analyzeImageForSlides({
      imageData: parsed.data,
      mimeType: parsed.mimeType,
      language: request.language || "中文",
      slideCount: request.slideCount || 10,
      additionalContext: request.additionalContext,
    });

    if (!result.success) {
      console.error("[analyzeImageToSlideAction] Analysis failed:", result.error);
      return {
        success: false,
        error: result.error,
      };
    }

    console.log("[analyzeImageToSlideAction] Analysis successful");
    console.log(`[analyzeImageToSlideAction] Title: ${result.title}`);
    console.log(`[analyzeImageToSlideAction] Outline items: ${result.outline?.length || 0}`);

    return {
      success: true,
      title: result.title,
      outline: result.outline,
      content: result.content,
    };
  } catch (error) {
    console.error("[analyzeImageToSlideAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze image",
    };
  }
}

/**
 * Server Action: 生成演示文稿大纲
 *
 * 使用 Bedrock Claude Sonnet 4.5 根据主题生成演示文稿大纲。
 *
 * @param request - 内容生成请求参数
 * @returns 生成结果，包含标题和大纲
 */
export async function generatePresentationContentAction(
  request: GenerateContentRequest
): Promise<GenerateContentResponse> {
  // 验证用户身份
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be logged in to generate content",
    };
  }

  try {
    console.log(`[generatePresentationContentAction] Generating content for: ${request.topic}`);

    // 获取 Bedrock Claude 服务
    const service = getBedrockClaudeService();

    // 调用内容生成
    const result = await service.generatePresentationContent({
      topic: request.topic,
      slideCount: request.slideCount,
      language: request.language || "中文",
      tone: request.tone || "professional",
      additionalContext: request.additionalContext,
    });

    if (!result.success) {
      console.error("[generatePresentationContentAction] Generation failed:", result.error);
      return {
        success: false,
        error: result.error,
      };
    }

    console.log("[generatePresentationContentAction] Generation successful");
    console.log(`[generatePresentationContentAction] Title: ${result.title}`);
    console.log(`[generatePresentationContentAction] Outline items: ${result.outline?.length || 0}`);

    return {
      success: true,
      title: result.title,
      outline: result.outline,
    };
  } catch (error) {
    console.error("[generatePresentationContentAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate content",
    };
  }
}
