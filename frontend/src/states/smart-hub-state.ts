/**
 * Smart Document Hub - Unified State Management
 * Uses Zustand to manage state for all processing modes
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  type HubSession,
  type HubPage,
  type ProcessingMode,
  type InputMetadata,
  type GenerateConfig,
} from '@/types/smart-hub';

// ==================== State Interface ====================

interface SmartHubState {
  // Current session
  currentSession: HubSession | null;
  isLoading: boolean;
  error: string | null;

  // Input state
  inputText: string;
  inputFile: File | null;
  inputMetadata: InputMetadata | null;

  // Mode selection
  selectedMode: ProcessingMode | null;
  modeConfidence: number;

  // Processing state
  isProcessing: boolean;
  processingMessage: string;
  processingProgress: number; // 0-100

  // Generation state (for generate mode)
  outline: string[];
  outlineTitle: string | null;
  isGeneratingOutline: boolean;

  // Page state
  currentPageIndex: number;
  isGeneratingPage: boolean;

  // Actions - Session Management
  createSession: (mode: ProcessingMode, title?: string) => Promise<string>;
  loadSession: (sessionId: string) => Promise<boolean>;
  updateSession: (updates: Partial<HubSession>) => Promise<boolean>;
  clearSession: () => void;

  // Actions - Input Management
  setInputText: (text: string) => void;
  setInputFile: (file: File | null) => void;
  setInputMetadata: (metadata: InputMetadata | null) => void;
  clearInput: () => void;

  // Actions - Mode Selection
  setSelectedMode: (mode: ProcessingMode) => void;
  detectMode: (file?: File, text?: string) => Promise<InputMetadata | null>;

  // Actions - Outline (Generate Mode)
  generateOutline: (text: string, config: GenerateConfig) => Promise<boolean>;
  setOutline: (outline: string[], title: string | null) => void;
  updateOutlineItem: (index: number, content: string) => void;
  addOutlineItem: (content: string, afterIndex?: number) => void;
  removeOutlineItem: (index: number) => void;
  confirmOutline: () => Promise<boolean>;

  // Actions - Page Management
  setCurrentPageIndex: (index: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  generatePage: (pageIndex: number, instruction?: string) => Promise<boolean>;
  processPage: (pageIndex: number, instruction: string) => Promise<boolean>;
  updatePage: (pageIndex: number, updates: Partial<HubPage>) => void;

  // Actions - Processing
  setProcessing: (isProcessing: boolean, message?: string) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;

  // Actions - Reset
  reset: () => void;
}

// ==================== Initial State ====================

const initialState = {
  currentSession: null,
  isLoading: false,
  error: null,

  inputText: '',
  inputFile: null,
  inputMetadata: null,

  selectedMode: null,
  modeConfidence: 0,

  isProcessing: false,
  processingMessage: '',
  processingProgress: 0,

  outline: [] as string[],
  outlineTitle: null as string | null,
  isGeneratingOutline: false,

  currentPageIndex: 0,
  isGeneratingPage: false,
};

// ==================== Store Implementation ====================

export const useSmartHubState = create<SmartHubState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ==================== Session Management ====================

      createSession: async (mode, title) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/smart-hub/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, title }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create session');
          }

          const { session } = await response.json();
          set({
            currentSession: session,
            selectedMode: mode,
            isLoading: false,
          });
          return session.sessionId;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
          });
          return '';
        }
      },

      loadSession: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/smart-hub/session/${sessionId}`);

          if (!response.ok) {
            if (response.status === 404) {
              set({ error: 'Session not found', isLoading: false });
              return false;
            }
            throw new Error('Failed to load session');
          }

          const { session } = await response.json();
          set({
            currentSession: session,
            selectedMode: session.mode,
            outline: session.outline || [],
            outlineTitle: session.outlineTitle || null,
            currentPageIndex: session.currentPageIndex || 0,
            isLoading: false,
          });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
          });
          return false;
        }
      },

      updateSession: async (updates) => {
        const { currentSession } = get();
        if (!currentSession) return false;

        try {
          const response = await fetch(
            `/api/smart-hub/session/${currentSession.sessionId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            }
          );

          if (!response.ok) {
            throw new Error('Failed to update session');
          }

          const { session } = await response.json();
          set({ currentSession: session });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return false;
        }
      },

      clearSession: () => {
        set({
          currentSession: null,
          outline: [],
          outlineTitle: null,
          currentPageIndex: 0,
        });
      },

      // ==================== Input Management ====================

      setInputText: (text) => set({ inputText: text }),

      setInputFile: (file) => set({ inputFile: file }),

      setInputMetadata: (metadata) =>
        set({
          inputMetadata: metadata,
          selectedMode: metadata?.suggestedMode || null,
          modeConfidence: metadata?.confidence || 0,
        }),

      clearInput: () =>
        set({
          inputText: '',
          inputFile: null,
          inputMetadata: null,
        }),

      // ==================== Mode Selection ====================

      setSelectedMode: (mode) => set({ selectedMode: mode }),

      detectMode: async (file, text) => {
        set({ isLoading: true });
        try {
          const formData = new FormData();
          if (file) {
            formData.append('file', file);
          }
          if (text) {
            formData.append('text', text);
          }

          const response = await fetch('/api/smart-hub/detect', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to detect input type');
          }

          const { metadata } = await response.json();
          set({
            inputMetadata: metadata,
            selectedMode: metadata.suggestedMode,
            modeConfidence: metadata.confidence,
            isLoading: false,
          });
          return metadata;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
          });
          return null;
        }
      },

      // ==================== Outline Management ====================

      generateOutline: async (text, config) => {
        const { currentSession } = get();
        if (!currentSession) return false;

        set({ isGeneratingOutline: true, error: null });
        try {
          const response = await fetch('/api/smart-hub/generate/outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: currentSession.sessionId,
              inputText: text,
              config,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to generate outline');
          }

          const { outline, title } = await response.json();
          set({
            outline,
            outlineTitle: title,
            isGeneratingOutline: false,
          });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isGeneratingOutline: false,
          });
          return false;
        }
      },

      setOutline: (outline, title) =>
        set({
          outline,
          outlineTitle: title,
        }),

      updateOutlineItem: (index, content) =>
        set((state) => {
          const newOutline = [...state.outline];
          if (index >= 0 && index < newOutline.length) {
            newOutline[index] = content;
          }
          return { outline: newOutline };
        }),

      addOutlineItem: (content, afterIndex) =>
        set((state) => {
          const newOutline = [...state.outline];
          const insertIndex =
            afterIndex !== undefined ? afterIndex + 1 : newOutline.length;
          newOutline.splice(insertIndex, 0, content);
          return { outline: newOutline };
        }),

      removeOutlineItem: (index) =>
        set((state) => {
          const newOutline = [...state.outline];
          if (index >= 0 && index < newOutline.length) {
            newOutline.splice(index, 1);
          }
          return { outline: newOutline };
        }),

      confirmOutline: async () => {
        const { currentSession, outline, outlineTitle } = get();
        if (!currentSession) return false;

        try {
          const response = await fetch(
            `/api/smart-hub/session/${currentSession.sessionId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                outline,
                outlineTitle,
                status: 'slide_generation',
              }),
            }
          );

          if (!response.ok) {
            throw new Error('Failed to confirm outline');
          }

          const { session } = await response.json();
          set({ currentSession: session });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return false;
        }
      },

      // ==================== Page Management ====================

      setCurrentPageIndex: (index) => {
        const { currentSession } = get();
        if (currentSession && index >= 0 && index < currentSession.pages.length) {
          set({ currentPageIndex: index });
        }
      },

      nextPage: () => {
        const { currentSession, currentPageIndex } = get();
        if (currentSession && currentPageIndex < currentSession.pages.length - 1) {
          set({ currentPageIndex: currentPageIndex + 1 });
        }
      },

      previousPage: () => {
        const { currentPageIndex } = get();
        if (currentPageIndex > 0) {
          set({ currentPageIndex: currentPageIndex - 1 });
        }
      },

      generatePage: async (pageIndex, instruction) => {
        const { currentSession, outline } = get();
        if (!currentSession) return false;

        set({ isGeneratingPage: true, error: null });
        try {
          const response = await fetch('/api/smart-hub/generate/slide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: currentSession.sessionId,
              pageIndex,
              content: outline[pageIndex] || '',
              instruction,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to generate page');
          }

          const { session } = await response.json();
          set({
            currentSession: session,
            isGeneratingPage: false,
          });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isGeneratingPage: false,
          });
          return false;
        }
      },

      processPage: async (pageIndex, instruction) => {
        const { currentSession } = get();
        if (!currentSession) return false;

        set({ isGeneratingPage: true, error: null });
        try {
          const page = currentSession.pages[pageIndex];
          if (!page || !page.imageDataUrl) {
            throw new Error('No image to process');
          }

          const response = await fetch('/api/smart-hub/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: currentSession.sessionId,
              pageIndex,
              imageDataUrl: page.imageDataUrl,
              instruction,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to process page');
          }

          const { session } = await response.json();
          set({
            currentSession: session,
            isGeneratingPage: false,
          });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isGeneratingPage: false,
          });
          return false;
        }
      },

      updatePage: (pageIndex, updates) =>
        set((state) => {
          if (!state.currentSession) return state;

          const pages = [...state.currentSession.pages];
          if (pageIndex >= 0 && pageIndex < pages.length) {
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
            };
          }

          return {
            currentSession: {
              ...state.currentSession,
              pages,
            },
          };
        }),

      // ==================== Processing State ====================

      setProcessing: (isProcessing, message = '') =>
        set({
          isProcessing,
          processingMessage: message,
          processingProgress: isProcessing ? 0 : 100,
        }),

      setProgress: (progress) => set({ processingProgress: progress }),

      setError: (error) => set({ error }),

      // ==================== Reset ====================

      reset: () => set(initialState),
    }),
    { name: 'smart-hub-state' }
  )
);

// ==================== Selector Hooks ====================

/**
 * Get current page from session
 */
export function useCurrentPage(): HubPage | null {
  return useSmartHubState((state) => {
    if (!state.currentSession) return null;
    return state.currentSession.pages[state.currentPageIndex] || null;
  });
}

/**
 * Get total page count
 */
export function usePageCount(): number {
  return useSmartHubState((state) => state.currentSession?.pages.length || 0);
}

/**
 * Check if on first page
 */
export function useIsFirstPage(): boolean {
  return useSmartHubState((state) => state.currentPageIndex === 0);
}

/**
 * Check if on last page
 */
export function useIsLastPage(): boolean {
  return useSmartHubState((state) => {
    if (!state.currentSession) return true;
    return state.currentPageIndex >= state.currentSession.pages.length - 1;
  });
}

/**
 * Get processing mode
 */
export function useProcessingMode(): ProcessingMode | null {
  return useSmartHubState((state) => state.currentSession?.mode || null);
}

/**
 * Check if all pages are ready
 */
export function useAllPagesReady(): boolean {
  return useSmartHubState((state) => {
    if (!state.currentSession) return false;
    return state.currentSession.pages.every((p) => p.status === 'ready');
  });
}
