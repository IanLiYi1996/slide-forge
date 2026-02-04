"use server";
import "server-only";

import { auth } from "@/server/auth";
import {
  getUserPresentations,
  getPublicPresentations,
  getUserPublicPresentations,
  type DocumentWithPresentation,
} from "@/services/s3";

export interface PresentationDocument {
  id: string;
  title: string;
  type: string;
  userId: string;
  thumbnailUrl: string | null;
  isPublic: boolean;
  documentType: string;
  createdAt: Date;
  updatedAt: Date;
  presentation: {
    id: string;
    presentationMode: string;
    content: unknown;
    theme: string;
    imageSource: string;
    prompt: string | null;
    presentationStyle: string | null;
    language: string | null;
    outline: string[];
    searchResults: unknown;
    slideImages: unknown;
    templateId: string | null;
    customThemeId: string | null;
    generationStage: string | null;
    lastAccessedAt: Date | null;
    slidesGenerated: number | null;
    currentSlideIndex: number | null;
    exportedAt: Date | null;
    exportFormat: string | null;
    exportCount: number;
    exportHistory: unknown;
  } | null;
}

const ITEMS_PER_PAGE = 10;

function transformToLegacyFormat(doc: DocumentWithPresentation): PresentationDocument {
  return {
    id: doc.base.id,
    title: doc.base.title,
    type: doc.base.type,
    userId: doc.base.userId,
    thumbnailUrl: doc.base.thumbnailUrl ?? null,
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
      prompt: doc.presentation.prompt ?? null,
      presentationStyle: doc.presentation.presentationStyle ?? null,
      language: doc.presentation.language ?? null,
      outline: doc.presentation.outline,
      searchResults: doc.presentation.searchResults,
      slideImages: doc.presentation.slideImages,
      templateId: doc.presentation.templateId ?? null,
      customThemeId: doc.presentation.customThemeId ?? null,
      generationStage: doc.presentation.generationStage ?? null,
      lastAccessedAt: doc.presentation.lastAccessedAt
        ? new Date(doc.presentation.lastAccessedAt)
        : null,
      slidesGenerated: doc.presentation.slidesGenerated ?? null,
      currentSlideIndex: doc.presentation.currentSlideIndex ?? null,
      exportedAt: doc.presentation.exportedAt
        ? new Date(doc.presentation.exportedAt)
        : null,
      exportFormat: doc.presentation.exportFormat ?? null,
      exportCount: doc.presentation.exportCount,
      exportHistory: doc.presentation.exportHistory,
    },
  };
}

export async function fetchPresentations(page = 0) {
  const session = await auth();
  const userId = session?.user.id;

  if (!userId) {
    return {
      items: [],
      hasMore: false,
    };
  }

  const result = await getUserPresentations(userId, page, ITEMS_PER_PAGE);

  return {
    items: result.documents.map(transformToLegacyFormat),
    hasMore: result.hasMore,
  };
}

export async function fetchPublicPresentations(page = 0) {
  const result = await getPublicPresentations(page, ITEMS_PER_PAGE);

  // Note: We don't have user info in S3 documents directly
  // For now, return without user info - can be enhanced if needed
  return {
    items: result.documents.map(transformToLegacyFormat),
    hasMore: result.hasMore,
  };
}

export async function fetchUserPresentations(userId: string, page = 0) {
  const session = await auth();
  const currentUserId = session?.user.id;

  // If viewing own profile, show all presentations
  // Otherwise, show only public presentations
  if (currentUserId === userId) {
    const result = await getUserPresentations(userId, page, ITEMS_PER_PAGE);
    return {
      items: result.documents.map(transformToLegacyFormat),
      hasMore: result.hasMore,
    };
  }

  // Show only public presentations for other users
  const result = await getUserPublicPresentations(userId, page, ITEMS_PER_PAGE);
  return {
    items: result.documents.map(transformToLegacyFormat),
    hasMore: result.hasMore,
  };
}
