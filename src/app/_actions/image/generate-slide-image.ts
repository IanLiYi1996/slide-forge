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
    console.log(`Generating slide image with yunwu API`);
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

    // 🚧 SWITCH: Set to true to use real yunwu API, false for placeholder
    const USE_REAL_API = true;

    if (!USE_REAL_API) {
      // 🎨 MOCK MODE: Use local image file as mock data
      console.log(`[MOCK MODE] Using local image file for testing`);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const slideNumber = conversationHistory.length / 2 + 1;
      console.log(`[MOCK] Generating slide ${slideNumber}`);

      // Read local mock image file
      const fs = await import("fs/promises");
      const path = await import("path");
      const mockImagePath = path.join(process.cwd(), "pics", "Gemini_Generated_Image_6b25th6b25th6b25.png");

      let imageBuffer: Buffer;
      try {
        imageBuffer = await fs.readFile(mockImagePath);
        console.log(`[MOCK] Loaded mock image: ${imageBuffer.length} bytes`);
      } catch (error) {
        console.error("[MOCK] Failed to read mock image file:", error);
        throw new Error(`Mock image file not found at: ${mockImagePath}`);
      }

      // Upload to UploadThing for permanent storage (same as real API)
      const filename = `slide_mock_${Date.now()}.png`;
      const { utapi } = await import("@/app/api/uploadthing/core");
      const { UTFile } = await import("uploadthing/server");
      // Convert Buffer to Uint8Array for UTFile compatibility
      const uint8Array = new Uint8Array(imageBuffer);
      const utFile = new UTFile([uint8Array], filename);

      console.log("[MOCK] Uploading to UploadThing...");
      const uploadResult = await utapi.uploadFiles([utFile]);

      if (!uploadResult[0]?.data?.ufsUrl) {
        console.error("[MOCK] Upload error:", uploadResult[0]?.error);
        throw new Error("Failed to upload mock image to UploadThing");
      }

      const permanentUrl = uploadResult[0].data.ufsUrl;
      console.log(`[MOCK] Uploaded to UploadThing URL: ${permanentUrl}`);

      const responseText = modificationPrompt
        ? `Modified based on: "${modificationPrompt}"`
        : `Mock slide generated. Template: ${template.name}`;

      // Build updated conversation history with permanent URL (same format as real API)
      const newUserMessage: ConversationMessage = {
        role: "user",
        parts: [{ text: modificationPrompt || structuredContent.substring(0, 500) }],
      };

      const newAssistantMessage: ConversationMessage = {
        role: "assistant",
        parts: [
          { text: responseText },
          {
            inlineData: {
              mimeType: "image/png",
              url: permanentUrl,  // ✅ Save permanent URL (not base64)
            },
          },
        ],
      };

      const updatedHistory: ConversationMessage[] = [
        ...conversationHistory,
        newUserMessage,
        newAssistantMessage,
      ];

      return {
        success: true,
        image: { url: permanentUrl, id: `mock-${Date.now()}` },
        imageUrl: permanentUrl,
        responseText,
        conversationHistory: updatedHistory,
      };
    } else {
      // ✅ REAL yunwu API IMPLEMENTATION with multi-turn conversation support
      const { env } = await import("@/env");
      const apiUrl = `https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.YUNWU_API_KEY}`;

      // Build conversation contents (internal format with camelCase)
      const internalContents: Array<{
        role: "user" | "model";
        parts: Array<{
          text?: string;
          inlineData?: { mimeType: string; data?: string; url?: string };
        }>;
      }> = [];

      // Add system prompt as first user message if no history exists
      if (conversationHistory.length === 0) {
        internalContents.push({
          role: "user",
          parts: [
            {
              text: `${finalSystemPrompt}

${template.slideStructure}

**CONTENT TO DRAW:**

${structuredContent}

**TECHNICAL REQUIREMENTS:**
- Aspect ratio: ${config.aspectRatio}
- Image size: ${config.imageSize}
- Strictly follow the style and structure guidelines above
- Ensure all visual elements match the template aesthetic
- The slide content above already contains detailed guidance for narrative, visuals, and layout`,
            },
          ],
        });
      } else {
        // Add existing conversation history
        for (const msg of conversationHistory) {
          internalContents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: msg.parts,
          });
        }

        // Add modification request
        if (modificationPrompt) {
          internalContents.push({
            role: "user",
            parts: [
              {
                text: `Please modify the previous slide image based on this request:

${modificationPrompt}

Keep the same overall style and template, but apply the requested changes.`,
              },
            ],
          });
        } else {
          // Regenerate with same content
          internalContents.push({
            role: "user",
            parts: [{ text: `Please regenerate the slide with the same content.` }],
          });
        }
      }

      // Convert to API format (snake_case for request) - now async
      const apiContents = await Promise.all(
        internalContents.map(async (msg) => ({
          role: msg.role,
          parts: await convertToApiFormat(msg.parts),
        }))
      );

      const requestBody = {
        contents: apiContents,
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: config.aspectRatio,
            imageSize: config.imageSize,
          },
        },
      };

      console.log("yunwu API request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.YUNWU_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("yunwu API error:", errorText);
        throw new Error(`yunwu API request failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as YunwuApiResponse;
      console.log("yunwu API response received");

      // Extract image and text from response
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
            console.log("Generated text:", part.text);
          }
          if (part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            console.log("Image data found, mimeType:", part.inlineData.mimeType);
          }
        }
      }

      if (!imageBase64) {
        throw new Error("No image data found in yunwu API response");
      }

      // Upload image to UploadThing for permanent storage
      const imageBuffer = Buffer.from(imageBase64, "base64");
      console.log(`Image buffer size: ${imageBuffer.length} bytes`);

      const filename = `slide_${Date.now()}.png`;
      const { utapi } = await import("@/app/api/uploadthing/core");
      const { UTFile } = await import("uploadthing/server");
      // Convert Buffer to Uint8Array for UTFile compatibility
      const uint8Array = new Uint8Array(imageBuffer);
      const utFile = new UTFile([uint8Array], filename);

      console.log("Uploading to UploadThing...");
      const uploadResult = await utapi.uploadFiles([utFile]);

      if (!uploadResult[0]?.data?.ufsUrl) {
        console.error("Upload error:", uploadResult[0]?.error);
        throw new Error("Failed to upload image to UploadThing");
      }

      const permanentUrl = uploadResult[0].data.ufsUrl;
      console.log(`Uploaded to UploadThing URL: ${permanentUrl}`);

      // Use permanent URL instead of data URL
      const mimeType = data.candidates[0]?.content.parts.find((p) => p.inlineData)?.inlineData?.mimeType || "image/png";

      // Build updated conversation history with permanent URL
      const newUserMessage: ConversationMessage = {
        role: "user",
        parts: [{ text: modificationPrompt || structuredContent }],
      };

      const newAssistantMessage: ConversationMessage = {
        role: "assistant",
        parts: [
          ...(responseText ? [{ text: responseText }] : []),
          {
            inlineData: {
              mimeType,
              url: permanentUrl,  // ✅ Save permanent URL instead of base64
            },
          },
        ],
      };

      const updatedHistory = [
        ...conversationHistory,
        newUserMessage,
        newAssistantMessage,
      ];

      return {
        success: true,
        image: { url: permanentUrl, id: `yunwu-${Date.now()}` },
        imageUrl: permanentUrl,
        responseText: responseText || "Image generated successfully",
        conversationHistory: updatedHistory,
      };
    }
  } catch (error) {
    console.error("Error generating slide image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate slide image",
    };
  }
}

