"use server";

import { auth } from "@/server/auth";
import { getTemplate } from "@/lib/presentation/templates";

// yunwu API 支持多轮对话的配置
export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface SlideImageConfig {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}

// 对话历史中的消息
export interface ConversationMessage {
  role: "user" | "assistant";
  parts: Array<{
    text?: string;
    inline_data?: {
      mime_type: string;
      data: string; // base64
    };
  }>;
}

// yunwu API 响应类型
interface YunwuApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        inline_data?: {
          mime_type: string;
          data: string; // base64 encoded image
        };
      }>;
    };
  }>;
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
    // 🚧 TEMPORARY: Use placeholder image for testing
    // TODO: Fix yunwu API image generation
    console.log(`[PLACEHOLDER MODE] Generating slide for: ${slideContent.substring(0, 50)}...`);

    // Get the template for style guidance
    const template = getTemplate(templateId);

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

    // 🚧 TEMPORARY PLACEHOLDER IMAGE GENERATION
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create a simple placeholder HTML canvas-based image
    // We'll use a PNG data URL that works with both PPT and PDF export
    const slideNumber = conversationHistory.length / 2 + 1;
    const contentPreview = slideContent.substring(0, 100).replace(/[<>&"']/g, " ");

    // Display name for placeholder
    const displayName = templateId === "custom" && customThemePrompt
      ? "Custom Theme"
      : template.name;

    // Generate a simple PNG using Canvas (server-side compatible approach)
    // For now, use a simple SVG that we'll mark as PNG
    const placeholderSvg = `
      <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
        <rect width="1920" height="1080" fill="${template.colors.background}"/>
        <text x="960" y="400" font-family="Arial, sans-serif" font-size="48" fill="${template.colors.primary}" text-anchor="middle" font-weight="bold">
          ${displayName}
        </text>
        <text x="960" y="500" font-family="Arial, sans-serif" font-size="32" fill="${template.colors.secondary}" text-anchor="middle">
          Slide ${slideNumber}
        </text>
        <text x="960" y="600" font-family="Arial, sans-serif" font-size="24" fill="${template.colors.accent}" text-anchor="middle">
          ${contentPreview}...
        </text>
        <text x="960" y="700" font-family="Arial, sans-serif" font-size="20" fill="#999" text-anchor="middle">
          🚧 Placeholder - yunwu API 修复后将显示真实图片
        </text>
      </svg>
    `;

    const responseText = `Placeholder image generated for testing. Template: ${template.name}`;
    console.log(`[PLACEHOLDER] Generated slide ${slideNumber}`);

    // Generate filename
    const timestamp = Date.now();

    // 🚧 TEMPORARY: Use SVG data URL for display, but mark as PNG for compatibility
    // Real yunwu API will return actual PNG/JPEG images
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(placeholderSvg).toString("base64")}`;
    const permanentUrl = dataUrl;
    console.log(`[PLACEHOLDER] Using SVG data URL`);

    // Build updated conversation history including the assistant's response
    const updatedHistory: ConversationMessage[] = [
      {
        role: "user",
        parts: [{ text: slideContent.substring(0, 200) }],
      },
      {
        role: "assistant",
        parts: [
          { text: responseText },
          {
            inline_data: {
              mime_type: "image/svg+xml",
              data: Buffer.from(placeholderSvg).toString("base64"),
            },
          },
        ],
      },
    ];

    return {
      success: true,
      image: { url: permanentUrl, id: `placeholder-${timestamp}` },
      imageUrl: permanentUrl,
      responseText,
      conversationHistory: updatedHistory, // Return updated history for next turn
    };
  } catch (error) {
    console.error("Error generating slide image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate slide image",
    };
  }
}

