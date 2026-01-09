/**
 * PreziPlayer Component (Full Page)
 *
 * Full-screen Prezi player for presentation mode.
 * Displays canvas with playback controls.
 */

"use client";

import React, { useEffect } from "react";
import { usePreziEditorStore, createInitialCanvasData } from "@/states/prezi-editor-state";
import PreziCanvas from "../editor/PreziCanvas";
import PlayerControls from "./PlayerControls";
import PathPlayer from "./PathPlayer";
import { type PreziCanvasData } from "@/types/prezi-types";

interface PreziPlayerProps {
  presentationId?: string;
  initialData?: PreziCanvasData;
  autoPlay?: boolean;
}

/**
 * PreziPlayer component
 */
const PreziPlayerComponent: React.FC<PreziPlayerProps> = ({
  presentationId,
  initialData,
  autoPlay = false,
}) => {
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const setCanvasData = usePreziEditorStore((state) => state.setCanvasData);
  const playPath = usePreziEditorStore((state) => state.playPath);

  // Initialize canvas data
  useEffect(() => {
    if (!canvasData) {
      if (initialData) {
        setCanvasData(initialData);
      } else {
        setCanvasData(createInitialCanvasData());
      }
    }
  }, [canvasData, initialData, setCanvasData]);

  // Auto-play if enabled
  useEffect(() => {
    if (autoPlay && canvasData && canvasData.activePath) {
      // Start playing after a short delay
      const timer = setTimeout(() => {
        playPath(canvasData.activePath);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, canvasData, playPath]);

  // Keyboard shortcuts for playback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space = play/pause
      if (e.key === " " && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const isPlaying = usePreziEditorStore.getState().isPlaying;
        if (isPlaying) {
          usePreziEditorStore.getState().stopPlaying();
        } else if (canvasData) {
          playPath(canvasData.activePath);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvasData, playPath]);

  return (
    <div className="flex h-screen w-full flex-col bg-gray-900">
      {/* Canvas (full screen) */}
      <div className="flex-1">
        <PreziCanvas showGrid={false} showStats={false} />
      </div>

      {/* Bottom controls */}
      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="flex justify-center">
          <PlayerControls className="w-full max-w-md" />
        </div>
      </div>

      {/* Path player (non-visual) */}
      <PathPlayer />
    </div>
  );
};

export default PreziPlayerComponent;
