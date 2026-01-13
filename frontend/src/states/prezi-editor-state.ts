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
     * Resume playback from current position
     */
    resumePlayback: () => {
      set((state) => {
        state.isPlaying = true;
        // ✨ Don't reset currentKeyframeIndex - resume from current position
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

// ==================== Element-Keyframe Association Utilities ====================

/**
 * Add element to keyframe (bi-directional update)
 * Updates both element.keyframeIds and keyframe.visibleElements
 *
 * @param elementId - Element ID to add
 * @param keyframeId - Keyframe ID to add to
 */
export const addElementToKeyframe = (
  elementId: string,
  keyframeId: string
): void => {
  const state = usePreziEditorStore.getState();
  const { canvasData } = state;

  if (!canvasData) return;

  // Find the element
  const element = canvasData.elements[elementId];
  if (!element) {
    console.warn(`Element ${elementId} not found`);
    return;
  }

  // Find the active path
  const activePath = canvasData.paths.find((p) => p.id === canvasData.activePath);
  if (!activePath) return;

  // Find the keyframe index
  const keyframeIndex = activePath.keyframes.findIndex((kf) => kf.id === keyframeId);
  if (keyframeIndex === -1) {
    console.warn(`Keyframe ${keyframeId} not found`);
    return;
  }

  // Update element's keyframeIds
  const currentKeyframeIds = element.keyframeIds || [];
  if (currentKeyframeIds.includes(keyframeId)) {
    console.log(`Element ${elementId} already in keyframe ${keyframeId}`);
    return; // Already added
  }

  // Update state using immer-safe way
  usePreziEditorStore.setState((state) => {
    if (!state.canvasData) return;

    // Save to history
    state.history.past.push(JSON.parse(JSON.stringify(state.canvasData)));
    if (state.history.past.length > MAX_HISTORY_LENGTH) {
      state.history.past.shift();
    }

    // Find the path and keyframe in the draft state
    const pathIndex = state.canvasData.paths.findIndex((p) => p.id === state.canvasData!.activePath);
    if (pathIndex === -1) return;

    const path = state.canvasData.paths[pathIndex];
    if (!path) return;

    const kfIndex = path.keyframes.findIndex((kf) => kf.id === keyframeId);
    if (kfIndex === -1) return;

    const keyframe = path.keyframes[kfIndex];
    if (!keyframe) return;

    // Update element's keyframeIds (immer-safe)
    const el = state.canvasData.elements[elementId];
    if (el) {
      const newKeyframeIds = [...(el.keyframeIds || []), keyframeId];
      el.keyframeIds = newKeyframeIds;
    }

    // Update keyframe's visibleElements (immer-safe)
    const currentVisibleElements = keyframe.visibleElements || [];
    if (!currentVisibleElements.includes(elementId)) {
      keyframe.visibleElements = [...currentVisibleElements, elementId];
    }

    state.history.future = [];

    console.log(`[addElementToKeyframe] Added element ${elementId} to keyframe ${keyframeId}`);
  });
};

/**
 * Remove element from keyframe (bi-directional update)
 * Updates both element.keyframeIds and keyframe.visibleElements
 *
 * @param elementId - Element ID to remove
 * @param keyframeId - Keyframe ID to remove from
 */
export const removeElementFromKeyframe = (
  elementId: string,
  keyframeId: string
): void => {
  const state = usePreziEditorStore.getState();
  const { canvasData } = state;

  if (!canvasData) return;

  // Find the element
  const element = canvasData.elements[elementId];
  if (!element) return;

  // Find the active path
  const activePath = canvasData.paths.find((p) => p.id === canvasData.activePath);
  if (!activePath) return;

  // Find the keyframe index
  const keyframeIndex = activePath.keyframes.findIndex((kf) => kf.id === keyframeId);
  if (keyframeIndex === -1) return;

  usePreziEditorStore.setState((state) => {
    if (!state.canvasData) return;

    // Save to history
    state.history.past.push(JSON.parse(JSON.stringify(state.canvasData)));
    if (state.history.past.length > MAX_HISTORY_LENGTH) {
      state.history.past.shift();
    }

    // Find the path and keyframe in the draft state
    const pathIndex = state.canvasData.paths.findIndex((p) => p.id === state.canvasData!.activePath);
    if (pathIndex === -1) return;

    const path = state.canvasData.paths[pathIndex];
    if (!path) return;

    const kfIndex = path.keyframes.findIndex((kf) => kf.id === keyframeId);
    if (kfIndex === -1) return;

    const keyframe = path.keyframes[kfIndex];
    if (!keyframe) return;

    // Remove from element's keyframeIds (immer-safe)
    const el = state.canvasData.elements[elementId];
    if (el) {
      const currentKeyframeIds = el.keyframeIds || [];
      el.keyframeIds = currentKeyframeIds.filter((id) => id !== keyframeId);
    }

    // Remove from keyframe's visibleElements (immer-safe)
    const currentVisibleElements = keyframe.visibleElements || [];
    keyframe.visibleElements = currentVisibleElements.filter((id) => id !== elementId);

    state.history.future = [];

    console.log(`[removeElementFromKeyframe] Removed element ${elementId} from keyframe ${keyframeId}`);
  });
};

/**
 * Get elements grouped by keyframe
 * Returns a map of keyframeId -> element[]
 */
export const getElementsByKeyframe = (): Map<string, PreziElement[]> => {
  const state = usePreziEditorStore.getState();
  const { canvasData } = state;

  const groupedElements = new Map<string, PreziElement[]>();

  if (!canvasData) return groupedElements;

  const activePath = canvasData.paths.find((p) => p.id === canvasData.activePath);
  if (!activePath) return groupedElements;

  // Group elements by keyframe
  activePath.keyframes.forEach((keyframe) => {
    const elementsInKeyframe: PreziElement[] = [];

    Object.values(canvasData.elements).forEach((element) => {
      const elementKeyframes = element.keyframeIds || [];
      if (elementKeyframes.includes(keyframe.id)) {
        elementsInKeyframe.push(element);
      }
    });

    groupedElements.set(keyframe.id, elementsInKeyframe);
  });

  return groupedElements;
};

/**
 * Get ungrouped elements (elements not assigned to any keyframe)
 */
export const getUngroupedElements = (): PreziElement[] => {
  const state = usePreziEditorStore.getState();
  const { canvasData } = state;

  if (!canvasData) return [];

  const allElements = Object.values(canvasData.elements);

  // Filter elements that have no keyframeIds or empty keyframeIds
  return allElements.filter((element) => {
    const keyframeIds = element.keyframeIds || [];
    return keyframeIds.length === 0;
  });
};

// ==================== Version Migration ====================

/**
 * Migrate canvas data from version 1.0 to 1.1
 * Adds keyframeIds and visibleElements for backward compatibility
 *
 * @param data - Canvas data to migrate
 * @returns Migrated canvas data
 */
export const migrateToV1_1 = (data: PreziCanvasData): PreziCanvasData => {
  // Already v1.1 or later
  if (data.version !== "1.0") {
    return data;
  }

  console.log("[Migration] Migrating canvas data from v1.0 to v1.1");

  const migratedData = JSON.parse(JSON.stringify(data)) as PreziCanvasData;

  // Update version
  migratedData.version = "1.1";

  // Get all element IDs
  const allElementIds = Object.keys(migratedData.elements);

  // ✨ For backward compatibility: associate all elements with all keyframes
  // This ensures old presentations display correctly immediately after migration
  // Users can then use drag-to-remove to refine the associations
  migratedData.paths.forEach((path) => {
    path.keyframes.forEach((keyframe) => {
      if (!keyframe.visibleElements) {
        keyframe.visibleElements = [...allElementIds]; // ✨ Associate all elements
      }
    });
  });

  // Add keyframeIds to all elements
  Object.keys(migratedData.elements).forEach((elementId) => {
    const element = migratedData.elements[elementId];
    if (element && !element.keyframeIds) {
      // Get all keyframe IDs from all paths
      const allKeyframeIds = migratedData.paths.flatMap((path) =>
        path.keyframes.map((kf) => kf.id)
      );
      element.keyframeIds = allKeyframeIds; // ✨ Associate with all keyframes
    }
  });

  console.log(`[Migration] Migration complete - associated ${allElementIds.length} elements with all keyframes (backward compatibility)`);

  return migratedData;
};

/**
 * Auto-migrate canvas data on load
 * Should be called when loading canvas data from database
 */
export const autoMigrateCanvasData = (data: PreziCanvasData): PreziCanvasData => {
  let migratedData = data;

  // Apply migrations in sequence
  if (migratedData.version === "1.0") {
    migratedData = migrateToV1_1(migratedData);
  }

  // Future migrations can be added here
  // if (migratedData.version === "1.1") {
  //   migratedData = migrateToV1_2(migratedData);
  // }

  return migratedData;
};

/**
 * Quick fix: Associate all elements with all keyframes in the active path
 * Useful for existing presentations that don't have proper keyframe associations
 */
export const associateAllElementsToAllKeyframes = (): void => {
  const state = usePreziEditorStore.getState();
  const { canvasData } = state;

  if (!canvasData) return;

  const activePath = canvasData.paths.find((p) => p.id === canvasData.activePath);
  if (!activePath || activePath.keyframes.length === 0) {
    console.warn("[Quick Fix] No active path or no keyframes");
    return;
  }

  const allElementIds = Object.keys(canvasData.elements);
  if (allElementIds.length === 0) {
    console.warn("[Quick Fix] No elements to associate");
    return;
  }

  usePreziEditorStore.setState((state) => {
    if (!state.canvasData) return;

    // Save to history
    state.history.past.push(JSON.parse(JSON.stringify(state.canvasData)));
    if (state.history.past.length > MAX_HISTORY_LENGTH) {
      state.history.past.shift();
    }

    const activePath = state.canvasData.paths.find((p) => p.id === state.canvasData?.activePath);
    if (!activePath || !state.canvasData) return;

    // Update all elements: add all keyframe IDs
    const allKeyframeIds = activePath.keyframes.map((kf) => kf.id);
    allElementIds.forEach((elementId) => {
      const element = state.canvasData!.elements[elementId];
      if (element) {
        element.keyframeIds = [...allKeyframeIds];
      }
    });

    // Update all keyframes: add all element IDs
    activePath.keyframes.forEach((keyframe) => {
      keyframe.visibleElements = [...allElementIds];
    });

    state.history.future = [];

    console.log(`[Quick Fix] Associated ${allElementIds.length} elements with ${allKeyframeIds.length} keyframes`);
  });
};
