/**
 * PathInterpolator
 *
 * Path interpolation algorithms for smooth camera transitions.
 * Supports linear and Catmull-Rom spline interpolation.
 */

import { type CameraState, type PathKeyframe } from "@/types/prezi-types";

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Catmull-Rom spline interpolation
 * Generates smooth curves through control points
 */
function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Interpolate camera state between two keyframes using linear interpolation
 */
export function linearInterpolate(
  from: CameraState,
  to: CameraState,
  t: number
): CameraState {
  return {
    position: {
      x: lerp(from.position.x, to.position.x, t),
      y: lerp(from.position.y, to.position.y, t),
      z: lerp(from.position.z, to.position.z, t),
    },
    target: {
      x: lerp(from.target.x, to.target.x, t),
      y: lerp(from.target.y, to.target.y, t),
      z: lerp(from.target.z, to.target.z, t),
    },
    zoom: lerp(from.zoom, to.zoom, t),
    rotation: from.rotation && to.rotation ? {
      x: lerp(from.rotation.x, to.rotation.x, t),
      y: lerp(from.rotation.y, to.rotation.y, t),
      z: lerp(from.rotation.z, to.rotation.z, t),
    } : undefined,
  };
}

/**
 * Interpolate camera state using Catmull-Rom spline
 * Requires at least 2 keyframes, uses 4 control points for smooth interpolation
 */
export function splineInterpolate(
  keyframes: PathKeyframe[],
  currentIndex: number,
  t: number
): CameraState {
  if (keyframes.length < 2) {
    return keyframes[0]!.camera;
  }

  // Get 4 control points (p0, p1, p2, p3)
  const i = currentIndex;
  const p0 = keyframes[Math.max(0, i - 1)]!.camera;
  const p1 = keyframes[i]!.camera;
  const p2 = keyframes[Math.min(keyframes.length - 1, i + 1)]!.camera;
  const p3 = keyframes[Math.min(keyframes.length - 1, i + 2)]!.camera;

  return {
    position: {
      x: catmullRom(p0.position.x, p1.position.x, p2.position.x, p3.position.x, t),
      y: catmullRom(p0.position.y, p1.position.y, p2.position.y, p3.position.y, t),
      z: catmullRom(p0.position.z, p1.position.z, p2.position.z, p3.position.z, t),
    },
    target: {
      x: catmullRom(p0.target.x, p1.target.x, p2.target.x, p3.target.x, t),
      y: catmullRom(p0.target.y, p1.target.y, p2.target.y, p3.target.y, t),
      z: catmullRom(p0.target.z, p1.target.z, p2.target.z, p3.target.z, t),
    },
    zoom: catmullRom(p0.zoom, p1.zoom, p2.zoom, p3.zoom, t),
    rotation:
      p0.rotation && p1.rotation && p2.rotation && p3.rotation
        ? {
            x: catmullRom(p0.rotation.x, p1.rotation.x, p2.rotation.x, p3.rotation.x, t),
            y: catmullRom(p0.rotation.y, p1.rotation.y, p2.rotation.y, p3.rotation.y, t),
            z: catmullRom(p0.rotation.z, p1.rotation.z, p2.rotation.z, p3.rotation.z, t),
          }
        : undefined,
  };
}

/**
 * Calculate total path duration (including transitions and pauses)
 */
export function calculatePathDuration(keyframes: PathKeyframe[]): number {
  let totalDuration = 0;

  keyframes.forEach((keyframe, index) => {
    // Add keyframe pause duration
    totalDuration += keyframe.duration;

    // Add transition duration (if not last keyframe)
    if (index < keyframes.length - 1) {
      totalDuration += keyframe.transition?.duration || 1;
    }
  });

  return totalDuration;
}

/**
 * Get keyframe index and local progress from global time
 */
export function getKeyframeAtTime(
  keyframes: PathKeyframe[],
  time: number
): { keyframeIndex: number; localProgress: number } {
  let accumulatedTime = 0;

  for (let i = 0; i < keyframes.length; i++) {
    const keyframe = keyframes[i]!;
    const transitionDuration = i < keyframes.length - 1 ? (keyframe.transition?.duration || 1) : 0;
    const totalDuration = keyframe.duration + transitionDuration;

    if (time <= accumulatedTime + totalDuration) {
      // Found the keyframe
      const localTime = time - accumulatedTime;

      // Check if in pause phase or transition phase
      if (localTime <= keyframe.duration) {
        // In pause phase
        return { keyframeIndex: i, localProgress: 0 };
      } else {
        // In transition phase
        const transitionTime = localTime - keyframe.duration;
        const localProgress = transitionTime / transitionDuration;
        return { keyframeIndex: i, localProgress };
      }
    }

    accumulatedTime += totalDuration;
  }

  // Time exceeds path duration, return last keyframe
  return { keyframeIndex: keyframes.length - 1, localProgress: 1 };
}

/**
 * Smooth easing function (ease-in-out cubic)
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Ease-in function (cubic)
 */
export function easeIn(t: number): number {
  return t * t * t;
}

/**
 * Ease-out function (cubic)
 */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Apply easing to progress value
 */
export function applyEasing(
  progress: number,
  easingType: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out"
): number {
  switch (easingType) {
    case "linear":
      return progress;
    case "ease":
      return easeInOutCubic(progress);
    case "ease-in":
      return easeIn(progress);
    case "ease-out":
      return easeOut(progress);
    case "ease-in-out":
      return easeInOutCubic(progress);
    default:
      return progress;
  }
}
