/**
 * PreziToolbar Component
 *
 * Main toolbar for Prezi editor with tools:
 * - Select tool
 * - Pan tool
 * - Text tool
 * - Image tool
 * - Undo/Redo
 * - Zoom controls
 */

"use client";

import React from "react";
import { usePreziEditorStore, useCanUndo, useCanRedo } from "@/states/prezi-editor-state";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2,
  Hand,
  Type,
  Image,
  Code,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import KeyboardShortcuts from "./KeyboardShortcuts";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  heading: string;
  muted: string;
}

interface PreziToolbarProps {
  className?: string;
  themeColors?: ThemeColors;
  onPresentMode?: () => void; // 🆕 Callback to enter presentation mode
}

/**
 * PreziToolbar component
 */
const PreziToolbar: React.FC<PreziToolbarProps> = ({ className, themeColors, onPresentMode }) => {
  const mode = usePreziEditorStore((state) => state.mode);
  const setMode = usePreziEditorStore((state) => state.setMode);
  const undo = usePreziEditorStore((state) => state.undo);
  const redo = usePreziEditorStore((state) => state.redo);
  const camera = usePreziEditorStore((state) => state.camera);
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);

  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  // Tool buttons configuration
  const tools = [
    { id: "select", icon: MousePointer2, label: "Select (V)", shortcut: "V" },
    { id: "pan", icon: Hand, label: "Pan (H)", shortcut: "H" },
    { id: "text", icon: Type, label: "Text (T)", shortcut: "T" },
    { id: "draw", icon: Image, label: "Image (I)", shortcut: "I" },
    { id: "html", icon: Code, label: "HTML (C)", shortcut: "C" },
  ] as const;

  // Handle zoom in (move camera closer)
  const handleZoomIn = () => {
    const newZ = camera.position.z / 1.2; // Closer to target
    updateCamera({
      ...camera,
      position: {
        ...camera.position,
        z: Math.max(newZ, 100), // Min distance: 100
      },
      zoom: camera.zoom * 1.2,
    });
  };

  // Handle zoom out (move camera farther)
  const handleZoomOut = () => {
    const newZ = camera.position.z * 1.2; // Farther from target
    updateCamera({
      ...camera,
      position: {
        ...camera.position,
        z: Math.min(newZ, 5000), // Max distance: 5000
      },
      zoom: camera.zoom / 1.2,
    });
  };

  // Reset camera to default view
  const handleResetView = () => {
    updateCamera({
      position: { x: 0, y: 0, z: 1000 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2 shadow-md",
        className
      )}
      style={{
        backgroundColor: themeColors?.background || "#ffffff",
        borderColor: themeColors ? adjustColorOpacity(themeColors.muted, 0.3) : "#e5e7eb",
      }}
    >
      {/* Tool buttons */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = mode === tool.id;

          return (
            <Button
              key={tool.id}
              size="sm"
              onClick={() => setMode(tool.id as any)}
              title={tool.label}
              className="h-9 w-9 p-0 hover:opacity-80"
              style={{
                backgroundColor: isActive
                  ? themeColors?.primary || "#3b82f6"
                  : "transparent",
                color: isActive ? "#ffffff" : themeColors?.text || "#1f2937",
                border: `1px solid ${adjustColorOpacity(themeColors?.muted || "#6b7280", isActive ? 0 : 0.3)}`,
              }}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>

      <Separator orientation="vertical" className="h-6" style={{ backgroundColor: adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3) }} />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="h-9 w-9 p-0 hover:opacity-80"
          style={{
            backgroundColor: "transparent",
            color: themeColors?.text || "#1f2937",
            border: `1px solid ${adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3)}`,
            opacity: !canUndo ? 0.4 : 1,
          }}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="h-9 w-9 p-0 hover:opacity-80"
          style={{
            backgroundColor: "transparent",
            color: themeColors?.text || "#1f2937",
            border: `1px solid ${adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3)}`,
            opacity: !canRedo ? 0.4 : 1,
          }}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" style={{ backgroundColor: adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3) }} />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          className="h-9 w-9 p-0 hover:opacity-80"
          style={{
            backgroundColor: "transparent",
            color: themeColors?.text || "#1f2937",
            border: `1px solid ${adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3)}`,
          }}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        <div
          className="min-w-[60px] text-center text-xs font-medium"
          style={{ color: themeColors?.text || "#374151" }}
        >
          {Math.round(camera.zoom * 100)}%
        </div>

        <Button
          size="sm"
          onClick={handleZoomIn}
          title="Zoom In (+)"
          className="h-9 w-9 p-0 hover:opacity-80"
          style={{
            backgroundColor: "transparent",
            color: themeColors?.text || "#1f2937",
            border: `1px solid ${adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3)}`,
          }}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          onClick={handleResetView}
          title="Reset View (0)"
          className="h-9 w-9 p-0 hover:opacity-80"
          style={{
            backgroundColor: "transparent",
            color: themeColors?.text || "#1f2937",
            border: `1px solid ${adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3)}`,
          }}
        >
          <Home className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" style={{ backgroundColor: adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3) }} />

      {/* Help */}
      <KeyboardShortcuts themeColors={themeColors} />
    </div>
  );
};

/**
 * Helper function to adjust color opacity
 */
function adjustColorOpacity(color: string, opacity: number): string {
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

export default PreziToolbar;
