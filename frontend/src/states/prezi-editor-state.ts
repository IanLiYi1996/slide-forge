/**
 * Prezi Editor State Management
 *
 * Zustand store for managing Prezi canvas editor state, including:
 * - Canvas data (elements, paths)
 * - Selection and interaction
 * - Camera state
 * - History (undo/redo)
 * - Playback state
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  type PreziCanvasData,
  type PreziElement,
  type CameraState,
  type PreziEditorMode,
  type PreziEditorState,
  PREZI_DEFAULTS,
} from "@/types/prezi-types";

/**
 * Maximum history length for undo/redo
 */
const MAX_HISTORY_LENGTH = 50;

/**
 * Create initial canvas data
 */
export const createInitialCanvasData = (): PreziCanvasData => ({
  version: "1.0",
  canvas: {
    backgroundColor: PREZI_DEFAULTS.CANVAS.BACKGROUND_COLOR,
    backgroundImage: undefined,
    gridEnabled: PREZI_DEFAULTS.CANVAS.GRID_ENABLED,
    gridSize: PREZI_DEFAULTS.CANVAS.GRID_SIZE,
  },
  elements: {},
  paths: [
    {
      id: "default-path",
      name: "Main Path",
      keyframes: [],
      loop: false,
    },
  ],
  activePath: "default-path",
  camera: {
    defaultPosition: PREZI_DEFAULTS.CAMERA.POSITION,
    defaultZoom: PREZI_DEFAULTS.CAMERA.ZOOM,
  },
});

/**
 * Prezi editor store
 */
export const usePreziEditorStore = create<PreziEditorState>()(
  immer((set, get) => ({
    // ==================== Initial State ====================
    canvasData: null,
    selectedElements: [],
    hoveredElement: null,
    mode: "select",
    isPlaying: false,
    currentKeyframeIndex: 0,
    camera: {
      position: PREZI_DEFAULTS.CAMERA.POSITION,
      target: PREZI_DEFAULTS.CAMERA.TARGET,
      zoom: PREZI_DEFAULTS.CAMERA.ZOOM,
    },
    history: {
      past: [],
      future: [],
    },

    // ==================== Actions ====================

    /**
     * Set canvas data (replaces entire canvas)
     */
    setCanvasData: (data: PreziCanvasData) => {
      set((state) => {
        // Save current state to history before replacing
        if (state.canvasData) {
          state.history.past.push(state.canvasData);
          if (state.history.past.length > MAX_HISTORY_LENGTH) {
            state.history.past.shift();
          }
        }
        state.canvasData = data;
        state.history.future = []; // Clear redo stack
      });
    },

    /**
     * Add element to canvas
     */
    addElement: (element: PreziElement) => {
      set((state) => {
        if (!state.canvasData) return;

        // Save to history
        state.history.past.push(JSON.parse(JSON.stringify(state.canvasData)));
        if (state.history.past.length > MAX_HISTORY_LENGTH) {
          state.history.past.shift();
        }

        // Add element
        state.canvasData.elements[element.id] = element;
        state.history.future = [];
      });
    },

    /**
     * Update element properties
     */
    updateElement: (id: string, updates: Partial<PreziElement>) => {
      set((state) => {
        if (!state.canvasData || !state.canvasData.elements[id]) return;

        // Save to history
        state.history.past.push(JSON.parse(JSON.stringify(state.canvasData)));
        if (state.history.past.length > MAX_HISTORY_LENGTH) {
          state.history.past.shift();
        }

        // Update element
        state.canvasData.elements[id] = {
          ...state.canvasData.elements[id]!,
          ...updates,
        } as typeof state.canvasData.elements[typeof id];
        state.history.future = [];
      });
    },

    /**
     * Delete element from canvas
     */
    deleteElement: (id: string) => {
      set((state) => {
        if (!state.canvasData || !state.canvasData.elements[id]) return;

        // Save to history
        state.history.past.push(JSON.parse(JSON.stringify(state.canvasData)));
        if (state.history.past.length > MAX_HISTORY_LENGTH) {
          state.history.past.shift();
        }

        // Delete element
        delete state.canvasData.elements[id];

        // Remove from selection if selected
        state.selectedElements = state.selectedElements.filter(
          (elemId) => elemId !== id
        );

        state.history.future = [];
      });
    },

    /**
     * Select elements
     */
    selectElements: (ids: string[]) => {
      set((state) => {
        state.selectedElements = ids;
      });
    },

    /**
     * Set editor mode
     */
    setMode: (mode: PreziEditorMode) => {
      set((state) => {
        state.mode = mode;
      });
    },

    /**
     * Update camera state
     */
    updateCamera: (camera: CameraState) => {
      set((state) => {
        state.camera = camera;
      });
    },

    /**
     * Set current keyframe index
     */
    setCurrentKeyframeIndex: (index: number) => {
      set((state) => {
        state.currentKeyframeIndex = index;
      });
    },

    /**
     * Play path animation
     */
    playPath: (pathId: string) => {
      set((state) => {
        if (!state.canvasData) return;

        const path = state.canvasData.paths.find((p) => p.id === pathId);
        if (!path || path.keyframes.length === 0) return;

        state.isPlaying = true;
        state.currentKeyframeIndex = 0;
        state.canvasData.activePath = pathId;
      });
    },

    /**
     * Stop playing
     */
    stopPlaying: () => {
      set((state) => {
        state.isPlaying = false;
      });
    },

    /**
     * Undo last action
     */
    undo: () => {
      set((state) => {
        if (state.history.past.length === 0 || !state.canvasData) return;

        const previous = state.history.past.pop()!;
        state.history.future.push(JSON.parse(JSON.stringify(state.canvasData)));
        state.canvasData = previous;
      });
    },

    /**
     * Redo last undone action
     */
    redo: () => {
      set((state) => {
        if (state.history.future.length === 0 || !state.canvasData) return;

        const next = state.history.future.pop()!;
        state.history.past.push(JSON.parse(JSON.stringify(state.canvasData)));
        state.canvasData = next;
      });
    },
  }))
);

// ==================== Helper Hooks ====================

/**
 * Get current active path
 */
export const useActivePath = () => {
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  if (!canvasData) return null;
  return canvasData.paths.find((p) => p.id === canvasData.activePath) ?? null;
};

/**
 * Get all elements as array
 */
export const useElementsArray = () => {
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  if (!canvasData) return [];
  return Object.values(canvasData.elements);
};

/**
 * Get selected elements data
 */
export const useSelectedElementsData = () => {
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const selectedIds = usePreziEditorStore((state) => state.selectedElements);
  if (!canvasData) return [];
  return selectedIds
    .map((id) => canvasData.elements[id])
    .filter(Boolean) as PreziElement[];
};

/**
 * Check if can undo
 */
export const useCanUndo = () => {
  const history = usePreziEditorStore((state) => state.history);
  return history.past.length > 0;
};

/**
 * Check if can redo
 */
export const useCanRedo = () => {
  const history = usePreziEditorStore((state) => state.history);
  return history.future.length > 0;
};

// ==================== Utility Functions ====================

/**
 * Generate unique element ID
 */
export const generateElementId = (type: string): string => {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate unique keyframe ID
 */
export const generateKeyframeId = (): string => {
  return `keyframe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate unique path ID
 */
export const generatePathId = (): string => {
  return `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
