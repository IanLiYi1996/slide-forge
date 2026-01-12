/**
 * Prezi Export Utilities
 *
 * Helper functions for exporting Prezi presentations.
 */

/**
 * Wait for render to complete before capturing
 *
 * Uses requestAnimationFrame to ensure rendering is stable before screenshot.
 * Waits for multiple consecutive frames to be sure.
 *
 * @param timeoutMs Maximum time to wait (default 2000ms)
 * @returns Promise that resolves when render is stable
 */
export async function waitForRenderComplete(
  timeoutMs: number = 2000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let stableFrames = 0;
    const requiredFrames = 3; // Wait for 3 consecutive stable frames

    const checkStability = () => {
      stableFrames++;

      if (stableFrames >= requiredFrames) {
        resolve();
        return;
      }

      requestAnimationFrame(checkStability);
    };

    // Timeout fallback
    setTimeout(() => {
      if (stableFrames < requiredFrames) {
        console.warn(
          `[Export] Render stabilization timeout after ${timeoutMs}ms (${stableFrames}/${requiredFrames} frames)`
        );
        reject(new Error("Render timeout"));
      }
    }, timeoutMs);

    requestAnimationFrame(checkStability);
  });
}

/**
 * Calculate total duration of a presentation path
 *
 * @param keyframes Array of keyframes
 * @returns Total duration in seconds
 */
export function calculatePathDuration(keyframes: any[]): number {
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].duration || 3;

  let totalDuration = 0;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const kf = keyframes[i];
    if (kf) {
      totalDuration += (kf.transition?.duration || 1) + kf.duration;
    }
  }

  // Add last keyframe duration
  const lastKf = keyframes[keyframes.length - 1];
  if (lastKf) {
    totalDuration += lastKf.duration;
  }

  return totalDuration;
}
