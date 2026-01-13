/**
 * Text Utilities for Prezi Presentation
 *
 * Provides utilities for adaptive text sizing based on camera distance.
 * This ensures text remains readable at all zoom levels during presentations.
 */

import * as THREE from "three";
import { type Position3D } from "@/types/prezi-types";

/**
 * Calculate adaptive font size based on camera distance
 *
 * When the camera is far from text elements, the fixed font size appears tiny.
 * This function scales the font size proportionally to the camera distance,
 * ensuring text remains readable at all zoom levels.
 *
 * @param baseFontSize - Base font size in pixels (e.g., 48)
 * @param cameraDistance - Distance from camera to element
 * @param elementScale - Element's scale multiplier
 * @param minSize - Minimum font size (default: 24px)
 * @param maxSize - Maximum font size (default: 200px)
 * @returns Calculated font size in pixels
 *
 * @example
 * ```typescript
 * // Camera at z=1000, element at origin
 * const fontSize = calculateAdaptiveFontSize(48, 1000, 1.0);
 * // Returns: 48px (no scaling needed)
 *
 * // Camera at z=3000 (far away)
 * const fontSize = calculateAdaptiveFontSize(48, 3000, 1.0);
 * // Returns: 144px (3x scaling to maintain readability)
 * ```
 */
export const calculateAdaptiveFontSize = (
  baseFontSize: number,
  cameraDistance: number,
  elementScale: number,
  minSize: number = 24,
  maxSize: number = 200
): number => {
  // Distance scale factor: normalize distance relative to 1000 units
  // At distance 1000, scale = 1.0 (no adjustment)
  // At distance 2000, scale = 2.0 (double the font size)
  // At distance 500, scale = 0.5 (half the font size)
  const distanceScale = Math.max(1, cameraDistance / 1000);

  // Apply both distance scaling and element's own scale
  const scaledSize = baseFontSize * distanceScale * elementScale;

  // Clamp to readable range
  // Min 24px ensures text is always readable
  // Max 200px prevents text from becoming too large at close distances
  return Math.max(minSize, Math.min(scaledSize, maxSize));
};

/**
 * Calculate camera distance from camera position to element position
 *
 * @param cameraPosition - Camera's 3D position
 * @param elementPosition - Element's 3D position
 * @returns Euclidean distance between camera and element
 */
export const calculateCameraDistance = (
  cameraPosition: THREE.Vector3,
  elementPosition: Position3D
): number => {
  const elementVec = new THREE.Vector3(
    elementPosition.x,
    elementPosition.y,
    elementPosition.z
  );
  return cameraPosition.distanceTo(elementVec);
};

/**
 * Calculate apparent size of an element as seen from camera
 * Used for validation - warns if text would appear too small
 *
 * @param elementSize - Element's width and height in pixels
 * @param distance - Distance from camera
 * @returns Apparent size factor (1.0 = original size)
 */
export const calculateApparentSize = (
  elementSize: { width: number; height: number },
  distance: number
): number => {
  // Apparent size decreases linearly with distance
  // At distance 1000, factor = 1.0
  // At distance 2000, factor = 0.5 (half the apparent size)
  const baseDistance = 1000;
  return baseDistance / Math.max(distance, baseDistance);
};

/**
 * Minimum readable apparent size threshold
 * Elements smaller than this should trigger warnings
 */
export const MIN_READABLE_SIZE = 0.3; // 30% of original size

/**
 * Optimal distance range for text readability
 */
export const OPTIMAL_DISTANCE_RANGE = {
  MIN: 500,  // Too close - text may be cut off
  MAX: 3000, // Too far - text becomes hard to read even with scaling
  IDEAL: 1200, // Sweet spot for most presentations
} as const;
