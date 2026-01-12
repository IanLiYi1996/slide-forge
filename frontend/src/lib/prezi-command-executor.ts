/**
 * Prezi Command Executor
 *
 * Executes AI-generated commands to modify Prezi presentations.
 * Parses natural language instructions and applies them to the canvas.
 */

import { usePreziEditorStore } from "@/states/prezi-editor-state";
import { generateElementId } from "@/states/prezi-editor-state";
import type { PreziElement, Position3D, Rotation3D, ElementAnimation } from "@/types/prezi-types";

/**
 * Command structure from AI
 */
export interface PreziCommand {
  action:
    | "update_element"
    | "add_element"
    | "delete_element"
    | "update_camera"
    | "add_keyframe"
    | "update_canvas"
    | "add_animation";
  params: any;
  confirmation: string;
}

/**
 * Prezi Command Executor Class
 *
 * Stateless executor that applies commands to the Prezi editor store.
 */
export class PreziCommandExecutor {
  /**
   * Execute a command
   *
   * @param command - AI-generated command
   * @returns Success status
   */
  static execute(command: PreziCommand): boolean {
    try {
      const store = usePreziEditorStore.getState();

      switch (command.action) {
        case "update_element":
          return this.executeUpdateElement(store, command.params);

        case "add_element":
          return this.executeAddElement(store, command.params);

        case "delete_element":
          return this.executeDeleteElement(store, command.params);

        case "update_camera":
          return this.executeUpdateCamera(store, command.params);

        case "add_keyframe":
          return this.executeAddKeyframe(store, command.params);

        case "update_canvas":
          return this.executeUpdateCanvas(store, command.params);

        case "add_animation":
          return this.executeAddAnimation(store, command.params);

        default:
          console.warn("Unknown command action:", command.action);
          return false;
      }
    } catch (error) {
      console.error("Command execution error:", error);
      return false;
    }
  }

  /**
   * Update an existing element
   */
  private static executeUpdateElement(store: any, params: any): boolean {
    const { elementId, updates } = params;

    if (!elementId || !updates) {
      console.error("Invalid update_element params");
      return false;
    }

    // Validate element exists
    if (!store.canvasData?.elements[elementId]) {
      console.error(`Element not found: ${elementId}`);
      return false;
    }

    store.updateElement(elementId, updates);
    return true;
  }

  /**
   * Add a new element
   */
  private static executeAddElement(store: any, params: any): boolean {
    const { type, content, position, size, ...rest } = params;

    if (!type) {
      console.error("Invalid add_element params: missing type");
      return false;
    }

    // Generate element based on type
    const newElement: Partial<PreziElement> = {
      id: generateElementId(type),
      type,
      position: position || { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
      size: size || { width: 300, height: 200 },
      zIndex: 0,
      opacity: 1,
      locked: false,
      ...rest,
    };

    // Type-specific content
    if (type === "text" && content) {
      (newElement as any).content = Array.isArray(content)
        ? content
        : [{ type: "p", children: [{ text: content }] }];
    } else if (type === "image" && params.url) {
      (newElement as any).url = params.url;
    } else if (type === "html" && params.htmlContent) {
      (newElement as any).htmlContent = params.htmlContent;
    }

    store.addElement(newElement as PreziElement);
    return true;
  }

  /**
   * Delete an element
   */
  private static executeDeleteElement(store: any, params: any): boolean {
    const { elementId } = params;

    if (!elementId) {
      console.error("Invalid delete_element params");
      return false;
    }

    store.deleteElement(elementId);
    return true;
  }

  /**
   * Update camera position
   */
  private static executeUpdateCamera(store: any, params: any): boolean {
    const { position, target, zoom, rotation } = params;

    const currentCamera = store.camera;
    const updatedCamera = {
      position: position || currentCamera.position,
      target: target || currentCamera.target,
      zoom: zoom !== undefined ? zoom : currentCamera.zoom,
      rotation: rotation || currentCamera.rotation,
    };

    store.updateCamera(updatedCamera);
    return true;
  }

  /**
   * Add a new keyframe
   */
  private static executeAddKeyframe(store: any, params: any): boolean {
    const { focusElementId, camera, duration = 3 } = params;

    if (!store.canvasData) {
      console.error("No canvas data");
      return false;
    }

    // Get current active path
    const activePath = store.canvasData.paths.find(
      (p: any) => p.id === store.canvasData.activePath
    );

    if (!activePath) {
      console.error("No active path");
      return false;
    }

    // Determine camera state
    let cameraState = camera;
    if (focusElementId && store.canvasData.elements[focusElementId]) {
      const element = store.canvasData.elements[focusElementId];
      // Position camera to focus on element
      cameraState = {
        position: {
          x: element.position.x,
          y: element.position.y,
          z: element.position.z + 1000,
        },
        target: element.position,
        zoom: 1,
      };
    } else if (!cameraState) {
      // Use current camera
      cameraState = store.camera;
    }

    // Create new keyframe
    const newKeyframe = {
      id: `keyframe-${Date.now()}`,
      order: activePath.keyframes.length,
      camera: cameraState,
      duration,
      transition: {
        type: "ease-in-out" as const,
        duration: 1.5,
      },
      highlightElements: focusElementId ? [focusElementId] : [],
    };

    // Update path with new keyframe
    const updatedPath = {
      ...activePath,
      keyframes: [...activePath.keyframes, newKeyframe],
    };

    // Update canvas data
    const updatedPaths = store.canvasData.paths.map((p: any) =>
      p.id === activePath.id ? updatedPath : p
    );

    store.setCanvasData({
      ...store.canvasData,
      paths: updatedPaths,
    });

    return true;
  }

  /**
   * Update canvas properties
   */
  private static executeUpdateCanvas(store: any, params: any): boolean {
    const { backgroundColor, gridEnabled, gridSize } = params;

    if (!store.canvasData) {
      console.error("No canvas data");
      return false;
    }

    const updatedCanvas = {
      ...store.canvasData.canvas,
      ...(backgroundColor !== undefined && { backgroundColor }),
      ...(gridEnabled !== undefined && { gridEnabled }),
      ...(gridSize !== undefined && { gridSize }),
    };

    store.setCanvasData({
      ...store.canvasData,
      canvas: updatedCanvas,
    });

    return true;
  }

  /**
   * Add animation to an element
   */
  private static executeAddAnimation(store: any, params: any): boolean {
    const { elementId, animationType, direction = "in", duration = 1 } = params;

    if (!elementId || !animationType) {
      console.error("Invalid add_animation params");
      return false;
    }

    const animation: ElementAnimation = {
      type: animationType,
      direction,
      duration,
      easing: "power2.out",
    };

    store.updateElement(elementId, { animation });
    return true;
  }

  /**
   * Parse confirmation message from command
   */
  static getConfirmation(command: PreziCommand): string {
    return command.confirmation || "Command executed successfully";
  }
}

/**
 * Helper: Parse natural language command (optional pre-processing)
 *
 * This can be used to extract structured data from natural language
 * before sending to AI, but currently AI handles all parsing.
 */
export function parseNaturalLanguageCommand(input: string): Partial<PreziCommand> | null {
  // Example patterns (this is optional - AI does the heavy lifting)
  const patterns = [
    {
      regex: /move\s+(.+?)\s+to\s+\(?(\d+),\s*(\d+)\)?/i,
      handler: (match: RegExpMatchArray) => ({
        action: "update_element" as const,
        params: {
          elementId: match[1],
          updates: {
            position: { x: parseInt(match[2] || "0"), y: parseInt(match[3] || "0"), z: 0 },
          },
        },
      }),
    },
    {
      regex: /change\s+background\s+(?:color\s+)?to\s+(.+)/i,
      handler: (match: RegExpMatchArray) => ({
        action: "update_canvas" as const,
        params: {
          backgroundColor: (match[1] || "").trim(),
        },
      }),
    },
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern.regex);
    if (match) {
      return pattern.handler(match);
    }
  }

  return null;
}
