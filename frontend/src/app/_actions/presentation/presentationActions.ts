"use server";

import { type PlateSlide } from "@/components/presentation/utils/parser";
import { auth } from "@/server/auth";
import {
  createPresentation as s3CreatePresentation,
  getPresentation as s3GetPresentation,
  getPresentationContent as s3GetPresentationContent,
  updatePresentation as s3UpdatePresentation,
  deletePresentation as s3DeletePresentation,
  deletePresentations as s3DeletePresentations,
  type DocumentWithPresentation,
} from "@/services/s3";

function transformToLegacyFormat(doc: DocumentWithPresentation) {
  return {
    id: doc.base.id,
    title: doc.base.title,
    type: doc.base.type,
    userId: doc.base.userId,
    thumbnailUrl: doc.base.thumbnailUrl,
    isPublic: doc.base.isPublic,
    documentType: doc.base.documentType,
    createdAt: new Date(doc.base.createdAt),
    updatedAt: new Date(doc.base.updatedAt),
    presentation: {
      id: doc.presentation.id,
      presentationMode: doc.presentation.presentationMode,
      content: doc.presentation.content,
      theme: doc.presentation.theme,
      imageSource: doc.presentation.imageSource,
      prompt: doc.presentation.prompt,
      presentationStyle: doc.presentation.presentationStyle,
      language: doc.presentation.language,
      outline: doc.presentation.outline,
      searchResults: doc.presentation.searchResults,
      slideImages: doc.presentation.slideImages,
      templateId: doc.presentation.templateId,
      customThemeId: doc.presentation.customThemeId,
      generationStage: doc.presentation.generationStage,
      lastAccessedAt: doc.presentation.lastAccessedAt
        ? new Date(doc.presentation.lastAccessedAt)
        : null,
      slidesGenerated: doc.presentation.slidesGenerated,
      currentSlideIndex: doc.presentation.currentSlideIndex,
      exportedAt: doc.presentation.exportedAt
        ? new Date(doc.presentation.exportedAt)
        : null,
      exportFormat: doc.presentation.exportFormat,
      exportCount: doc.presentation.exportCount,
      exportHistory: doc.presentation.exportHistory,
    },
  };
}

export async function createPresentation({
  content,
  title,
  theme = "default",
  outline,
  imageSource,
  presentationStyle,
  language,
}: {
  content: {
    slides: PlateSlide[];
  };
  title: string;
  theme?: string;
  outline?: string[];
  imageSource?: string;
  presentationStyle?: string;
  language?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;

  try {
    const doc = await s3CreatePresentation({
      userId,
      title: title ?? "Untitled Presentation",
      content,
      theme,
      outline,
      imageSource,
      presentationStyle,
      language,
    });

    return {
      success: true,
      message: "Presentation created successfully",
      presentation: transformToLegacyFormat(doc),
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to create presentation",
    };
  }
}

export async function createEmptyPresentation(
  title: string,
  theme = "default",
  language = "en-US"
) {
  const emptyContent: { slides: PlateSlide[] } = { slides: [] };

  return createPresentation({
    content: emptyContent,
    title,
    theme,
    language,
  });
}

export async function updatePresentation({
  id,
  content,
  prompt,
  title,
  theme,
  outline,
  searchResults,
  imageSource,
  presentationStyle,
  language,
  thumbnailUrl,
  slides,
  slideImages,
  generationStage,
  lastAccessedAt,
  slidesGenerated,
  currentSlideIndex,
  exportedAt,
  exportFormat,
  exportCount,
}: {
  id: string;
  content?: {
    slides?: PlateSlide[] | string[];
    config?: Record<string, unknown>;
  };
  title?: string;
  theme?: string;
  prompt?: string;
  outline?: string[];
  searchResults?: Array<{ query: string; results: unknown[] }>;
  imageSource?: string;
  presentationStyle?: string;
  language?: string;
  thumbnailUrl?: string;
  slides?: string[];
  slideImages?: Record<string, unknown>;
  generationStage?: string;
  lastAccessedAt?: Date;
  slidesGenerated?: number;
  currentSlideIndex?: number;
  exportedAt?: Date;
  exportFormat?: string;
  exportCount?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  try {
    // Build content object - support both old PlateSlide format and new pure-image format
    let finalContent = content;
    if (slides && slides.length > 0) {
      finalContent = { slides: slides };
    }

    const doc = await s3UpdatePresentation(id, session.user.id, {
      title,
      content: finalContent,
      theme,
      outline,
      slideImages,
      generationStage,
      lastAccessedAt: lastAccessedAt?.toISOString(),
      slidesGenerated,
      currentSlideIndex,
      exportedAt: exportedAt?.toISOString(),
      exportFormat,
      exportCount,
      thumbnailUrl,
      searchResults,
    });

    if (!doc) {
      return {
        success: false,
        message: "Presentation not found or unauthorized",
      };
    }

    console.log("Presentation updated successfully");

    // Log what was actually saved
    const savedFields: string[] = [];
    if (title) savedFields.push("title");
    if (finalContent) savedFields.push("content");
    if (outline) savedFields.push("outline");
    if (searchResults) savedFields.push("searchResults");
    if (theme) savedFields.push("theme");
    if (thumbnailUrl) savedFields.push("thumbnailUrl");
    if (slideImages) savedFields.push("slideImages");

    console.log(`Saved fields: ${savedFields.join(", ")}`);
    if (finalContent) {
      console.log("Saved content:", finalContent);
    }
    if (slideImages) {
      console.log("Saved slideImages count:", Object.keys(slideImages).length);
    }

    return {
      success: true,
      message: "Presentation updated successfully",
      presentation: transformToLegacyFormat(doc),
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to update presentation",
    };
  }
}

export async function updatePresentationTitle(id: string, title: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  try {
    const doc = await s3UpdatePresentation(id, session.user.id, { title });

    if (!doc) {
      return {
        success: false,
        message: "Presentation not found or unauthorized",
      };
    }

    return {
      success: true,
      message: "Presentation title updated successfully",
      presentation: transformToLegacyFormat(doc),
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to update presentation title",
    };
  }
}

export async function deletePresentation(id: string) {
  return deletePresentations([id]);
}

export async function deletePresentations(ids: string[]) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  try {
    const deletedCount = await s3DeletePresentations(ids, session.user.id);

    const failedCount = ids.length - deletedCount;

    if (failedCount > 0) {
      return {
        success: deletedCount > 0,
        message:
          deletedCount > 0
            ? `Deleted ${deletedCount} presentations, failed to delete ${failedCount} presentations`
            : "Failed to delete presentations",
        partialSuccess: deletedCount > 0,
      };
    }

    return {
      success: true,
      message:
        ids.length === 1
          ? "Presentation deleted successfully"
          : `${deletedCount} presentations deleted successfully`,
    };
  } catch (error) {
    console.error("Failed to delete presentations:", error);
    return {
      success: false,
      message: "Failed to delete presentations",
    };
  }
}

export async function getPresentation(id: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  try {
    const doc = await s3GetPresentation(id);

    if (!doc) {
      return {
        success: false,
        message: "Presentation not found",
      };
    }

    return {
      success: true,
      presentation: transformToLegacyFormat(doc),
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to fetch presentation",
    };
  }
}

export async function getPresentationContent(id: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  try {
    const content = await s3GetPresentationContent(id);

    if (!content) {
      return {
        success: false,
        message: "Presentation not found",
      };
    }

    // Check if the user has access to this presentation
    if (content.userId !== session.user.id && !content.isPublic) {
      return {
        success: false,
        message: "Unauthorized access",
      };
    }

    return {
      success: true,
      presentation: {
        id,
        content: content.content,
        theme: content.theme,
        outline: [],
      },
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to fetch presentation",
    };
  }
}

export async function updatePresentationTheme(id: string, theme: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  try {
    const doc = await s3UpdatePresentation(id, session.user.id, { theme });

    if (!doc) {
      return {
        success: false,
        message: "Presentation not found or unauthorized",
      };
    }

    return {
      success: true,
      message: "Presentation theme updated successfully",
      presentation: doc.presentation,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to update presentation theme",
    };
  }
}

export async function duplicatePresentation(id: string, newTitle?: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  try {
    // Get the original presentation
    const original = await s3GetPresentation(id);

    if (!original) {
      return {
        success: false,
        message: "Original presentation not found",
      };
    }

    // Create a new presentation with the same content
    const duplicated = await s3CreatePresentation({
      userId: session.user.id,
      title: newTitle ?? `${original.base.title} (Copy)`,
      content: original.presentation.content as { slides: PlateSlide[] },
      theme: original.presentation.theme,
    });

    return {
      success: true,
      message: "Presentation duplicated successfully",
      presentation: transformToLegacyFormat(duplicated),
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to duplicate presentation",
    };
  }
}
