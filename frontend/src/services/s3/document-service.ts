import { getObject, putObjectSimple, deleteObjects, listAllObjects } from './s3-client';
import {
  addDocumentToIndex,
  updateDocumentInIndex,
  removeDocumentFromIndex,
  getUserDocumentsIndex,
  getPublicDocumentsIndex,
  type DocumentIndexEntry,
} from './index-service';

export type DocumentType =
  | 'NOTE'
  | 'DOCUMENT'
  | 'DRAWING'
  | 'DESIGN'
  | 'STICKY_NOTES'
  | 'MIND_MAP'
  | 'RAG'
  | 'RESEARCH_PAPER'
  | 'FLIPBOOK'
  | 'PRESENTATION';

export type PresentationMode = 'TRADITIONAL' | 'PREZI';

export interface BaseDocumentData {
  id: string;
  title: string;
  type: DocumentType;
  userId: string;
  thumbnailUrl?: string | null;
  isPublic: boolean;
  documentType: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresentationData {
  id: string;
  presentationMode: PresentationMode;
  content: unknown; // {slides: PlateSlide[]}
  theme: string;
  imageSource: string;
  prompt?: string | null;
  presentationStyle?: string | null;
  language?: string | null;
  outline: string[];
  searchResults?: unknown | null;
  slideImages?: unknown | null;
  templateId?: string | null;
  customThemeId?: string | null;
  generationStage?: string | null;
  lastAccessedAt?: string | null;
  slidesGenerated?: number | null;
  currentSlideIndex?: number | null;
  exportedAt?: string | null;
  exportFormat?: string | null;
  exportCount: number;
  exportHistory?: unknown | null;
}

export interface DocumentWithPresentation {
  base: BaseDocumentData;
  presentation: PresentationData;
}

// Flat representation for easier access in consuming code
export interface FlatPresentation {
  id: string;
  title: string;
  type: DocumentType;
  userId: string;
  thumbnailUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  // Presentation fields
  presentationMode: PresentationMode;
  content: unknown;
  theme: string;
  outline: string[];
  presentationStyle: string | null;
  language: string | null;
  generationStage: string | null;
  slidesGenerated: number | null;
  lastAccessedAt: string | null;
}

// Helper to flatten DocumentWithPresentation
export function flattenPresentation(doc: DocumentWithPresentation): FlatPresentation {
  return {
    id: doc.base.id,
    title: doc.base.title,
    type: doc.base.type,
    userId: doc.base.userId,
    thumbnailUrl: doc.base.thumbnailUrl ?? null,
    isPublic: doc.base.isPublic,
    createdAt: doc.base.createdAt,
    updatedAt: doc.base.updatedAt,
    presentationMode: doc.presentation.presentationMode,
    content: doc.presentation.content,
    theme: doc.presentation.theme,
    outline: doc.presentation.outline,
    presentationStyle: doc.presentation.presentationStyle ?? null,
    language: doc.presentation.language ?? null,
    generationStage: doc.presentation.generationStage ?? null,
    slidesGenerated: doc.presentation.slidesGenerated ?? null,
    lastAccessedAt: doc.presentation.lastAccessedAt ?? null,
  };
}

function getDocumentMetadataKey(documentId: string): string {
  return `documents/${documentId}/metadata.json`;
}

function getDocumentContentKey(documentId: string): string {
  return `documents/${documentId}/content.json`;
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `c${result}`;
}

export async function createPresentation(params: {
  userId: string;
  title: string;
  content: unknown;
  theme?: string;
  outline?: string[];
  imageSource?: string;
  presentationStyle?: string;
  language?: string;
  prompt?: string;
  searchResults?: unknown;
}): Promise<DocumentWithPresentation> {
  const id = generateId();
  const now = new Date().toISOString();

  const base: BaseDocumentData = {
    id,
    title: params.title,
    type: 'PRESENTATION',
    userId: params.userId,
    thumbnailUrl: null,
    isPublic: false,
    documentType: 'PRESENTATION',
    createdAt: now,
    updatedAt: now,
  };

  const presentation: PresentationData = {
    id,
    presentationMode: 'TRADITIONAL',
    content: params.content,
    theme: params.theme ?? 'default',
    imageSource: params.imageSource ?? 'ai',
    prompt: params.prompt ?? null,
    presentationStyle: params.presentationStyle ?? null,
    language: params.language ?? 'en-US',
    outline: params.outline ?? [],
    searchResults: params.searchResults ?? null,
    slideImages: null,
    templateId: null,
    customThemeId: null,
    generationStage: 'outline',
    lastAccessedAt: now,
    slidesGenerated: 0,
    currentSlideIndex: 0,
    exportedAt: null,
    exportFormat: null,
    exportCount: 0,
    exportHistory: null,
  };

  const metadata: DocumentWithPresentation = {
    base,
    presentation: { ...presentation, content: undefined },
  };

  await Promise.all([
    putObjectSimple(getDocumentMetadataKey(id), metadata),
    putObjectSimple(getDocumentContentKey(id), { content: params.content }),
  ]);

  const indexEntry: DocumentIndexEntry = {
    id,
    title: params.title,
    type: 'PRESENTATION',
    thumbnailUrl: null,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };
  await addDocumentToIndex(params.userId, indexEntry);

  return { base, presentation };
}

export async function getPresentation(documentId: string): Promise<DocumentWithPresentation | null> {
  const [metadata, contentData] = await Promise.all([
    getObject<DocumentWithPresentation>(getDocumentMetadataKey(documentId)),
    getObject<{ content: unknown }>(getDocumentContentKey(documentId)),
  ]);

  if (!metadata) {
    return null;
  }

  return {
    base: metadata.base,
    presentation: {
      ...metadata.presentation,
      content: contentData?.content ?? metadata.presentation.content,
    },
  };
}

export async function getPresentationContent(documentId: string): Promise<{
  content: unknown;
  theme: string;
  slideImages: unknown;
  isPublic: boolean;
  userId: string;
} | null> {
  const [metadata, contentData] = await Promise.all([
    getObject<DocumentWithPresentation>(getDocumentMetadataKey(documentId)),
    getObject<{ content: unknown }>(getDocumentContentKey(documentId)),
  ]);

  if (!metadata) {
    return null;
  }

  return {
    content: contentData?.content ?? {},
    theme: metadata.presentation.theme,
    slideImages: metadata.presentation.slideImages,
    isPublic: metadata.base.isPublic,
    userId: metadata.base.userId,
  };
}

export async function updatePresentation(
  documentId: string,
  userId: string,
  updates: {
    title?: string;
    content?: unknown;
    theme?: string;
    outline?: string[];
    slideImages?: unknown;
    generationStage?: string;
    lastAccessedAt?: string;
    slidesGenerated?: number;
    currentSlideIndex?: number;
    exportedAt?: string;
    exportFormat?: string;
    exportCount?: number;
    exportHistory?: unknown;
    thumbnailUrl?: string;
    isPublic?: boolean;
    searchResults?: unknown;
  }
): Promise<DocumentWithPresentation | null> {
  const metadata = await getObject<DocumentWithPresentation>(getDocumentMetadataKey(documentId));

  if (!metadata || metadata.base.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();

  if (updates.title !== undefined) {
    metadata.base.title = updates.title;
  }
  if (updates.thumbnailUrl !== undefined) {
    metadata.base.thumbnailUrl = updates.thumbnailUrl;
  }
  if (updates.isPublic !== undefined) {
    metadata.base.isPublic = updates.isPublic;
  }
  metadata.base.updatedAt = now;

  if (updates.theme !== undefined) {
    metadata.presentation.theme = updates.theme;
  }
  if (updates.outline !== undefined) {
    metadata.presentation.outline = updates.outline;
  }
  if (updates.slideImages !== undefined) {
    metadata.presentation.slideImages = updates.slideImages;
  }
  if (updates.generationStage !== undefined) {
    metadata.presentation.generationStage = updates.generationStage;
  }
  if (updates.lastAccessedAt !== undefined) {
    metadata.presentation.lastAccessedAt = updates.lastAccessedAt;
  }
  if (updates.slidesGenerated !== undefined) {
    metadata.presentation.slidesGenerated = updates.slidesGenerated;
  }
  if (updates.currentSlideIndex !== undefined) {
    metadata.presentation.currentSlideIndex = updates.currentSlideIndex;
  }
  if (updates.exportedAt !== undefined) {
    metadata.presentation.exportedAt = updates.exportedAt;
  }
  if (updates.exportFormat !== undefined) {
    metadata.presentation.exportFormat = updates.exportFormat;
  }
  if (updates.exportCount !== undefined) {
    metadata.presentation.exportCount = updates.exportCount;
  }
  if (updates.exportHistory !== undefined) {
    metadata.presentation.exportHistory = updates.exportHistory;
  }
  if (updates.searchResults !== undefined) {
    metadata.presentation.searchResults = updates.searchResults;
  }

  const contentUpdates = updates.content !== undefined;

  await Promise.all([
    putObjectSimple(getDocumentMetadataKey(documentId), metadata),
    ...(contentUpdates
      ? [putObjectSimple(getDocumentContentKey(documentId), { content: updates.content })]
      : []),
  ]);

  await updateDocumentInIndex(userId, documentId, {
    title: metadata.base.title,
    thumbnailUrl: metadata.base.thumbnailUrl,
    isPublic: metadata.base.isPublic,
    updatedAt: now,
  });

  let content = updates.content;
  if (!contentUpdates) {
    const contentData = await getObject<{ content: unknown }>(getDocumentContentKey(documentId));
    content = contentData?.content;
  }

  return {
    base: metadata.base,
    presentation: {
      ...metadata.presentation,
      content,
    },
  };
}

export async function deletePresentation(documentId: string, userId: string): Promise<boolean> {
  const metadata = await getObject<DocumentWithPresentation>(getDocumentMetadataKey(documentId));

  if (!metadata || metadata.base.userId !== userId) {
    return false;
  }

  await deleteObjects([
    getDocumentMetadataKey(documentId),
    getDocumentContentKey(documentId),
  ]);

  await removeDocumentFromIndex(userId, documentId);

  return true;
}

export async function deletePresentations(documentIds: string[], userId: string): Promise<number> {
  let deletedCount = 0;

  for (const documentId of documentIds) {
    const deleted = await deletePresentation(documentId, userId);
    if (deleted) {
      deletedCount++;
    }
  }

  return deletedCount;
}

export async function getUserPresentations(
  userId: string,
  page: number = 0,
  pageSize: number = 10
): Promise<{
  documents: DocumentWithPresentation[];
  total: number;
  hasMore: boolean;
}> {
  const index = await getUserDocumentsIndex(userId);
  const sorted = index.documents
    .filter((d) => d.type === 'PRESENTATION')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = sorted.slice(start, end);

  const documents = await Promise.all(
    pageItems.map(async (item) => {
      const doc = await getPresentation(item.id);
      return doc;
    })
  );

  const validDocuments = documents.filter((d): d is DocumentWithPresentation => d !== null);

  return {
    documents: validDocuments,
    total: sorted.length,
    hasMore: end < sorted.length,
  };
}

export async function getPublicPresentations(
  page: number = 0,
  pageSize: number = 10
): Promise<{
  documents: DocumentWithPresentation[];
  total: number;
  hasMore: boolean;
}> {
  const index = await getPublicDocumentsIndex();
  const sorted = index.documents
    .filter((d) => d.type === 'PRESENTATION')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = sorted.slice(start, end);

  const documents = await Promise.all(
    pageItems.map(async (item) => {
      const doc = await getPresentation(item.id);
      return doc;
    })
  );

  const validDocuments = documents.filter((d): d is DocumentWithPresentation => d !== null);

  return {
    documents: validDocuments,
    total: sorted.length,
    hasMore: end < sorted.length,
  };
}

export async function getUserPublicPresentations(
  userId: string,
  page: number = 0,
  pageSize: number = 10
): Promise<{
  documents: DocumentWithPresentation[];
  total: number;
  hasMore: boolean;
}> {
  const index = await getUserDocumentsIndex(userId);
  const sorted = index.documents
    .filter((d) => d.type === 'PRESENTATION' && d.isPublic)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = sorted.slice(start, end);

  const documents = await Promise.all(
    pageItems.map(async (item) => {
      const doc = await getPresentation(item.id);
      return doc;
    })
  );

  const validDocuments = documents.filter((d): d is DocumentWithPresentation => d !== null);

  return {
    documents: validDocuments,
    total: sorted.length,
    hasMore: end < sorted.length,
  };
}
