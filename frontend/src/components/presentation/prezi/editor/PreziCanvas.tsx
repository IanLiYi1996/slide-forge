/**
 * PreziCanvas Component
 *
 * Main Three.js canvas container for Prezi-style presentation editor.
 * Manages the 3D scene, camera, and renders all canvas elements.
 */

"use client";

import React, { Suspense, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Stats } from "@react-three/drei";
import { usePreziEditorStore, generateElementId } from "@/states/prezi-editor-state";
import { PREZI_DEFAULTS, type PreziTextElement, type PreziImageElement, type PreziHTMLElement } from "@/types/prezi-types";
import { AddImageDialog } from "../AddImageDialog";
import PreziCamera from "./PreziCamera";
import PreziElement from "./PreziElement";
import * as THREE from "three";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  heading: string;
  muted: string;
}

interface PreziCanvasProps {
  width?: number | string;
  height?: number | string;
  showGrid?: boolean;
  showStats?: boolean; // Show performance stats (FPS, etc.)
  themeColors?: ThemeColors; // Theme colors for canvas styling
}

/**
 * Canvas click handler component
 */
const CanvasClickHandler: React.FC<{
  onRequestImageUrl: (position: { x: number; y: number }) => void
}> = ({ onRequestImageUrl }) => {
  const { camera, raycaster, mouse, scene } = useThree();
  const mode = usePreziEditorStore((state) => state.mode);
  const addElement = usePreziEditorStore((state) => state.addElement);

  const handleCanvasClick = (event: any) => {
    // Only handle clicks in text, draw, or html mode
    if (mode !== "text" && mode !== "draw" && mode !== "html") return;

    // Get click position in 3D space
    const rect = event.target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Calculate world position
    const vector = new THREE.Vector3(x, y, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));

    if (mode === "text") {
      // Create text element
      const newTextElement: PreziTextElement = {
        id: generateElementId("text"),
        type: "text",
        position: { x: pos.x, y: pos.y, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        size: { width: 1400, height: 500 }, // ✨ 大尺寸：1400x500
        zIndex: 1,
        opacity: 1,
        locked: false,
        content: [
          {
            type: "p",
            children: [{ text: "New Text" }],
          },
        ],
        backgroundColor: "#ffffff",
        padding: 30, // ✨ 更大的内边距
      };
      addElement(newTextElement);
    } else if (mode === "draw") {
      // Request image URL via dialog
      onRequestImageUrl({ x: pos.x, y: pos.y });
    } else if (mode === "html") {
      // Create HTML element with default content
      const newHTMLElement: PreziHTMLElement = {
        id: generateElementId("html"),
        type: "html",
        position: { x: pos.x, y: pos.y, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        size: { width: 1400, height: 500 }, // ✨ 大尺寸：1400x500
        zIndex: 2,
        opacity: 1,
        locked: false,
        htmlContent: `<div style="padding: 20px; text-align: center;">
  <h2 style="color: #3b82f6; margin-bottom: 10px;">Custom HTML</h2>
  <p style="color: #666;">Edit this in the properties panel →</p>
  <button style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; margin-top: 10px; cursor: pointer;">Click Me</button>
</div>`,
        backgroundColor: "#ffffff",
      };
      addElement(newHTMLElement);
    }
  };

  // Listen to canvas clicks
  React.useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.addEventListener("click", handleCanvasClick);
      return () => canvas.removeEventListener("click", handleCanvasClick);
    }
  }, [mode, addElement, camera]);

  return null;
};

/**
 * Loading fallback component
 */
const CanvasLoader = () => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-prezi-ui-bg">
      <div className="text-center">
        <div className="mb-2 h-12 w-12 animate-spin rounded-full border-b-2 border-prezi-ui-primary"></div>
        <p className="text-sm text-prezi-ui-muted">Loading canvas...</p>
      </div>
    </div>
  );
};

/**
 * Main PreziCanvas component
 */
const PreziCanvas: React.FC<PreziCanvasProps> = ({
  width = "100%",
  height = "100vh",
  showGrid = true,
  showStats = false,
  themeColors,
}) => {
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const addElement = usePreziEditorStore((state) => state.addElement);
  const mode = usePreziEditorStore((state) => state.mode);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [pendingImagePosition, setPendingImagePosition] = useState<{ x: number; y: number } | null>(null);

  // Handle image URL confirmation
  const handleImageUrlConfirm = (url: string) => {
    if (pendingImagePosition) {
      const newImageElement: PreziImageElement = {
        id: generateElementId("image"),
        type: "image",
        position: { x: pendingImagePosition.x, y: pendingImagePosition.y, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        size: { width: 1200, height: 900 }, // ✨ 大尺寸：1200x900
        zIndex: 0,
        opacity: 1,
        locked: false,
        url,
      };
      addElement(newImageElement);
      setPendingImagePosition(null);
    }
  };

  // Handle request image URL (from CanvasClickHandler)
  const handleRequestImageUrl = (position: { x: number; y: number }) => {
    setPendingImagePosition(position);
    setShowImageDialog(true);
  };

  if (!canvasData) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          width,
          height,
          backgroundColor: themeColors?.background || "#f9fafb",
        }}
      >
        <div className="text-center">
          <p
            className="text-lg font-medium"
            style={{ color: themeColors?.heading || "#374151" }}
          >
            No canvas data loaded
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: themeColors?.muted || "#6b7280" }}
          >
            Please initialize or load a presentation
          </p>
        </div>
      </div>
    );
  }

  // ✨ Use canvas data background color (not theme background)
  // Theme background is for the UI, canvas background is for the 3D scene
  const backgroundColor = canvasData.canvas.backgroundColor;
  const gridSize = canvasData.canvas.gridSize;
  const gridEnabled = showGrid && canvasData.canvas.gridEnabled;

  // Calculate grid colors based on background lightness
  const isLightBackground = isColorLight(backgroundColor);
  const gridCellColor = isLightBackground ? "#e0e0e0" : "#333333";
  const gridSectionColor = isLightBackground ? "#bdbdbd" : "#555555";

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width,
        height,
        cursor: mode === "text" || mode === "draw" || mode === "html" ? "crosshair" : "default",
      }}
      data-mode={mode}
    >
      <Canvas
        camera={{
          position: [
            PREZI_DEFAULTS.CAMERA.POSITION.x,
            PREZI_DEFAULTS.CAMERA.POSITION.y,
            PREZI_DEFAULTS.CAMERA.POSITION.z,
          ],
          fov: 50,
          near: 1, // ✨ Improved from 0.1 for better depth precision
          far: 20000, // ✨ Expanded from 10000 for wider view range
        }}
        style={{
          background: backgroundColor,
        }}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true, // For screenshots/export
        }}
      >
        <Suspense fallback={null}>
          {/* ✨ Set Three.js scene background color */}
          <color attach="background" args={[backgroundColor]} />

          {/* Canvas click handler for adding elements */}
          <CanvasClickHandler onRequestImageUrl={handleRequestImageUrl} />

          {/* Camera controls */}
          <PreziCamera />

          {/* ✨ Enhanced lighting for better visibility */}
          <ambientLight intensity={1.2} /> {/* ✨ 进一步增加到 1.2 */}

          {/* Directional light for depth perception */}
          <directionalLight
            position={[10, 10, 5]}
            intensity={0.6} // ✨ 从 0.4 增加到 0.6
          />

          {/* ✨ 添加额外的补光（从另一侧） */}
          <directionalLight
            position={[-10, -10, -5]}
            intensity={0.3}
            color="#ffffff"
          />

          {/* ✨ 环境光晕（增加空间感） */}
          <hemisphereLight
            args={["#87CEEB", "#f0f0f0", 0.3]}
          />

          {/* ✨ 增强的网格（更美观） */}
          {gridEnabled && (
            <Grid
              args={[10000, 10000]}
              cellSize={gridSize}
              cellThickness={1} // ✨ 从 0.5 增加到 1
              cellColor={gridCellColor}
              sectionSize={gridSize * 5}
              sectionThickness={1.5} // ✨ 从 1 增加到 1.5
              sectionColor={gridSectionColor}
              fadeDistance={6000} // ✨ 从 5000 增加到 6000
              fadeStrength={1}
              followCamera={false}
              infiniteGrid={true}
            />
          )}

          {/* ✨ 添加大气雾效果（增加空间深度感） */}
          <fog attach="fog" args={[isLightBackground ? "#f0f0f0" : "#1a1a1a", 3000, 8000]} />

          {/* Render all elements */}
          {Object.values(canvasData.elements).map((element) => (
            <PreziElement key={element.id} element={element} />
          ))}

          {/* Performance stats (development only) */}
          {showStats && process.env.NODE_ENV === "development" && <Stats />}
        </Suspense>
      </Canvas>

      {/* Canvas overlay UI (for non-3D controls) */}
      <div className="pointer-events-none absolute inset-0">
        {/* Mode indicator */}
        {(mode === "text" || mode === "draw" || mode === "html") && (
          <div
            className="absolute top-4 left-4 rounded-lg px-3 py-2 text-sm font-medium shadow-lg"
            style={{
              backgroundColor: themeColors?.primary || "#3b82f6",
              color: "#ffffff",
            }}
          >
            {mode === "text"
              ? "📝 Click to add text"
              : mode === "draw"
              ? "🖼️ Click to add image"
              : "💻 Click to add HTML"}
          </div>
        )}
      </div>

      {/* Add Image Dialog */}
      <AddImageDialog
        open={showImageDialog}
        onOpenChange={setShowImageDialog}
        onConfirm={handleImageUrlConfirm}
      />
    </div>
  );
};

/**
 * Helper function to adjust color opacity
 */
function adjustColorOpacity(color: string, opacity: number): string {
  // Convert hex to RGB
  let r = 0, g = 0, b = 0;

  if (color.startsWith("#")) {
    const hex = color.substring(1);
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex[0]! + hex[0], 16);
      g = parseInt(hex[1]! + hex[1], 16);
      b = parseInt(hex[2]! + hex[2], 16);
    }
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Helper function to check if a color is light or dark
 */
function isColorLight(color: string): boolean {
  let r = 0, g = 0, b = 0;

  if (color.startsWith("#")) {
    const hex = color.substring(1);
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex[0]! + hex[0], 16);
      g = parseInt(hex[1]! + hex[1], 16);
      b = parseInt(hex[2]! + hex[2], 16);
    }
  }

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export default PreziCanvas;
