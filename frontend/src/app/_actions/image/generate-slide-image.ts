"use server";

import { auth } from "@/server/auth";
import { getTemplate } from "@/lib/presentation/templates";
import { YunwuService } from "@/lib/image-generation/yunwu-api-service";
import { ZImageTurboService } from "@/lib/image-generation/z-image-turbo-api";
import type { IImageGeneratorService } from "@/lib/image-generation/image-generator-service";
import type { ImageGenerationProvider } from "@/states/presentation-state";

// yunwu API 支持多轮对话的配置
export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface SlideImageConfig {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  provider?: ImageGenerationProvider; // 🆕 新增：可选的模型选择
  promptExtend?: boolean; // 🆕 智能提示词改写（z-image-turbo 专用）
}

// 对话历史中的消息
export interface ConversationMessage {
  role: "user" | "assistant";
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data?: string; // base64 (optional, for API requests)
      url?: string;  // permanent URL (for storage and display)
    };
  }>;
}

// yunwu API 响应类型（使用驼峰命名）
interface YunwuApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string; // base64 encoded image
        };
      }>;
    };
  }>;
}

// yunwu API 请求格式（使用下划线命名）
interface YunwuApiRequestPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

// 转换函数：将驼峰格式转换为下划线格式（用于请求）
// Now async to support downloading images from URLs
async function convertToApiFormat(
  parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data?: string; url?: string };
  }>
): Promise<YunwuApiRequestPart[]> {
  const result: YunwuApiRequestPart[] = [];

  for (const part of parts) {
    const apiPart: YunwuApiRequestPart = {};

    if (part.text) {
      apiPart.text = part.text;
    }

    if (part.inlineData) {
      let base64Data = part.inlineData.data;

      // If no data but has URL, download and convert to base64
      if (!base64Data && part.inlineData.url) {
        console.log(`Downloading image from URL for API request: ${part.inlineData.url}`);
        try {
          const response = await fetch(part.inlineData.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          const buffer = await response.arrayBuffer();
          base64Data = Buffer.from(buffer).toString("base64");
          console.log(`Downloaded and converted to base64: ${base64Data.length} chars`);
        } catch (error) {
          console.error("Error downloading image from URL:", error);
          throw new Error(`Failed to download image from URL: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      if (base64Data) {
        apiPart.inline_data = {
          mime_type: part.inlineData.mimeType,
          data: base64Data,
        };
      }
    }

    result.push(apiPart);
  }

  return result;
}

/**
 * Ensure slide content is in structured format
 * Converts simple outline format to structured format for backward compatibility
 */
function ensureStructuredFormat(content: string, templateName: string): string {
  // Check if already in structured format
  if (
    content.includes("// NARRATIVE GOAL") ||
    content.includes("// KEY CONTENT") ||
    content.includes("// VISUAL") ||
    content.includes("// LAYOUT")
  ) {
    return content; // Already structured
  }

  // Simple format detected - convert to structured format
  const lines = content.split("\n");
  const title = lines[0]?.replace(/^#\s*/, "").trim() || "Untitled Slide";
  const bulletPoints = lines.slice(1).filter((line) => line.trim().startsWith("-"));

  return `Slide: ${title}

// NARRATIVE GOAL (叙事目标)
Present the key information clearly and engagingly to the audience.

// KEY CONTENT (关键内容)
${title}
${bulletPoints.join("\n")}

// VISUAL (视觉画面)
Create a professional visualization that matches the ${templateName} template style. Include appropriate visual elements such as icons, illustrations, or diagrams that enhance the content. Use the template's color palette and visual aesthetic to create a cohesive, engaging slide.

// LAYOUT (布局结构)
Balanced layout with clear hierarchy. Place the title prominently at the top, followed by content points in a well-organized structure. Ensure good spacing and visual balance between text and any graphical elements.`;
}

/**
 * Generate a complete slide visualization image using yunwu API
 * Combines slide content with template style to create a full-page image
 */
export async function generateSlideImageAction(
  slideContent: string, // The markdown content of the slide
  templateId: string, // Template ID for style guidance
  config: SlideImageConfig = {
    aspectRatio: "16:9",
    imageSize: "2K",
    provider: "yunwu", // 🆕 默认使用 yunwu
    promptExtend: true, // 🆕 默认启用智能提示词改写
  },
  conversationHistory: ConversationMessage[] = [], // For multi-turn editing
  modificationPrompt?: string, // For follow-up modifications
  customThemePrompt?: string, // Custom theme style description
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("You must be logged in to generate slide images");
  }

  try {
    const provider = config.provider || "yunwu";
    console.log(`Generating slide image with ${provider} API`);
    console.log(`Slide content: ${slideContent.substring(0, 50)}...`);
    console.log(`Conversation history length: ${conversationHistory.length}`);
    console.log(`Has modification prompt: ${!!modificationPrompt}`);

    // Get the template for style guidance
    const template = getTemplate(templateId);

    // Ensure slideContent is in structured format (backward compatibility)
    const structuredContent = ensureStructuredFormat(slideContent, template.name);

    // If using custom theme, override the system prompt
    let finalSystemPrompt = template.systemPrompt;
    if (templateId === "custom" && customThemePrompt) {
      finalSystemPrompt = `You are a professional presentation designer.

**CUSTOM THEME STYLE:**
${customThemePrompt}

Apply this style consistently across all visual elements, colors, typography, and illustrations.`;
      console.log(`Using custom theme: ${customThemePrompt.substring(0, 50)}...`);
    } else {
      console.log(`Using template: ${template.name}`);
    }

    // 🆕 使用新的服务架构，根据 provider 选择服务
    let service: IImageGeneratorService;

    if (provider === "z-image-turbo") {
      service = new ZImageTurboService();
    } else {
      service = new YunwuService();
    }

    // 构建最终提示词
    let finalPrompt = structuredContent;
    if (templateId === "custom" && customThemePrompt) {
      finalPrompt = `**CUSTOM THEME STYLE:**
${customThemePrompt}

**SLIDE CONTENT:**
${structuredContent}

**IMPORTANT:** NEVER include any copyright text, page numbers, slide numbers, dates, logos, watermarks, company names, or footer/header text in the image. Only render the visual content.`;
    } else {
      finalPrompt = `${finalSystemPrompt}

${template.slideStructure}

**CONTENT TO DRAW:**
${structuredContent}

**TECHNICAL REQUIREMENTS:**
- Aspect ratio: ${config.aspectRatio}
- Image size: ${config.imageSize}
- Strictly follow the style and structure guidelines above
- NEVER include any copyright text, page numbers, slide numbers, dates, logos, watermarks, company names, or footer/header text in the image
- The image should contain ONLY the visual content described above, with no metadata or decorative text overlays`;
    }

    // 调用统一的服务接口
    const result = await service.generateImage({
      prompt: finalPrompt,
      aspectRatio: config.aspectRatio,
      imageSize: config.imageSize,
      conversationHistory,
      modificationPrompt,
      promptExtend: config.promptExtend, // 🆕 传递智能提示词改写配置
    });

    return result;
  } catch (error) {
    console.error("Error generating slide image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate slide image",
    };
  }
}
