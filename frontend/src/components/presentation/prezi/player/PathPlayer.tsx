/**
 * PathPlayer Component (重构版)
 *
 * 核心改进：
 * 1. 分离 Timeline 准备和播放逻辑 - 消除启动延迟
 * 2. 移除手动插值 - GSAP 直接驱动虚拟相机
 * 3. 元素动画与相机动画协同 - 基于关键帧变化触发
 */

"use client";

import { useEffect, useRef } from "react";
import { usePreziEditorStore, useActivePath } from "@/states/prezi-editor-state";
import { getCameraAnimator } from "@/lib/presentation/prezi/camera-animator";
import { getElementAnimator } from "@/lib/presentation/prezi/element-animator";
import { elementRefManager } from "@/lib/presentation/prezi/element-ref-manager";

/**
 * PathPlayer component
 */
const PathPlayer: React.FC = () => {
  const isPlaying = usePreziEditorStore((state) => state.isPlaying);
  const activePath = useActivePath();
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const currentKeyframeIndex = usePreziEditorStore((state) => state.currentKeyframeIndex);
  const setCurrentKeyframeIndex = usePreziEditorStore(
    (state) => state.setCurrentKeyframeIndex
  );
  const stopPlaying = usePreziEditorStore((state) => state.stopPlaying);
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);
  const updateElement = usePreziEditorStore((state) => state.updateElement);

  const animatorRef = useRef(getCameraAnimator());
  const elementAnimatorRef = useRef(getElementAnimator());
  const lastKeyframeIndexRef = useRef<number>(-1);
  const wasPlayingRef = useRef<boolean>(false);

  // ✨ Effect 1: 准备 Timeline（path 或 canvasData 变化时）
  useEffect(() => {
    if (!activePath || activePath.keyframes.length === 0) {
      console.warn("[PathPlayer] No active path or keyframes");
      return;
    }

    const animator = animatorRef.current;
    const elementAnimator = elementAnimatorRef.current;

    console.log(`[PathPlayer] Preparing timeline for path: ${activePath.id}`);

    // ✨ 预创建 Timeline（不播放）
    animator.prepareTimeline(activePath, {
      onKeyframeChange: (index) => {
        console.log(`[PathPlayer] Keyframe changed to ${index}`);
        setCurrentKeyframeIndex(index);
        lastKeyframeIndexRef.current = index;

        const keyframe = activePath.keyframes[index];
        if (!keyframe || !canvasData) return;

        // ✨ NEW: Control element visibility based on keyframe.visibleElements
        const visibleElementIds = keyframe.visibleElements || [];
        if (visibleElementIds.length > 0) {
          // Update visibility for all elements
          Object.keys(canvasData.elements).forEach((elementId) => {
            const shouldBeVisible = visibleElementIds.includes(elementId);
            const element = canvasData.elements[elementId];

            // Only update if visibility changed
            if (element && element.visible !== shouldBeVisible) {
              updateElement(elementId, { visible: shouldBeVisible });
            }
          });

          console.log(`[PathPlayer] Updated visibility: ${visibleElementIds.length} elements visible`);
        }

        // ✨ 触发元素动画（进入新关键帧时）
        if (keyframe.elementAnimations) {
          for (const [elementId, action] of Object.entries(
            keyframe.elementAnimations
          )) {
            const element = canvasData.elements[elementId];
            const elementRef = elementRefManager.get(elementId);

            if (element && elementRef) {
              if (action === "enter") {
                elementAnimator.playEnterAnimation(element, elementRef as any);
              } else if (action === "exit") {
                elementAnimator.playExitAnimation(element, elementRef as any);
              }
            } else {
              console.warn(
                `[PathPlayer] Element or ref not found for ${elementId}`
              );
            }
          }
        }
      },
      onProgress: (index, progress) => {
        // 可选：用于调试或进度显示
        // console.log(`[PathPlayer] Progress: keyframe ${index}, ${(progress * 100).toFixed(1)}%`);
      },
      onComplete: () => {
        console.log("[PathPlayer] Playback complete");

        // 同步最终相机状态到 Zustand
        const finalCamera = animator.getVirtualCameraState();
        updateCamera(finalCamera);

        // 停止播放
        stopPlaying();
        setCurrentKeyframeIndex(0);
        lastKeyframeIndexRef.current = -1;
      },
    });

    console.log("[PathPlayer] Timeline prepared successfully");
  }, [activePath, canvasData, setCurrentKeyframeIndex, stopPlaying, updateCamera]);

  // ✨ Effect 2: 播放控制（isPlaying 变化时）
  useEffect(() => {
    const animator = animatorRef.current;
    const elementAnimator = elementAnimatorRef.current;

    if (isPlaying) {
      // ✨ Smart playback: check if resuming or starting fresh
      // If currentKeyframeIndex > 0, we're resuming from pause
      // If currentKeyframeIndex === 0, we're starting from beginning
      if (currentKeyframeIndex > 0) {
        // Resuming from pause - continue from current position
        console.log(`[PathPlayer] Resuming playback from frame ${currentKeyframeIndex}`);
        animator.resume();
      } else {
        // Starting fresh from beginning
        console.log("[PathPlayer] Starting playback from beginning");
        const success = animator.play();

        if (!success) {
          console.error(
            "[PathPlayer] Failed to start playback - timeline not ready"
          );
          stopPlaying();
        }
      }

      wasPlayingRef.current = true;
    } else {
      console.log("[PathPlayer] Pausing playback");

      // 暂停动画
      animator.pause();

      // 停止所有元素动画
      elementAnimator.stopAll();

      // Keep wasPlayingRef true to remember we were playing (for resume)
      // Only reset to false when explicitly stopped (currentKeyframeIndex === 0)
    }
  }, [isPlaying, currentKeyframeIndex, stopPlaying]);

  // ✨ Effect 3: Reset wasPlayingRef when stopped (currentKeyframeIndex resets to 0)
  useEffect(() => {
    if (!isPlaying && currentKeyframeIndex === 0) {
      wasPlayingRef.current = false;
      console.log("[PathPlayer] Reset to beginning");
    }
  }, [currentKeyframeIndex, isPlaying]);

  // 非可视化组件
  return null;
};

export default PathPlayer;
