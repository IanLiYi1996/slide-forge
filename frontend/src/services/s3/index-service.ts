import {
  getObject,
  withOptimisticLock,
} from './s3-client';

export interface DocumentIndexEntry {
  id: string;
  title: string;
  type: string;
  thumbnailUrl?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDocumentsIndex {
  userId: string;
  documents: DocumentIndexEntry[];
  updatedAt: string;
}

export interface SessionIndexEntry {
  id: string;
  sessionId: string;
  title?: string;
  status: string;
  type: 'agent' | 'doc-processor';
  createdAt: string;
  updatedAt: string;
}

export interface UserSessionsIndex {
  userId: string;
  sessions: SessionIndexEntry[];
  updatedAt: string;
}

export interface PublicDocumentsIndex {
  documents: DocumentIndexEntry[];
  updatedAt: string;
}

function getUserDocumentsKey(userId: string): string {
  return `indexes/documents-by-user/${userId}.json`;
}

function getUserSessionsKey(userId: string): string {
  return `indexes/sessions-by-user/${userId}.json`;
}

const PUBLIC_DOCUMENTS_KEY = 'indexes/public-documents.json';

export async function getUserDocumentsIndex(
  userId: string
): Promise<UserDocumentsIndex> {
  const data = await getObject<UserDocumentsIndex>(getUserDocumentsKey(userId));
  return data ?? {
    userId,
    documents: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function addDocumentToIndex(
  userId: string,
  document: DocumentIndexEntry
): Promise<void> {
  await withOptimisticLock<UserDocumentsIndex, void>(
    getUserDocumentsKey(userId),
    async (existing) => {
      const index = existing ?? {
        userId,
        documents: [],
        updatedAt: new Date().toISOString(),
      };

      const existingIdx = index.documents.findIndex((d) => d.id === document.id);
      if (existingIdx >= 0) {
        index.documents[existingIdx] = document;
      } else {
        index.documents.unshift(document);
      }
      index.updatedAt = new Date().toISOString();

      return { newData: index, result: undefined };
    }
  );

  if (document.isPublic) {
    await addToPublicDocumentsIndex(document);
  }
}

export async function updateDocumentInIndex(
  userId: string,
  documentId: string,
  updates: Partial<DocumentIndexEntry>
): Promise<void> {
  let wasPublic = false;
  let isNowPublic = false;

  await withOptimisticLock<UserDocumentsIndex, void>(
    getUserDocumentsKey(userId),
    async (existing) => {
      const index = existing ?? {
        userId,
        documents: [],
        updatedAt: new Date().toISOString(),
      };

      const docIdx = index.documents.findIndex((d) => d.id === documentId);
      if (docIdx >= 0) {
        const existingDoc = index.documents[docIdx]!;
        wasPublic = existingDoc.isPublic;
        const updatedDoc: DocumentIndexEntry = { ...existingDoc, ...updates };
        index.documents[docIdx] = updatedDoc;
        isNowPublic = updatedDoc.isPublic;
      }
      index.updatedAt = new Date().toISOString();

      return { newData: index, result: undefined };
    }
  );

  if (wasPublic && !isNowPublic) {
    await removeFromPublicDocumentsIndex(documentId);
  } else if (!wasPublic && isNowPublic) {
    const userIndex = await getUserDocumentsIndex(userId);
    const doc = userIndex.documents.find((d) => d.id === documentId);
    if (doc) {
      await addToPublicDocumentsIndex(doc);
    }
  } else if (wasPublic && isNowPublic) {
    const userIndex = await getUserDocumentsIndex(userId);
    const doc = userIndex.documents.find((d) => d.id === documentId);
    if (doc) {
      await updatePublicDocumentInIndex(doc);
    }
  }
}

export async function removeDocumentFromIndex(
  userId: string,
  documentId: string
): Promise<void> {
  let wasPublic = false;

  await withOptimisticLock<UserDocumentsIndex, void>(
    getUserDocumentsKey(userId),
    async (existing) => {
      const index = existing ?? {
        userId,
        documents: [],
        updatedAt: new Date().toISOString(),
      };

      const docIdx = index.documents.findIndex((d) => d.id === documentId);
      if (docIdx >= 0) {
        wasPublic = index.documents[docIdx]!.isPublic;
        index.documents.splice(docIdx, 1);
      }
      index.updatedAt = new Date().toISOString();

      return { newData: index, result: undefined };
    }
  );

  if (wasPublic) {
    await removeFromPublicDocumentsIndex(documentId);
  }
}

export async function getPublicDocumentsIndex(): Promise<PublicDocumentsIndex> {
  const data = await getObject<PublicDocumentsIndex>(PUBLIC_DOCUMENTS_KEY);
  return data ?? {
    documents: [],
    updatedAt: new Date().toISOString(),
  };
}

async function addToPublicDocumentsIndex(
  document: DocumentIndexEntry
): Promise<void> {
  await withOptimisticLock<PublicDocumentsIndex, void>(
    PUBLIC_DOCUMENTS_KEY,
    async (existing) => {
      const index = existing ?? {
        documents: [],
        updatedAt: new Date().toISOString(),
      };

      const existingIdx = index.documents.findIndex((d) => d.id === document.id);
      if (existingIdx >= 0) {
        index.documents[existingIdx] = document;
      } else {
        index.documents.unshift(document);
      }
      index.updatedAt = new Date().toISOString();

      return { newData: index, result: undefined };
    }
  );
}

async function updatePublicDocumentInIndex(
  document: DocumentIndexEntry
): Promise<void> {
  await addToPublicDocumentsIndex(document);
}

async function removeFromPublicDocumentsIndex(documentId: string): Promise<void> {
  await withOptimisticLock<PublicDocumentsIndex, void>(
    PUBLIC_DOCUMENTS_KEY,
    async (existing) => {
      const index = existing ?? {
        documents: [],
        updatedAt: new Date().toISOString(),
      };

      index.documents = index.documents.filter((d) => d.id !== documentId);
      index.updatedAt = new Date().toISOString();

      return { newData: index, result: undefined };
    }
  );
}

export async function getUserSessionsIndex(
  userId: string
): Promise<UserSessionsIndex> {
  const data = await getObject<UserSessionsIndex>(getUserSessionsKey(userId));
  return data ?? {
    userId,
    sessions: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function addSessionToIndex(
  userId: string,
  session: SessionIndexEntry
): Promise<void> {
  await withOptimisticLock<UserSessionsIndex, void>(
    getUserSessionsKey(userId),
    async (existing) => {
      const index = existing ?? {
        userId,
        sessions: [],
        updatedAt: new Date().toISOString(),
      };

      const existingIdx = index.sessions.findIndex((s) => s.sessionId === session.sessionId);
      if (existingIdx >= 0) {
        index.sessions[existingIdx] = session;
      } else {
        index.sessions.unshift(session);
      }
      index.updatedAt = new Date().toISOString();

      return { newData: index, result: undefined };
    }
  );
}

export async function updateSessionInIndex(
  userId: string,
  sessionId: string,
  updates: Partial<SessionIndexEntry>
): Promise<void> {
  await withOptimisticLock<UserSessionsIndex, void>(
    getUserSessionsKey(userId),
    async (existing) => {
      const index = existing ?? {
        userId,
        sessions: [],
        updatedAt: new Date().toISOString(),
      };

      const sessionIdx = index.sessions.findIndex((s) => s.sessionId === sessionId);
      if (sessionIdx >= 0) {
        const existingSession = index.sessions[sessionIdx]!;
        const updatedSession: SessionIndexEntry = { ...existingSession, ...updates };
        index.sessions[sessionIdx] = updatedSession;
      }
      index.updatedAt = new Date().toISOString();

      return { newData: index, result: undefined };
    }
  );
}

export async function removeSessionFromIndex(
  userId: string,
  sessionId: string
): Promise<void> {
  await withOptimisticLock<UserSessionsIndex, void>(
    getUserSessionsKey(userId),
    async (existing) => {
      const index = existing ?? {
        userId,
        sessions: [],
        updatedAt: new Date().toISOString(),
      };

      index.sessions = index.sessions.filter((s) => s.sessionId !== sessionId);
      index.updatedAt = new Date().toISOString();

      return { newData: index, result: undefined };
    }
  );
}
