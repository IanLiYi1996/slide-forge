"use server";

import { utapi } from "@/app/api/uploadthing/core";
import { env } from "@/env";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { UTFile } from "uploadthing/server";

// yunwu API 配置类型
export type AspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4"
  | "9:16"
  | "16:9"
  | "21:9";

export type ImageSize = "1K" | "2K" | "4K";

export interface ImageGenerationConfig {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
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
 * 使用 yunwu API (Gemini 3 Pro Image) 生成图片
 */
export async function generateImageAction(
  prompt: string,
  config: ImageGenerationConfig = {
    aspectRatio: "16:9",
    imageSize: "1K",
  },
) {
  // 获取当前会话
  const session = await auth();

  // 检查用户是否已认证
  if (!session?.user?.id) {
    throw new Error("You must be logged in to generate images");
  }

  try {
    console.log(`Generating image with yunwu API`);
    console.log(`Config:`, config);
    console.log(`Prompt:`, prompt);

    // 调用 yunwu API
    const apiUrl = `https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.YUNWU_API_KEY}`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: config.aspectRatio,
          imageSize: config.imageSize,
        },
      },
    };

    console.log("Request body:", JSON.stringify(requestBody, null, 2));

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
    console.log("Full response structure:", JSON.stringify(data, null, 2));

    // 从响应中提取图片数据
    let imageBase64: string | undefined;
    let imageText: string | undefined;

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No candidates in yunwu API response");
    }

    for (const candidate of data.candidates) {
      if (!candidate.content || !candidate.content.parts) {
        console.log("Candidate missing content or parts");
        continue;
      }

      for (const part of candidate.content.parts) {
        if (part.text) {
          imageText = part.text;
          console.log("Generated text:", part.text);
        }
        if (part.inline_data?.data) {
          imageBase64 = part.inline_data.data;
          console.log("Image data found, mime_type:", part.inline_data.mime_type);
        }
      }
    }

    if (!imageBase64) {
      console.error("Response structure check:");
      console.error("- Candidates count:", data.candidates?.length);
      console.error("- First candidate:", data.candidates?.[0]);
      throw new Error("No image data found in yunwu API response. Check console for response structure.");
    }

    // 将 base64 转换为 Buffer
    const imageBuffer = Buffer.from(imageBase64, "base64");
    console.log(`Image buffer size: ${imageBuffer.length} bytes`);

    // 生成文件名
    const filename = `${prompt.substring(0, 20).replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.png`;

    // 创建 UTFile 用于上传
    const utFile = new UTFile([imageBuffer], filename);

    // 上传到 UploadThing
    console.log("Uploading to UploadThing...");
    const uploadResult = await utapi.uploadFiles([utFile]);

    if (!uploadResult[0]?.data?.ufsUrl) {
      console.error("Upload error:", uploadResult[0]?.error);
      throw new Error("Failed to upload image to UploadThing");
    }

    const permanentUrl = uploadResult[0].data.ufsUrl;
    console.log(`Uploaded to UploadThing URL: ${permanentUrl}`);

    // 存储到数据库
    const generatedImage = await db.generatedImage.create({
      data: {
        url: permanentUrl,
        prompt: prompt,
        userId: session.user.id,
      },
    });

    console.log("Image saved to database with ID:", generatedImage.id);

    return {
      success: true,
      image: generatedImage,
      generatedText: imageText, // 可选：返回模型生成的文本描述
    };
  } catch (error) {
    console.error("Error generating image:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}
