"use server";

import { auth } from "@/server/auth";
import {
  getPresentation,
  getPresentationContent,
  updatePresentation,
  getUserProfile,
} from "@/services/s3";

/**
 * Get a public presentation without requiring authentication
 * This is used for the shared presentation view
 */
export async function getSharedPresentation(id: string) {
  try {
    const presentation = await getPresentation(id);

    if (!presentation || !presentation.base.isPublic) {
      return {
        success: false,
        message: "Presentation not found or not public",
      };
    }

    // Get the presentation content
    const content = await getPresentationContent(id);

    // Get user info for the presentation author
    const userProfile = await getUserProfile(presentation.base.userId);

    return {
      success: true,
      presentation: {
        id: presentation.base.id,
        title: presentation.base.title,
        createdAt: presentation.base.createdAt,
        updatedAt: presentation.base.updatedAt,
        isPublic: presentation.base.isPublic,
        content: content,
        theme: presentation.presentation.theme,
        outline: presentation.presentation.outline,
        presentationStyle: presentation.presentation.presentationStyle,
        language: presentation.presentation.language,
        user: userProfile
          ? {
              name: userProfile.name,
              image: userProfile.image,
            }
          : null,
      },
    };
  } catch (error) {
    console.error("Error fetching shared presentation:", error);
    return {
      success: false,
      message: "Failed to fetch presentation",
    };
  }
}

/**
 * Toggle the public status of a presentation
 */
export async function togglePresentationPublicStatus(
  id: string,
  isPublic: boolean,
) {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      message: "Unauthorized",
    };
  }

  try {
    // Get current presentation to verify ownership
    const presentation = await getPresentation(id);

    if (!presentation) {
      return {
        success: false,
        message: "Presentation not found",
      };
    }

    if (presentation.base.userId !== session.user.id) {
      return {
        success: false,
        message: "Not authorized to update this presentation",
      };
    }

    // Update the public status
    const updated = await updatePresentation(id, session.user.id, { isPublic });

    if (!updated) {
      return {
        success: false,
        message: "Failed to update presentation public status",
      };
    }

    return {
      success: true,
      message: isPublic
        ? "Presentation is now publicly accessible"
        : "Presentation is now private",
      presentation: updated,
    };
  } catch (error) {
    console.error("Error updating presentation public status:", error);
    return {
      success: false,
      message: "Failed to update presentation public status",
    };
  }
}
