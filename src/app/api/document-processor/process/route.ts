import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl, instruction } = await request.json();

    if (!imageDataUrl || !instruction) {
      return NextResponse.json(
        { message: "Missing required fields: imageDataUrl and instruction" },
        { status: 400 }
      );
    }

    const apiKey = process.env.YUNWU_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "YUNWU_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Call Yunwu API for image processing
    // TODO: Replace this URL with the actual Yunwu API endpoint from their documentation
    // This is a placeholder endpoint - update it according to Yunwu's API specs
    const yunwuResponse = await fetch("https://api.yunwu.ai/v1/image/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        image: imageDataUrl,
        instruction: instruction,
      }),
    });

    if (!yunwuResponse.ok) {
      const error = await yunwuResponse.text();
      console.error("Yunwu API error:", error);
      return NextResponse.json(
        { message: "Failed to process image with Yunwu API" },
        { status: yunwuResponse.status }
      );
    }

    const result = await yunwuResponse.json();

    return NextResponse.json({
      processedImageUrl: result.processedImageUrl || result.data?.url,
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
