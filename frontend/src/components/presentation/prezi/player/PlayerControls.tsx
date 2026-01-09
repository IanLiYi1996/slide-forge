/**
 * PlayerControls Component
 *
 * Playback controls UI with:
 * - Play/Pause/Stop buttons
 * - Previous/Next keyframe
 * - Progress indicator
 */

"use client";

import React from "react";
import { usePreziEditorStore, useActivePath } from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { Play, Pause, Square, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCameraAnimator } from "@/lib/presentation/prezi/camera-animator";

interface PlayerControlsProps {
  className?: string;
}

/**
 * PlayerControls component
 */
const PlayerControls: React.FC<PlayerControlsProps> = ({ className }) => {
  const isPlaying = usePreziEditorStore((state) => state.isPlaying);
  const playPath = usePreziEditorStore((state) => state.playPath);
  const stopPlaying = usePreziEditorStore((state) => state.stopPlaying);
  const setCurrentKeyframeIndex = usePreziEditorStore((state) => state.setCurrentKeyframeIndex);
  const activePath = useActivePath();
  const currentKeyframeIndex = usePreziEditorStore(
    (state) => state.currentKeyframeIndex
  );

  // Get theme colors using unified hook
  const { mounted, themeColors } = usePreziTheme();

  // Show loading during hydration
  if (!mounted) {
    return null;
  }

  if (!activePath || activePath.keyframes.length === 0) {
    return (
      <div
        className={cn("rounded-lg p-4 backdrop-blur-sm", className)}
        style={{
          border: `2px solid ${themeColors.muted}`,
          backgroundColor: themeColors.background,
          boxShadow: `0 2px 8px ${adjustColorOpacity(themeColors.muted, 0.2)}`,
        }}
      >
        <p className="text-center text-sm font-medium" style={{ color: themeColors.text }}>
          No keyframes to play
        </p>
        <p className="text-center text-xs mt-1" style={{ color: themeColors.muted }}>
          Create keyframes in Path mode to enable playback
        </p>
      </div>
    );
  }

  const animator = getCameraAnimator();

  // Handle play/pause
  const handlePlayPause = () => {
    if (isPlaying) {
      animator.pause();
      stopPlaying();
    } else {
      playPath(activePath.id);
    }
  };

  // Handle stop
  const handleStop = () => {
    animator.stop();
    stopPlaying();
  };

  // Handle previous keyframe
  const handlePrevious = () => {
    if (activePath && currentKeyframeIndex > 0) {
      const newIndex = currentKeyframeIndex - 1;
      setCurrentKeyframeIndex(newIndex);
      animator.jumpToKeyframe(newIndex, activePath);
    }
  };

  // Handle next keyframe
  const handleNext = () => {
    if (activePath && currentKeyframeIndex < activePath.keyframes.length - 1) {
      const newIndex = currentKeyframeIndex + 1;
      setCurrentKeyframeIndex(newIndex);
      animator.jumpToKeyframe(newIndex, activePath);
    }
  };

  return (
    <div
      className={cn("rounded-lg shadow-md", className)}
      style={{
        border: `1px solid ${adjustColorOpacity(themeColors.primary, 0.3)}`,
        backgroundColor: themeColors.background,
        padding: "12px 16px",
      }}
    >
      <div className="flex items-center gap-2">
        {/* Previous */}
        <button
          onClick={handlePrevious}
          disabled={currentKeyframeIndex === 0}
          title="Previous keyframe"
          style={{
            backgroundColor: "transparent",
            color: themeColors.text,
            border: `1px solid ${adjustColorOpacity(themeColors.muted, 0.3)}`,
            borderRadius: "6px",
            padding: "6px",
            cursor: currentKeyframeIndex === 0 ? "not-allowed" : "pointer",
            opacity: currentKeyframeIndex === 0 ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (currentKeyframeIndex > 0) {
              e.currentTarget.style.backgroundColor = adjustColorOpacity(themeColors.accent, 0.1);
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <SkipBack className="h-4 w-4" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          title={isPlaying ? "Pause" : "Play"}
          style={{
            backgroundColor: themeColors.primary,
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "6px 14px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          {isPlaying ? (
            <>
              <Pause className="h-4 w-4" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Play</span>
            </>
          )}
        </button>

        {/* Stop */}
        <button
          onClick={handleStop}
          disabled={!isPlaying}
          title="Stop"
          style={{
            backgroundColor: "transparent",
            color: themeColors.text,
            border: `1px solid ${adjustColorOpacity(themeColors.muted, 0.3)}`,
            borderRadius: "6px",
            padding: "6px",
            cursor: !isPlaying ? "not-allowed" : "pointer",
            opacity: !isPlaying ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (isPlaying) {
              e.currentTarget.style.backgroundColor = adjustColorOpacity(themeColors.accent, 0.1);
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <Square className="h-4 w-4" />
        </button>

        {/* Next */}
        <button
          onClick={handleNext}
          disabled={currentKeyframeIndex >= activePath.keyframes.length - 1}
          title="Next keyframe"
          style={{
            backgroundColor: "transparent",
            color: themeColors.text,
            border: `1px solid ${adjustColorOpacity(themeColors.muted, 0.3)}`,
            borderRadius: "6px",
            padding: "6px",
            cursor: currentKeyframeIndex >= activePath.keyframes.length - 1 ? "not-allowed" : "pointer",
            opacity: currentKeyframeIndex >= activePath.keyframes.length - 1 ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (currentKeyframeIndex < activePath.keyframes.length - 1) {
              e.currentTarget.style.backgroundColor = adjustColorOpacity(themeColors.accent, 0.1);
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <SkipForward className="h-4 w-4" />
        </button>

        {/* Progress indicator */}
        <div className="ml-3 flex-1" style={{ minWidth: "100px" }}>
          <div className="text-xs font-medium" style={{ color: themeColors.text }}>
            {currentKeyframeIndex + 1} / {activePath.keyframes.length}
          </div>
          <div
            className="mt-1 h-1 overflow-hidden rounded-full"
            style={{ backgroundColor: adjustColorOpacity(themeColors.muted, 0.2) }}
          >
            <div
              className="h-full transition-all"
              style={{
                backgroundColor: themeColors.primary,
                width: `${
                  ((currentKeyframeIndex + 1) / activePath.keyframes.length) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Helper function to adjust color opacity
 */
function adjustColorOpacity(color: string, opacity: number): string {
  let r = 0,
    g = 0,
    b = 0;

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

export default PlayerControls;
