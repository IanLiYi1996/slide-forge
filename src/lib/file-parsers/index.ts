import type { ParseFileResponse } from "@/types/file-upload";
import { readTextFile } from "./client-parser";
import { validateFile } from "./file-validator";

/**
 * Parse file content based on file type
 * - .txt, .md: Client-side parsing (instant)
 * - .docx, .pdf: Server-side parsing (via API)
 */
export async function parseFile(file: File): Promise<string> {
  // Validate file first
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Determine parsing strategy based on file type
  const fileExtension = file.name.toLowerCase().split(".").pop();

  // Client-side parsing for simple text files
  if (
    file.type === "text/plain" ||
    file.type === "text/markdown" ||
    fileExtension === "txt" ||
    fileExtension === "md"
  ) {
    try {
      return await readTextFile(file);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to read text file",
      );
    }
  }

  // Server-side parsing for complex formats (.docx, .pdf)
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/pdf" ||
    fileExtension === "docx" ||
    fileExtension === "pdf"
  ) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ParseFileResponse;
        throw new Error(errorData.error || "Failed to parse file");
      }

      const data = (await response.json()) as ParseFileResponse;

      if (!data.success || !data.text) {
        throw new Error(data.error || "Failed to extract text from file");
      }

      return data.text;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to parse file. Please try again or use manual input.");
    }
  }

  throw new Error("Unsupported file type");
}
