import { auth } from "@/server/auth";
import mammoth from "mammoth";
import { NextResponse } from "next/server";

// Note: Using unpdf (lightweight, server-optimized) for PDF parsing

export const maxDuration = 30; // 30 seconds timeout

export async function POST(req: Request) {
  try {
    // Authentication check
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get file from FormData
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let text = "";
    const metadata: { pageCount?: number; wordCount?: number } = {};

    // Parse based on file type
    if (
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      // Parse DOCX
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;

        // Calculate word count
        const words = text.trim().split(/\s+/);
        metadata.wordCount = words.length;
      } catch (error) {
        console.error("Error parsing DOCX:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to parse DOCX file. The file may be corrupted.",
          },
          { status: 400 },
        );
      }
    } else if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      // Parse PDF using unpdf (lightweight, server-optimized)
      try {
        // unpdf provides a simple, promise-based API
        const { extractText } = await import("unpdf");

        // Convert Buffer to Uint8Array (unpdf requirement)
        const uint8Array = new Uint8Array(buffer);

        const result = await extractText(uint8Array, {
          mergePages: true, // Merge all pages into single text
        });

        text = result.text;
        metadata.pageCount = result.totalPages;

        // Calculate word count
        const words = text.trim().split(/\s+/);
        metadata.wordCount = words.length;
      } catch (error) {
        console.error("Error parsing PDF:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to parse PDF file. The file may be corrupted or image-only.",
          },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported file type" },
        { status: 400 },
      );
    }

    // Check if text is empty
    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No text content found in file. The file may be empty or contain only images.",
        },
        { status: 400 },
      );
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      text: trimmedText,
      metadata,
    });
  } catch (error) {
    console.error("Error in parse-file API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to parse file. Please try again or use manual input.",
      },
      { status: 500 },
    );
  }
}
