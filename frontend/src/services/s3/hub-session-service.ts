/**
 * Smart Document Hub - Unified Session Service
 * Handles S3 persistence for all hub sessions (generate, process, extract modes)
 */

import { getObject, putObjectSimple, deleteObject, listAllObjects } from './s3-client';
import {
  addSessionToIndex,
  updateSessionInIndex,
  removeSessionFromIndex,
  type SessionIndexEntry,
} from './index-service';
import {
  type HubSession,
  type HubPage,
  type ProcessingMode,
  type HubSessionStatus,
  type InputMetadata,
  type GenerateConfig,
  type ProcessConfig,
  type ExtractConfig,
} from '@/types/smart-hub';

// Re-export types for convenience
export type { HubSession, HubPage, ProcessingMode, HubSessionStatus };

// ==================== Session Key Management ====================

function getHubSessionKey(sessionId: string): string {
  return `sessions/smart-hub/${sessionId}.json`;
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `hub${result}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ==================== Session CRUD Operations ====================

export interface CreateHubSessionParams {
  userId: string;
  sessionId?: string;
  mode: ProcessingMode;
  title?: string;
  inputMetadata?: InputMetadata;
  inputText?: string;
}

/**
 * Create a new Smart Document Hub session
 */
export async function createHubSession(
  params: CreateHubSessionParams
): Promise<HubSession> {
  const id = generateId();
  const sessionId = params.sessionId ?? generateUUID();
  const now = new Date().toISOString();

  // Initialize mode-specific config
  let generateConfig: GenerateConfig | undefined;
  let processConfig: ProcessConfig | undefined;
  let extractConfig: ExtractConfig | undefined;

  switch (params.mode) {
    case 'generate':
      generateConfig = {
        numberOfSlides: 10,
        language: 'en-US',
        tone: 'professional',
        style: 'professional',
        theme: 'default',
        aspectRatio: '16:9',
        imageSize: '2K',
        enableWebSearch: true,
      };
      break;
    case 'process':
      processConfig = {
        outputFormat: 'png',
        outputQuality: 90,
        preserveOriginals: true,
      };
      break;
    case 'extract':
      extractConfig = {
        extractionType: 'both',
        outputFormat: 'slides',
        preserveLayout: true,
        enhanceExtracted: false,
      };
      break;
  }

  const defaultInputMetadata: InputMetadata = params.inputMetadata ?? {
    type: 'text',
    hasText: true,
    hasImages: false,
    suggestedMode: params.mode,
    confidence: 1.0,
  };

  const session: HubSession = {
    id,
    sessionId,
    userId: params.userId,
    mode: params.mode,
    status: 'idle',
    title: params.title ?? getDefaultTitle(params.mode),
    inputMetadata: defaultInputMetadata,
    inputText: params.inputText || '',
    pages: [],
    currentPageIndex: 0,
    generateConfig,
    processConfig,
    extractConfig,
    exportCount: 0,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  };

  await putObjectSimple(getHubSessionKey(sessionId), session);

  // Add to user's session index with 'smart-hub' type
  const indexEntry: SessionIndexEntry = {
    id,
    sessionId,
    title: session.title,
    status: session.status,
    type: 'doc-processor', // Use existing type for backward compatibility in index
    createdAt: now,
    updatedAt: now,
  };
  await addSessionToIndex(params.userId, indexEntry);

  return session;
}

function getDefaultTitle(mode: ProcessingMode): string {
  switch (mode) {
    case 'generate':
      return 'New Presentation';
    case 'process':
      return 'Document Processing';
    case 'extract':
      return 'Content Extraction';
    default:
      return 'New Session';
  }
}

/**
 * Get a hub session by ID
 */
export async function getHubSession(sessionId: string): Promise<HubSession | null> {
  return getObject<HubSession>(getHubSessionKey(sessionId));
}

/**
 * Get a hub session with user verification
 */
export async function getHubSessionByUserId(
  sessionId: string,
  userId: string
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }
  return session;
}

/**
 * Update a hub session
 */
export async function updateHubSession(
  sessionId: string,
  userId: string,
  updates: Partial<
    Omit<HubSession, 'id' | 'userId' | 'sessionId' | 'createdAt'>
  >
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedSession: HubSession = {
    ...session,
    ...updates,
    updatedAt: now,
    lastActivityAt: now,
  };

  await putObjectSimple(getHubSessionKey(sessionId), updatedSession);

  // Update index if title or status changed
  if (updates.title !== undefined || updates.status !== undefined) {
    await updateSessionInIndex(userId, sessionId, {
      title: updatedSession.title,
      status: updatedSession.status,
      updatedAt: now,
    });
  }

  return updatedSession;
}

/**
 * Delete a hub session
 */
export async function deleteHubSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return false;
  }

  await deleteObject(getHubSessionKey(sessionId));
  await removeSessionFromIndex(userId, sessionId);

  return true;
}

/**
 * Get all hub sessions for a user
 */
export async function getUserHubSessions(
  userId: string,
  mode?: ProcessingMode
): Promise<HubSession[]> {
  // List all smart-hub sessions directly from S3
  const keys = await listAllObjects('sessions/smart-hub/');
  const sessions: HubSession[] = [];

  for (const key of keys) {
    const sessionId = key.replace('sessions/smart-hub/', '').replace('.json', '');
    const session = await getHubSession(sessionId);
    if (session && session.userId === userId) {
      if (!mode || session.mode === mode) {
        sessions.push(session);
      }
    }
  }

  // Sort by updated time, most recent first
  return sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ==================== Page Operations ====================

/**
 * Add a page to a session
 */
export async function addPageToSession(
  sessionId: string,
  userId: string,
  page: Omit<HubPage, 'id' | 'createdAt'>
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  const newPage: HubPage = {
    ...page,
    id: generateUUID(),
    createdAt: new Date().toISOString(),
  };

  const pages = [...session.pages, newPage];

  return updateHubSession(sessionId, userId, { pages });
}

/**
 * Update a specific page in a session
 */
export async function updatePageInSession(
  sessionId: string,
  userId: string,
  pageIndex: number,
  updates: Partial<Omit<HubPage, 'id' | 'createdAt'>>
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  if (pageIndex < 0 || pageIndex >= session.pages.length) {
    return null;
  }

  const pages = [...session.pages];
  const existingPage = pages[pageIndex]!;
  pages[pageIndex] = {
    ...existingPage,
    ...updates,
    id: existingPage.id,
    index: existingPage.index,
    sourceType: existingPage.sourceType,
    conversationHistory: updates.conversationHistory ?? existingPage.conversationHistory,
    modificationCount: updates.modificationCount ?? existingPage.modificationCount,
    createdAt: existingPage.createdAt,
    status: updates.status ?? existingPage.status,
    processedAt: updates.status === 'ready' ? new Date().toISOString() : existingPage.processedAt,
  };

  return updateHubSession(sessionId, userId, { pages });
}

/**
 * Initialize pages from text content (for generate mode)
 */
export async function initializePagesFromOutline(
  sessionId: string,
  userId: string,
  outline: string[],
  title?: string
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  const pages: HubPage[] = outline.map((content, index) => ({
    id: generateUUID(),
    index,
    sourceType: 'text' as const,
    textContent: content,
    status: 'pending' as const,
    conversationHistory: [],
    modificationCount: 0,
    createdAt: now,
  }));

  return updateHubSession(sessionId, userId, {
    pages,
    outline,
    outlineTitle: title,
    title: title || session.title, // Update main title if provided
    status: 'outline_generation',
  });
}

/**
 * Initialize pages from images (for process mode)
 */
export async function initializePagesFromImages(
  sessionId: string,
  userId: string,
  images: Array<{ dataUrl: string; width: number; height: number }>
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  const pages: HubPage[] = images.map((img, index) => ({
    id: generateUUID(),
    index,
    sourceType: 'image' as const,
    imageDataUrl: img.dataUrl,
    status: 'pending' as const,
    conversationHistory: [],
    modificationCount: 0,
    createdAt: now,
  }));

  return updateHubSession(sessionId, userId, {
    pages,
    status: 'page_processing',
    inputMetadata: {
      ...session.inputMetadata,
      pageCount: images.length,
    },
  });
}

// ==================== Status Management ====================

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string,
  userId: string,
  status: HubSessionStatus
): Promise<HubSession | null> {
  return updateHubSession(sessionId, userId, { status });
}

/**
 * Mark session as completed
 */
export async function completeSession(
  sessionId: string,
  userId: string
): Promise<HubSession | null> {
  return updateHubSession(sessionId, userId, { status: 'completed' });
}

/**
 * Mark session as error
 */
export async function setSessionError(
  sessionId: string,
  userId: string,
  errorMessage?: string
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  // Optionally store error message in the first page
  let pages = session.pages;
  if (errorMessage && pages.length > 0) {
    const firstPage = pages[0]!;
    pages = [
      {
        ...firstPage,
        errorMessage,
        status: 'error' as const,
      },
      ...pages.slice(1),
    ];
  }

  return updateHubSession(sessionId, userId, {
    status: 'error',
    pages,
  });
}

// ==================== Configuration Management ====================

/**
 * Update generate config
 */
export async function updateGenerateConfig(
  sessionId: string,
  userId: string,
  config: Partial<GenerateConfig>
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId || session.mode !== 'generate') {
    return null;
  }

  return updateHubSession(sessionId, userId, {
    generateConfig: {
      ...session.generateConfig!,
      ...config,
    },
  });
}

/**
 * Update process config
 */
export async function updateProcessConfig(
  sessionId: string,
  userId: string,
  config: Partial<ProcessConfig>
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId || session.mode !== 'process') {
    return null;
  }

  return updateHubSession(sessionId, userId, {
    processConfig: {
      ...session.processConfig!,
      ...config,
    },
  });
}

/**
 * Update extract config
 */
export async function updateExtractConfig(
  sessionId: string,
  userId: string,
  config: Partial<ExtractConfig>
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId || session.mode !== 'extract') {
    return null;
  }

  return updateHubSession(sessionId, userId, {
    extractConfig: {
      ...session.extractConfig!,
      ...config,
    },
  });
}

// ==================== Export Tracking ====================

/**
 * Record an export
 */
export async function recordExport(
  sessionId: string,
  userId: string,
  format: string
): Promise<HubSession | null> {
  const session = await getHubSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  return updateHubSession(sessionId, userId, {
    exportedAt: new Date().toISOString(),
    exportFormat: format,
    exportCount: session.exportCount + 1,
  });
}

// ==================== Cleanup Operations ====================

/**
 * Clean up old sessions
 */
export async function cleanupOldHubSessions(
  userId: string,
  daysOld: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const sessions = await getUserHubSessions(userId);
  let deletedCount = 0;

  for (const session of sessions) {
    if (
      session.status === 'completed' &&
      new Date(session.updatedAt) < cutoffDate
    ) {
      await deleteHubSession(session.sessionId, userId);
      deletedCount++;
    }
  }

  return deletedCount;
}
