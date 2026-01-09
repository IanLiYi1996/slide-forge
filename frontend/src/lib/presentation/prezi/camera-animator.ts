/**
 * CameraAnimator
 *
 * Handles camera animation for Prezi path playback using GSAP.
 * Provides smooth transitions between keyframes with various easing functions.
 */

import gsap from "gsap";
import { type CameraState, type PathKeyframe, type PresentationPath } from "@/types/prezi-types";

/**
 * Camera animator class
 */
export class CameraAnimator {
  private timeline: gsap.core.Timeline | null = null;
  private currentKeyframeIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;

  /**
   * Create animation timeline from path
   */
  createTimeline(
    path: PresentationPath,
    onUpdate?: (keyframeIndex: number, progress: number) => void,
    onComplete?: () => void
  ): gsap.core.Timeline {
    // Kill existing timeline
    if (this.timeline) {
      this.timeline.kill();
    }

    // Create new timeline
    this.timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        this.isPlaying = false;
        this.currentKeyframeIndex = 0;
        if (onComplete) onComplete();
      },
    });

    // Build timeline from keyframes
    path.keyframes.forEach((keyframe, index) => {
      const nextKeyframe = path.keyframes[index + 1];

      if (nextKeyframe) {
        // Add transition to next keyframe
        const duration = keyframe.transition?.duration || 1;
        const ease = this.getEase(keyframe.transition?.type || "ease-in-out");

        this.timeline!.to(
          {},
          {
            duration,
            ease,
            onStart: () => {
              this.currentKeyframeIndex = index;
              if (onUpdate) onUpdate(index, 0);
            },
            onUpdate: () => {
              const progress = this.timeline!.progress();
              if (onUpdate) onUpdate(index, progress);
            },
          },
          `>` // Start after previous animation
        );

        // Add pause at keyframe
        if (keyframe.duration > 0) {
          this.timeline!.to(
            {},
            {
              duration: keyframe.duration,
            },
            `>`
          );
        }
      } else {
        // Last keyframe - just pause
        if (keyframe.duration > 0) {
          this.timeline!.to(
            {},
            {
              duration: keyframe.duration,
              onStart: () => {
                this.currentKeyframeIndex = index;
                if (onUpdate) onUpdate(index, 1);
              },
            },
            `>`
          );
        }
      }
    });

    // Loop if needed
    if (path.loop) {
      this.timeline.repeat(-1);
    }

    return this.timeline;
  }

  /**
   * Get GSAP easing function
   */
  private getEase(type: string): string {
    switch (type) {
      case "linear":
        return "none";
      case "ease":
        return "power1.inOut";
      case "ease-in":
        return "power2.in";
      case "ease-out":
        return "power2.out";
      case "ease-in-out":
        return "power2.inOut";
      default:
        return "power2.inOut";
    }
  }

  /**
   * Interpolate camera state between two keyframes
   */
  interpolateCameraState(
    from: CameraState,
    to: CameraState,
    progress: number
  ): CameraState {
    return {
      position: {
        x: from.position.x + (to.position.x - from.position.x) * progress,
        y: from.position.y + (to.position.y - from.position.y) * progress,
        z: from.position.z + (to.position.z - from.position.z) * progress,
      },
      target: {
        x: from.target.x + (to.target.x - from.target.x) * progress,
        y: from.target.y + (to.target.y - from.target.y) * progress,
        z: from.target.z + (to.target.z - from.target.z) * progress,
      },
      zoom: from.zoom + (to.zoom - from.zoom) * progress,
      rotation: from.rotation && to.rotation ? {
        x: from.rotation.x + (to.rotation.x - from.rotation.x) * progress,
        y: from.rotation.y + (to.rotation.y - from.rotation.y) * progress,
        z: from.rotation.z + (to.rotation.z - from.rotation.z) * progress,
      } : undefined,
    };
  }

  /**
   * Play animation
   */
  play(): void {
    if (this.timeline) {
      this.timeline.play();
      this.isPlaying = true;
      this.isPaused = false;
    }
  }

  /**
   * Pause animation
   */
  pause(): void {
    if (this.timeline) {
      this.timeline.pause();
      this.isPlaying = false;
      this.isPaused = true;
    }
  }

  /**
   * Stop animation (reset to start)
   */
  stop(): void {
    if (this.timeline) {
      this.timeline.pause();
      this.timeline.progress(0);
      this.isPlaying = false;
      this.isPaused = false;
      this.currentKeyframeIndex = 0;
    }
  }

  /**
   * Resume animation
   */
  resume(): void {
    if (this.timeline && this.isPaused) {
      this.timeline.play();
      this.isPlaying = true;
      this.isPaused = false;
    }
  }

  /**
   * Jump to specific keyframe
   */
  jumpToKeyframe(index: number, path: PresentationPath): void {
    if (!this.timeline || index < 0 || index >= path.keyframes.length) {
      return;
    }

    // Calculate time position for this keyframe
    let time = 0;
    for (let i = 0; i < index; i++) {
      const keyframe = path.keyframes[i]!;
      const nextKeyframe = path.keyframes[i + 1];

      if (nextKeyframe) {
        time += (keyframe.transition?.duration || 1) + keyframe.duration;
      } else {
        time += keyframe.duration;
      }
    }

    this.timeline.seek(time);
    this.currentKeyframeIndex = index;
  }

  /**
   * Go to next keyframe
   */
  nextKeyframe(path: PresentationPath): void {
    const nextIndex = Math.min(
      this.currentKeyframeIndex + 1,
      path.keyframes.length - 1
    );
    this.jumpToKeyframe(nextIndex, path);
  }

  /**
   * Go to previous keyframe
   */
  previousKeyframe(path: PresentationPath): void {
    const prevIndex = Math.max(this.currentKeyframeIndex - 1, 0);
    this.jumpToKeyframe(prevIndex, path);
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentKeyframeIndex: this.currentKeyframeIndex,
      progress: this.timeline?.progress() || 0,
      duration: this.timeline?.duration() || 0,
    };
  }

  /**
   * Destroy animator (cleanup)
   */
  destroy(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.currentKeyframeIndex = 0;
  }
}

/**
 * Create global camera animator instance
 */
let globalAnimator: CameraAnimator | null = null;

export function getCameraAnimator(): CameraAnimator {
  if (!globalAnimator) {
    globalAnimator = new CameraAnimator();
  }
  return globalAnimator;
}

export function resetCameraAnimator(): void {
  if (globalAnimator) {
    globalAnimator.destroy();
    globalAnimator = null;
  }
}
