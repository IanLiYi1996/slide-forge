/**
 * PathEditor Component
 *
 * Main path editing UI with:
 * - Capture current camera view as keyframe
 * - Keyframe list management
 * - Path settings (loop, name)
 */

"use client";

import React, { useState } from "react";
import {
  usePreziEditorStore,
  useActivePath,
  generateKeyframeId,
} from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Camera, Plus } from "lucide-react";
import KeyframeList from "./KeyframeList";
import { type PathKeyframe, PREZI_DEFAULTS } from "@/types/prezi-types";

/**
 * PathEditor component
 */
const PathEditor: React.FC = () => {
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const setCanvasData = usePreziEditorStore((state) => state.setCanvasData);
  const camera = usePreziEditorStore((state) => state.camera);
  const activePath = useActivePath();

  const [keyframeDuration, setKeyframeDuration] = useState(3);
  const [transitionDuration, setTransitionDuration] = useState(1);

  // Get theme colors using unified hook
  const { mounted, themeColors } = usePreziTheme();

  // Show loading during hydration
  if (!mounted) {
    return null;
  }

  if (!canvasData || !activePath) {
    return (
      <Card className="border-0 bg-transparent shadow-none">
        <CardContent className="p-8 text-center">
          <p className="text-sm opacity-60">No canvas data</p>
        </CardContent>
      </Card>
    );
  }

  // Capture current view as keyframe
  const handleCaptureKeyframe = () => {
    const newKeyframe: PathKeyframe = {
      id: generateKeyframeId(),
      order: activePath.keyframes.length,
      camera: { ...camera },
      duration: keyframeDuration,
      transition: {
        type: "ease-in-out",
        duration: transitionDuration,
      },
      title: `Frame ${activePath.keyframes.length + 1}`,
    };

    // Update path with new keyframe
    const updatedPath = {
      ...activePath,
      keyframes: [...activePath.keyframes, newKeyframe],
    };

    // Update canvas data
    const updatedCanvasData = {
      ...canvasData,
      paths: canvasData.paths.map((p) =>
        p.id === activePath.id ? updatedPath : p
      ),
    };

    setCanvasData(updatedCanvasData);
  };

  // Toggle loop
  const handleToggleLoop = (checked: boolean) => {
    const updatedPath = {
      ...activePath,
      loop: checked,
    };

    const updatedCanvasData = {
      ...canvasData,
      paths: canvasData.paths.map((p) =>
        p.id === activePath.id ? updatedPath : p
      ),
    };

    setCanvasData(updatedCanvasData);
  };

  // Update path name
  const handlePathNameChange = (name: string) => {
    const updatedPath = {
      ...activePath,
      name,
    };

    const updatedCanvasData = {
      ...canvasData,
      paths: canvasData.paths.map((p) =>
        p.id === activePath.id ? updatedPath : p
      ),
    };

    setCanvasData(updatedCanvasData);
  };

  return (
    <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col" style={{ color: themeColors.text }}>
      <CardHeader className="px-0 flex-shrink-0">
        <CardTitle className="text-sm" style={{ color: themeColors.heading }}>Presentation Path</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-0 flex-1 overflow-y-auto">
        {/* Path settings */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="path-name" className="text-xs">
              Path Name
            </Label>
            <Input
              id="path-name"
              value={activePath.name}
              onChange={(e) => handlePathNameChange(e.target.value)}
              className="mt-1 h-8 text-sm"
              placeholder="e.g., Main Presentation"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="loop" className="text-xs">
              Loop Playback
            </Label>
            <Switch
              id="loop"
              checked={activePath.loop}
              onCheckedChange={handleToggleLoop}
            />
          </div>
        </div>

        {/* Capture settings */}
        <div className="space-y-3 rounded-lg p-3" style={{
          border: `1px solid ${themeColors.muted}30`,
          backgroundColor: `${themeColors.muted}18`
        }}>
          <div className="text-xs font-semibold" style={{ color: themeColors.heading }}>
            Capture Settings
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="keyframe-duration" className="text-xs">
                Stay Duration (s)
              </Label>
              <Input
                id="keyframe-duration"
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={keyframeDuration}
                onChange={(e) => setKeyframeDuration(parseFloat(e.target.value))}
                className="mt-1 h-8 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="transition-duration" className="text-xs">
                Transition (s)
              </Label>
              <Input
                id="transition-duration"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={transitionDuration}
                onChange={(e) =>
                  setTransitionDuration(parseFloat(e.target.value))
                }
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleCaptureKeyframe}
            className="w-full"
            size="sm"
          >
            <Camera className="mr-2 h-4 w-4" />
            Capture Current View
          </Button>
        </div>

        {/* Keyframe list */}
        <div>
          <KeyframeList />
        </div>
      </CardContent>
    </Card>
  );
};

export default PathEditor;
