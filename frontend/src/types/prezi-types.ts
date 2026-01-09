/**
 * Prezi-style Presentation Types
 *
 * This file defines all types for the Prezi canvas mode, including:
 * - 3D coordinate system
 * - Canvas elements (text, image, shape, group, embed)
 * - Path system (keyframes, transitions)
 * - Canvas data structure
 * - Editor state
 * - Export options
 */

import { type PlateNode } from "@/components/presentation/utils/parser";

// ==================== Core Types ====================

/**
 * 3D spatial coordinate system
 * Origin: Canvas center (0, 0, 0)
 * Units: Pixels (at zoom=1)
 */
export interface Position3D {
  x: number; // Horizontal position (negative left, positive right)
  y: number; // Vertical position (negative up, positive down)
  z: number; // Depth position (positive front, negative back, for layering)
}

/**
 * 3D rotation (Euler angles, in radians)
 */
export interface Rotation3D {
  x: number; // Rotation around X axis (pitch)
  y: number; // Rotation around Y axis (yaw)
  z: number; // Rotation around Z axis (roll)
}

/**
 * Camera state (observer perspective)
 */
export interface CameraState {
  position: Position3D; // Camera position
  target: Position3D; // Look-at point
  zoom: number; // Zoom level (1 = original size)
  rotation?: Rotation3D; // Optional: camera's own rotation
}

// ==================== Canvas Elements ====================

/**
 * Canvas element types
 */
export type PreziElementType =
  | "text" // Text box (reuses Plate.js editor)
  | "image" // Image
  | "html" // HTML content (custom HTML/CSS)
  | "shape" // Shape (rectangle, circle, etc.)
  | "group" // Group container
  | "embed"; // Embedded content (video, webpage, etc.)

/**
 * Base class for canvas elements
 */
export interface PreziElementBase {
  id: string; // Unique identifier
  type: PreziElementType; // Element type
  position: Position3D; // Element position
  rotation: Rotation3D; // Element rotation
  scale: number; // Element scale (relative to original size)
  size: { width: number; height: number }; // Element dimensions (pixels)
  zIndex: number; // Render layer (for sorting when z values are equal)
  opacity: number; // Opacity 0-1
  locked: boolean; // Whether editing is locked
}

/**
 * Text element (reuses Plate.js)
 */
export interface PreziTextElement extends PreziElementBase {
  type: "text";
  content: PlateNode[]; // Reuse existing Plate node format
  backgroundColor?: string; // Background color
  padding?: number; // Padding
}

/**
 * Image element
 */
export interface PreziImageElement extends PreziElementBase {
  type: "image";
  url: string; // Image URL
  cropSettings?: {
    // Crop settings
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * HTML element (custom HTML content)
 */
export interface PreziHTMLElement extends PreziElementBase {
  type: "html";
  htmlContent: string; // Raw HTML content
  css?: string; // Optional CSS styles
  backgroundColor?: string; // Background color
}

/**
 * Shape element
 */
export interface PreziShapeElement extends PreziElementBase {
  type: "shape";
  shapeType: "rectangle" | "circle" | "arrow";
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

/**
 * Group container
 */
export interface PreziGroupElement extends PreziElementBase {
  type: "group";
  children: string[]; // Child element IDs
  backgroundColor?: string;
  borderRadius?: number;
}

/**
 * Embedded content
 */
export interface PreziEmbedElement extends PreziElementBase {
  type: "embed";
  embedType: "video" | "iframe";
  url: string;
}

/**
 * Union type: all elements
 */
export type PreziElement =
  | PreziTextElement
  | PreziImageElement
  | PreziHTMLElement
  | PreziShapeElement
  | PreziGroupElement
  | PreziEmbedElement;

// ==================== Path System ====================

/**
 * Path keyframe (each "step" in the presentation)
 */
export interface PathKeyframe {
  id: string; // Keyframe ID
  order: number; // Order number (0-based)
  camera: CameraState; // Camera state
  duration: number; // Duration to stay (seconds)
  transition?: {
    // Transition animation config
    type: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
    duration: number; // Transition animation duration (seconds)
  };
  highlightElements?: string[]; // Element IDs to highlight in this step
  title?: string; // Step title (shown in editor)
}

/**
 * Presentation path
 */
export interface PresentationPath {
  id: string; // Path ID
  name: string; // Path name
  keyframes: PathKeyframe[]; // Keyframe sequence
  loop: boolean; // Whether to loop playback
}

// ==================== Canvas Data ====================

/**
 * Prezi canvas complete data structure
 * Stored in Presentation.content (JSON)
 */
export interface PreziCanvasData {
  version: string; // Data format version (for backward compatibility)
  canvas: {
    backgroundColor: string; // Canvas background color
    backgroundImage?: string; // Background image URL
    gridEnabled: boolean; // Whether to show grid
    gridSize: number; // Grid size (pixels)
  };
  elements: Record<string, PreziElement>; // Element dictionary {id: element}
  paths: PresentationPath[]; // Presentation path list
  activePath: string; // Currently active path ID
  camera: {
    // Default camera position for editor
    defaultPosition: Position3D;
    defaultZoom: number;
  };
}

// ==================== Editor State ====================

/**
 * Editor mode
 */
export type PreziEditorMode = "select" | "pan" | "draw" | "text" | "html" | "path";

/**
 * Prezi editor state (Zustand store)
 */
export interface PreziEditorState {
  // Data
  canvasData: PreziCanvasData | null;

  // Selection state
  selectedElements: string[]; // Selected element IDs
  hoveredElement: string | null; // Hovered element ID

  // Edit mode
  mode: PreziEditorMode; // Current tool
  isPlaying: boolean; // Whether currently presenting
  currentKeyframeIndex: number; // Current playback keyframe index

  // Camera
  camera: CameraState; // Current camera state

  // History
  history: {
    past: PreziCanvasData[];
    future: PreziCanvasData[];
  };

  // Actions
  setCanvasData: (data: PreziCanvasData) => void;
  addElement: (element: PreziElement) => void;
  updateElement: (id: string, updates: Partial<PreziElement>) => void;
  deleteElement: (id: string) => void;
  selectElements: (ids: string[]) => void;
  setMode: (mode: PreziEditorMode) => void;
  updateCamera: (camera: CameraState) => void;
  setCurrentKeyframeIndex: (index: number) => void; // 🆕 Set current keyframe index
  playPath: (pathId: string) => void;
  stopPlaying: () => void;
  undo: () => void;
  redo: () => void;
}

// ==================== Export Formats ====================

/**
 * Interactive HTML export options
 */
export interface PreziHTMLExportOptions {
  title: string;
  includeControls: boolean; // Whether to include navigation controls
  autoPlay: boolean; // Auto-play
  theme: "light" | "dark"; // UI theme
}

/**
 * Video export options
 */
export interface PreziVideoExportOptions {
  format: "mp4" | "webm"; // Video format
  quality: "low" | "medium" | "high"; // Quality
  fps: 30 | 60; // Frame rate
  resolution: {
    width: number;
    height: number;
  };
}

/**
 * PDF export options
 */
export interface PreziPDFExportOptions {
  paperSize: "A4" | "16:9" | "4:3"; // Paper size
  snapshotsPerKeyframe: number; // Number of snapshots per keyframe (including transition animations)
}

// ==================== Helper Types ====================

/**
 * Element creation input (without ID and default values)
 */
export type CreatePreziElementInput<T extends PreziElement> = Omit<
  T,
  "id" | "zIndex" | "locked"
> &
  Partial<Pick<T, "zIndex" | "locked">>;

/**
 * Element update input (partial updates)
 */
export type UpdatePreziElementInput = Partial<PreziElement>;

// ==================== Constants ====================

/**
 * Default values for new elements
 */
export const PREZI_DEFAULTS = {
  ELEMENT: {
    OPACITY: 1,
    Z_INDEX: 0,
    LOCKED: false,
    SCALE: 1,
  },
  ROTATION: {
    x: 0,
    y: 0,
    z: 0,
  } as Rotation3D,
  POSITION: {
    x: 0,
    y: 0,
    z: 0,
  } as Position3D,
  CAMERA: {
    ZOOM: 1,
    POSITION: { x: 0, y: 0, z: 1000 } as Position3D,
    TARGET: { x: 0, y: 0, z: 0 } as Position3D,
  },
  CANVAS: {
    BACKGROUND_COLOR: "#ffffff",
    GRID_ENABLED: true,
    GRID_SIZE: 50,
  },
  KEYFRAME: {
    DURATION: 3,
    TRANSITION_DURATION: 1,
    TRANSITION_TYPE: "ease-in-out" as const,
  },
} as const;

/**
 * Canvas coordinate boundaries (for keeping elements within reasonable range)
 */
export const CANVAS_BOUNDS = {
  MIN_X: -10000,
  MAX_X: 10000,
  MIN_Y: -10000,
  MAX_Y: 10000,
  MIN_Z: -5000,
  MAX_Z: 5000,
} as const;

/**
 * Camera zoom limits
 */
export const CAMERA_ZOOM_LIMITS = {
  MIN: 0.1,
  MAX: 10,
} as const;
