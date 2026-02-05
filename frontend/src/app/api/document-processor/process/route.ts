import { NextRequest, NextResponse } from "next/server";
import { YunwuService } from "@/lib/image-generation/yunwu-api-service";
import type { AspectRatio, ImageSize } from "@/app/_actions/image/generate";

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl, instruction, aspectRatio, imageSize } = await request.json();

    if (!imageDataUrl || !instruction) {
      return NextResponse.json(
        { message: "Missing required fields: imageDataUrl and instruction" },
        { status: 400 }
      );
    }

    // Use the YunwuService for image processing
    const yunwuService = new YunwuService();

    // Build the modification prompt that includes the original image reference
    const modificationPrompt = `Based on the attached image, please: ${instruction}

Important: Maintain the overall structure and layout of the original image while applying the requested changes.`;

    const result = await yunwuService.generateImage({
      prompt: modificationPrompt,
      modificationPrompt: modificationPrompt,
      aspectRatio: (aspectRatio as AspectRatio) || "16:9",
      imageSize: (imageSize as ImageSize) || "1K",
      conversationHistory: [
        {
          role: "user",
          parts: [
            { text: "Here is the image I want to modify:" },
            {
              inlineData: {
                mimeType: "image/png",
                data: imageDataUrl.replace(/^data:image\/\w+;base64,/, ""),
              },
            },
          ],
        },
      ],
    });

    if (!result.success || !result.imageUrl) {
      console.error("Yunwu processing error:", result.error);
      return NextResponse.json(
        { message: result.error || "Failed to process image" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      processedImageUrl: result.imageUrl,
      imageUrls: result.imageUrls,
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
