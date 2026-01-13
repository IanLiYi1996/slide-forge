/**
 * KeyframeList Component
 *
 * Displays list of keyframes in the presentation path with:
 * - Thumbnail preview (camera view)
 * - Keyframe order/numbering
 * - Duration display
 * - Delete/reorder actions
 */

"use client";

import React from "react";
import { usePreziEditorStore, useActivePath } from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, GripVertical, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyframeListProps {
  onKeyframeClick?: (keyframeId: string, index: number) => void;
}

/**
 * KeyframeList component
 */
const KeyframeList: React.FC<KeyframeListProps> = ({ onKeyframeClick }) => {
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const activePath = useActivePath();
  const currentKeyframeIndex = usePreziEditorStore(
    (state) => state.currentKeyframeIndex
  );
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);
  const updateElement = usePreziEditorStore((state) => state.updateElement);
  const setCurrentKeyframeIndex = usePreziEditorStore((state) => state.setCurrentKeyframeIndex);

  // Get theme colors using unified hook
  const { mounted, themeColors } = usePreziTheme();

  // Show loading during hydration
  if (!mounted) {
    return null;
  }

  if (!canvasData || !activePath) {
    return (
      <Card className="border-0 bg-transparent p-4 shadow-none">
        <p className="text-sm opacity-60">No path data available</p>
      </Card>
    );
  }

  const keyframes = activePath.keyframes;

  // Handle keyframe click - jump to keyframe view
  const handleKeyframeClick = (keyframeId: string, index: number) => {
    if (onKeyframeClick) {
      onKeyframeClick(keyframeId, index);
      return;
    }

    // ✨ Default behavior: jump camera to this keyframe
    const keyframe = activePath?.keyframes[index];
    if (!keyframe || !canvasData) return;

    console.log(`[KeyframeList] Jumping to keyframe ${index + 1}`);

    // Update camera to keyframe's camera state
    updateCamera(keyframe.camera);

    // Update current keyframe index (triggers PreziCamera to apply the change)
    setCurrentKeyframeIndex(index);

    // ✨ Update element visibility based on keyframe.visibleElements
    const visibleElementIds = keyframe.visibleElements || [];
    if (visibleElementIds.length > 0) {
      Object.keys(canvasData.elements).forEach((elementId) => {
        const shouldBeVisible = visibleElementIds.includes(elementId);
        updateElement(elementId, { visible: shouldBeVisible });
      });
      console.log(`[KeyframeList] Updated visibility: ${visibleElementIds.length} elements visible`);
    }
  };

  // Handle delete keyframe
  const handleDeleteKeyframe = (keyframeId: string, index: number) => {
    if (confirm(`Delete keyframe ${index + 1}?`)) {
      // TODO: Implement delete keyframe in store
      console.log("Delete keyframe:", keyframeId);
    }
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    return `${seconds.toFixed(1)}s`;
  };

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: themeColors.heading }}>Keyframes</h3>
        <span className="text-xs" style={{ color: themeColors.muted }}>
          {keyframes.length} frame{keyframes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {keyframes.length === 0 ? (
        <Card className="p-8 text-center shadow-none" style={{
          border: `1px solid ${themeColors.muted}30`,
          backgroundColor: `${themeColors.background}80`
        }}>
          <p className="text-sm" style={{ color: themeColors.muted }}>No keyframes yet</p>
          <p className="mt-2 text-xs" style={{ color: themeColors.muted, opacity: 0.7 }}>
            Click "Capture View" to create keyframes
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {keyframes.map((keyframe, index) => {
            const isActive = currentKeyframeIndex === index;

            return (
              <Card
                key={keyframe.id}
                className="group relative cursor-pointer transition-all hover:shadow-md"
                style={{
                  border: `1px solid ${themeColors.muted}30`,
                  backgroundColor: `${themeColors.background}80`,
                  ...(isActive && {
                    border: `2px solid ${themeColors.primary}`,
                    boxShadow: `0 0 0 1px ${themeColors.primary}40`,
                  }),
                }}
                onClick={() => handleKeyframeClick(keyframe.id, index)}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Drag handle */}
                  <div className="cursor-grab opacity-0 transition-opacity group-hover:opacity-100" style={{ color: themeColors.muted }}>
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Keyframe number */}
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: isActive ? themeColors.primary : `${themeColors.muted}30`,
                      color: isActive ? "#ffffff" : themeColors.text,
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Keyframe info */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" style={{
                      color: isActive ? themeColors.primary : themeColors.text
                    }}>
                      {keyframe.title || `Frame ${index + 1}`}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: themeColors.muted }}>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(keyframe.duration)}</span>
                      </div>
                      {keyframe.transition && (
                        <span style={{ opacity: 0.7 }}>
                          → {formatDuration(keyframe.transition.duration)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      style={{ color: themeColors.muted }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // ✨ Preview this keyframe (same as clicking the card)
                        handleKeyframeClick(keyframe.id, index);
                      }}
                      title="Preview this keyframe"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      style={{ color: "#ef4444" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKeyframe(keyframe.id, index);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-0 h-full w-1 rounded-l" style={{ backgroundColor: themeColors.primary }} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KeyframeList;
