import { getObject, putObjectSimple, deleteObject, listAllObjects } from './s3-client';
import {
  addSessionToIndex,
  updateSessionInIndex,
  removeSessionFromIndex,
  getUserSessionsIndex,
  type SessionIndexEntry,
} from './index-service';

export type SessionStatus = 'active' | 'completed' | 'archived' | 'failed';
// WorkflowStage accepts all stages from the workflow enum plus any string for extensibility
export type WorkflowStage =
  | 'IDLE'
  | 'OUTLINE'
  | 'OUTLINE_GENERATION'
  | 'OUTLINE_CONFIRMATION'
  | 'OUTLINE_MODIFICATION'
  | 'SLIDES'
  | 'SLIDE_GENERATION'
  | 'SLIDE_CONFIRMATION'
  | 'SLIDE_MODIFICATION'
  | 'COMPLETED'
  | 'EXPORTED'
  | 'ERROR'
  | string;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface AgentSessionData {
  id: string;
  userId: string;
  sessionId: string;
  sdkSessionId?: string | null;
  title: string;
  messages: Message[];
  context?: unknown | null;
  generatedOutline: string[];
  generatedSlides?: unknown | null;
  presentationId?: string | null;
  status: SessionStatus;
  workflowStage: WorkflowStage;
  workflowState?: unknown | null;
  outline?: unknown | null;
  outlineTitle?: string | null;
  slides?: unknown | null;
  currentSlideIndex: number;
  modificationHistory?: unknown | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface DocumentProcessorSessionData {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  fileName?: string | null;
  fileType?: string | null;
  totalPages: number;
  processedPages: number;
  images?: unknown | null;
  processedImages?: unknown | null;
  instructions?: unknown | null;
  status: SessionStatus;
  exportedAt?: string | null;
  exportFormat?: string | null;
  exportCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

function getAgentSessionKey(sessionId: string): string {
  return `sessions/agent/${sessionId}.json`;
}

function getDocProcessorSessionKey(sessionId: string): string {
  return `sessions/doc-processor/${sessionId}.json`;
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `c${result}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==================== Agent Session Operations ====================

export async function createAgentSession(params: {
  userId: string;
  sessionId?: string;
  title?: string;
}): Promise<AgentSessionData> {
  const id = generateId();
  const sessionId = params.sessionId ?? generateUUID();
  const now = new Date().toISOString();

  const session: AgentSessionData = {
    id,
    userId: params.userId,
    sessionId,
    sdkSessionId: null,
    title: params.title ?? 'New Agent Session',
    messages: [],
    context: null,
    generatedOutline: [],
    generatedSlides: null,
    presentationId: null,
    status: 'active',
    workflowStage: 'IDLE',
    workflowState: null,
    outline: null,
    outlineTitle: null,
    slides: null,
    currentSlideIndex: 0,
    modificationHistory: null,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  };

  await putObjectSimple(getAgentSessionKey(sessionId), session);

  const indexEntry: SessionIndexEntry = {
    id,
    sessionId,
    title: session.title,
    status: session.status,
    type: 'agent',
    createdAt: now,
    updatedAt: now,
  };
  await addSessionToIndex(params.userId, indexEntry);

  return session;
}

export async function getAgentSession(sessionId: string): Promise<AgentSessionData | null> {
  return getObject<AgentSessionData>(getAgentSessionKey(sessionId));
}

export async function getAgentSessionByUserId(
  sessionId: string,
  userId: string
): Promise<AgentSessionData | null> {
  const session = await getAgentSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }
  return session;
}

export async function getAgentSessionBySdkId(sdkSessionId: string): Promise<AgentSessionData | null> {
  // This requires scanning all sessions - inefficient
  // Consider maintaining a sdkSessionId -> sessionId index if this is frequently needed
  const keys = await listAllObjects('sessions/agent/');

  for (const key of keys) {
    const sessionId = key.replace('sessions/agent/', '').replace('.json', '');
    const session = await getAgentSession(sessionId);
    if (session?.sdkSessionId === sdkSessionId) {
      return session;
    }
  }

  return null;
}

export async function updateAgentSession(
  sessionId: string,
  userId: string,
  updates: Partial<Omit<AgentSessionData, 'id' | 'userId' | 'sessionId' | 'createdAt'>>
): Promise<AgentSessionData | null> {
  const session = await getAgentSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedSession: AgentSessionData = {
    ...session,
    ...updates,
    updatedAt: now,
    lastActivityAt: now,
  };

  await putObjectSimple(getAgentSessionKey(sessionId), updatedSession);

  if (updates.title !== undefined || updates.status !== undefined) {
    await updateSessionInIndex(userId, sessionId, {
      title: updatedSession.title,
      status: updatedSession.status,
      updatedAt: now,
    });
  }

  return updatedSession;
}

export async function updateAgentSessionMessages(
  sessionId: string,
  userId: string,
  messages: Message[]
): Promise<AgentSessionData | null> {
  return updateAgentSession(sessionId, userId, { messages });
}

export async function saveAgentSessionOutline(
  sessionId: string,
  userId: string,
  outline: string[]
): Promise<AgentSessionData | null> {
  return updateAgentSession(sessionId, userId, { generatedOutline: outline });
}

export async function saveAgentSessionSlides(
  sessionId: string,
  userId: string,
  slides: unknown
): Promise<AgentSessionData | null> {
  return updateAgentSession(sessionId, userId, { generatedSlides: slides });
}

export async function updateAgentSessionStatus(
  sessionId: string,
  userId: string,
  status: SessionStatus
): Promise<AgentSessionData | null> {
  return updateAgentSession(sessionId, userId, { status });
}

export async function deleteAgentSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await getAgentSession(sessionId);
  if (!session || session.userId !== userId) {
    return false;
  }

  await deleteObject(getAgentSessionKey(sessionId));
  await removeSessionFromIndex(userId, sessionId);

  return true;
}

export async function getUserAgentSessions(
  userId: string,
  status?: SessionStatus
): Promise<AgentSessionData[]> {
  const index = await getUserSessionsIndex(userId);
  let sessions = index.sessions.filter((s) => s.type === 'agent');

  if (status) {
    sessions = sessions.filter((s) => s.status === status);
  }

  const sorted = sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const results = await Promise.all(
    sorted.map((s) => getAgentSession(s.sessionId))
  );

  return results.filter((s): s is AgentSessionData => s !== null);
}

export async function cleanupOldAgentSessions(
  userId: string,
  daysOld: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const sessions = await getUserAgentSessions(userId, 'archived');
  let deletedCount = 0;

  for (const session of sessions) {
    if (new Date(session.updatedAt) < cutoffDate) {
      await deleteAgentSession(session.sessionId, userId);
      deletedCount++;
    }
  }

  return deletedCount;
}

// ==================== Document Processor Session Operations ====================

export async function createDocProcessorSession(params: {
  userId: string;
  sessionId?: string;
  title?: string;
  fileName?: string;
  fileType?: string;
  totalPages?: number;
}): Promise<DocumentProcessorSessionData> {
  const id = generateId();
  const sessionId = params.sessionId ?? generateUUID();
  const now = new Date().toISOString();

  const session: DocumentProcessorSessionData = {
    id,
    userId: params.userId,
    sessionId,
    title: params.title ?? 'New Document Session',
    fileName: params.fileName ?? null,
    fileType: params.fileType ?? null,
    totalPages: params.totalPages ?? 0,
    processedPages: 0,
    images: null,
    processedImages: null,
    instructions: null,
    status: 'active',
    exportedAt: null,
    exportFormat: null,
    exportCount: 0,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  };

  await putObjectSimple(getDocProcessorSessionKey(sessionId), session);

  const indexEntry: SessionIndexEntry = {
    id,
    sessionId,
    title: session.title,
    status: session.status,
    type: 'doc-processor',
    createdAt: now,
    updatedAt: now,
  };
  await addSessionToIndex(params.userId, indexEntry);

  return session;
}

export async function getDocProcessorSession(
  sessionId: string
): Promise<DocumentProcessorSessionData | null> {
  return getObject<DocumentProcessorSessionData>(getDocProcessorSessionKey(sessionId));
}

export async function getDocProcessorSessionByUserId(
  sessionId: string,
  userId: string
): Promise<DocumentProcessorSessionData | null> {
  const session = await getDocProcessorSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }
  return session;
}

export async function updateDocProcessorSession(
  sessionId: string,
  userId: string,
  updates: Partial<Omit<DocumentProcessorSessionData, 'id' | 'userId' | 'sessionId' | 'createdAt'>>
): Promise<DocumentProcessorSessionData | null> {
  const session = await getDocProcessorSession(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedSession: DocumentProcessorSessionData = {
    ...session,
    ...updates,
    updatedAt: now,
    lastActivityAt: now,
  };

  await putObjectSimple(getDocProcessorSessionKey(sessionId), updatedSession);

  if (updates.title !== undefined || updates.status !== undefined) {
    await updateSessionInIndex(userId, sessionId, {
      title: updatedSession.title,
      status: updatedSession.status,
      updatedAt: now,
    });
  }

  return updatedSession;
}

export async function deleteDocProcessorSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const session = await getDocProcessorSession(sessionId);
  if (!session || session.userId !== userId) {
    return false;
  }

  await deleteObject(getDocProcessorSessionKey(sessionId));
  await removeSessionFromIndex(userId, sessionId);

  return true;
}

export async function getUserDocProcessorSessions(
  userId: string,
  status?: SessionStatus
): Promise<DocumentProcessorSessionData[]> {
  const index = await getUserSessionsIndex(userId);
  let sessions = index.sessions.filter((s) => s.type === 'doc-processor');

  if (status) {
    sessions = sessions.filter((s) => s.status === status);
  }

  const sorted = sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const results = await Promise.all(
    sorted.map((s) => getDocProcessorSession(s.sessionId))
  );

  return results.filter((s): s is DocumentProcessorSessionData => s !== null);
}
