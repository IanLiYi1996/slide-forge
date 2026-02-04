"use server";

import { convertPlateJSToPPTX } from "@/components/presentation/utils/exportToPPT";
import { type PlateSlide } from "@/components/presentation/utils/parser";
import { auth } from "@/server/auth";
import { getPresentation, getPresentationContent } from "@/services/s3";

export async function exportPresentation(
  presentationId: string,
  fileName?: string,
  theme?: Partial<{
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    heading: string;
    muted: string;
  }>,
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    // Here you would fetch the presentation data from your database
    // This is a placeholder - implement actual data fetching based on your data model
    const presentationData = await fetchPresentationData(
      presentationId,
      session.user.id,
    );

    if (!presentationData.slides) {
      return { success: false, error: "No slides found in presentation" };
    }

    // Generate the PPT file (ArrayBuffer)
    const arrayBuffer = await convertPlateJSToPPTX(
      { slides: presentationData.slides },
      theme,
    );

    // Convert ArrayBuffer to Base64 string for transmission to the client
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    // Return base64 data so client can download it
    return {
      success: true,
      data: base64,
      fileName: `${fileName ?? "presentation"}.pptx`,
    };
  } catch (error) {
    console.error("Error exporting presentation:", error);
    return { success: false, error: "Failed to export presentation" };
  }
}

// Helper function to fetch presentation data
async function fetchPresentationData(presentationId: string, userId: string) {
  // Get the presentation metadata and verify ownership
  const presentation = await getPresentation(presentationId);

  if (!presentation || presentation.base.userId !== userId) {
    return {
      id: null,
      title: null,
      slides: null,
    };
  }

  // Get the full presentation content
  const content = await getPresentationContent(presentationId);

  return {
    id: presentation.base.id,
    title: presentation.base.title,
    slides: (content as { slides?: PlateSlide[] })?.slides ?? null,
  };
}
