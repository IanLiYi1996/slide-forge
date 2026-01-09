/**
 * PathPlayer Component
 *
 * Handles path playback using CameraAnimator.
 * This is a non-visual component that manages animation logic.
 */

"use client";

import { useEffect, useRef } from "react";
import { usePreziEditorStore, useActivePath } from "@/states/prezi-editor-state";
import { getCameraAnimator } from "@/lib/presentation/prezi/camera-animator";
import { linearInterpolate } from "@/lib/presentation/prezi/path-interpolator";

/**
 * PathPlayer component
 */
const PathPlayer: React.FC = () => {
  const isPlaying = usePreziEditorStore((state) => state.isPlaying);
  const activePath = useActivePath();
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);
  const setCurrentKeyframeIndex = usePreziEditorStore((state) => state.setCurrentKeyframeIndex);
  const stopPlaying = usePreziEditorStore((state) => state.stopPlaying);

  const animatorRef = useRef(getCameraAnimator());

  // Handle playback
  useEffect(() => {
    if (!isPlaying || !activePath || activePath.keyframes.length < 2) {
      return;
    }

    const animator = animatorRef.current;

    // Create timeline
    const timeline = animator.createTimeline(
      activePath,
      (keyframeIndex, progress) => {
        // Update callback - interpolate camera and update store
        setCurrentKeyframeIndex(keyframeIndex);

        const currentKeyframe = activePath.keyframes[keyframeIndex];
        const nextKeyframe = activePath.keyframes[keyframeIndex + 1];

        if (currentKeyframe && nextKeyframe) {
          // Interpolate between keyframes
          const interpolatedCamera = linearInterpolate(
            currentKeyframe.camera,
            nextKeyframe.camera,
            progress
          );
          updateCamera(interpolatedCamera);
        } else if (currentKeyframe) {
          // At last keyframe
          updateCamera(currentKeyframe.camera);
        }
      },
      () => {
        // Complete callback
        stopPlaying();
        setCurrentKeyframeIndex(0); // Reset to start
      }
    );

    // Start playback
    animator.play();

    // Cleanup
    return () => {
      animator.stop();
    };
  }, [isPlaying, activePath, updateCamera, setCurrentKeyframeIndex, stopPlaying]);

  // This is a non-visual component
  return null;
};

export default PathPlayer;
