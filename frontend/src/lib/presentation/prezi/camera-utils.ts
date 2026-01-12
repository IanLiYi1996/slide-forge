/**
 * Camera Utility Functions
 *
 * Provides camera positioning, frustum calculations, and element visibility checks
 * for Prezi presentations.
 */

import type { Position3D, CameraState } from "@/types/prezi-types";

/**
 * Calculate the visible area dimensions at a given distance
 *
 * @param fov Field of view in degrees
 * @param aspect Aspect ratio (width / height)
 * @param distance Distance from camera to target
 * @returns Visible width and height in world units
 */
export function calculateFrustumSize(
  fov: number,
  aspect: number,
  distance: number
): { width: number; height: number } {
  const fovRadians = (fov * Math.PI) / 180;
  const height = 2 * Math.tan(fovRadians / 2) * distance;
  const width = height * aspect;

  return { width, height };
}

/**
 * Calculate the required camera distance to fully show an element
 *
 * @param elementWidth Element width in world units
 * @param elementHeight Element height in world units
 * @param fov Field of view in degrees
 * @param aspect Aspect ratio
 * @param padding Padding factor (1.3 = 30% margin)
 * @returns Required camera distance
 */
export function calculateRequiredDistance(
  elementWidth: number,
  elementHeight: number,
  fov: number,
  aspect: number,
  padding: number = 0.8 // ✨ 从 1.0 改为 0.8（元素超填充视野，更大）
): number {
  const targetWidth = elementWidth * padding;
  const targetHeight = elementHeight * padding;

  const fovRadians = (fov * Math.PI) / 180;
  const tanHalfFov = Math.tan(fovRadians / 2);

  // Calculate distance from height constraint
  const distanceFromHeight = targetHeight / (2 * tanHalfFov);

  // Calculate distance from width constraint
  const distanceFromWidth = targetWidth / (aspect * 2 * tanHalfFov);

  // Return the larger distance to ensure both dimensions fit
  return Math.max(distanceFromHeight, distanceFromWidth);
}

/**
 * Calculate camera state to focus on a single element
 *
 * @param elementPosition Element position in 3D space
 * @param elementSize Element size {width, height}
 * @param fov Field of view in degrees
 * @param aspect Aspect ratio
 * @param options Optional parameters
 * @returns CameraState that will show the element fully
 */
export function calculateCameraForElement(
  elementPosition: Position3D,
  elementSize: { width: number; height: number },
  fov: number,
  aspect: number,
  options: {
    padding?: number;
    minDistance?: number;
    maxDistance?: number;
  } = {}
): CameraState {
  const { padding = 1.3, minDistance = 50, maxDistance = 8000 } = options;

  // Calculate required distance
  let distance = calculateRequiredDistance(
    elementSize.width,
    elementSize.height,
    fov,
    aspect,
    padding
  );

  // Clamp to valid range
  distance = Math.max(minDistance, Math.min(maxDistance, distance));

  return {
    position: {
      x: elementPosition.x,
      y: elementPosition.y,
      z: elementPosition.z + distance,
    },
    target: elementPosition,
    zoom: 1,
  };
}

/**
 * Calculate camera state to show multiple elements
 *
 * @param elements Array of elements with position and size
 * @param fov Field of view in degrees
 * @param aspect Aspect ratio
 * @param padding Padding factor
 * @returns CameraState that shows all elements
 */
export function calculateCameraForMultipleElements(
  elements: Array<{
    position: Position3D;
    size: { width: number; height: number };
  }>,
  fov: number,
  aspect: number,
  padding: number = 1.3
): CameraState {
  if (elements.length === 0) {
    return {
      position: { x: 0, y: 0, z: 1000 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
    };
  }

  // Calculate bounding box
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  elements.forEach(({ position, size }) => {
    const halfWidth = size.width / 2;
    const halfHeight = size.height / 2;

    minX = Math.min(minX, position.x - halfWidth);
    maxX = Math.max(maxX, position.x + halfWidth);
    minY = Math.min(minY, position.y - halfHeight);
    maxY = Math.max(maxY, position.y + halfHeight);
    minZ = Math.min(minZ, position.z);
    maxZ = Math.max(maxZ, position.z);
  });

  // Calculate center point
  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  };

  // Calculate bounding box dimensions
  const boundingBoxSize = {
    width: maxX - minX,
    height: maxY - minY,
  };

  // Calculate required distance
  const distance = calculateRequiredDistance(
    boundingBoxSize.width,
    boundingBoxSize.height,
    fov,
    aspect,
    padding
  );

  return {
    position: {
      x: center.x,
      y: center.y,
      z: center.z + distance,
    },
    target: center,
    zoom: 1,
  };
}

/**
 * Check if an element is visible in the given camera state
 *
 * @param elementPosition Element position
 * @param elementSize Element size
 * @param cameraState Camera state
 * @param fov Field of view in degrees
 * @param aspect Aspect ratio
 * @returns Visibility information
 */
export function checkElementVisibility(
  elementPosition: Position3D,
  elementSize: { width: number; height: number },
  cameraState: CameraState,
  fov: number,
  aspect: number
): { visible: boolean; visibilityRatio: number; reason?: string } {
  // Calculate distance from camera to element
  const distance = Math.sqrt(
    Math.pow(cameraState.position.x - elementPosition.x, 2) +
      Math.pow(cameraState.position.y - elementPosition.y, 2) +
      Math.pow(cameraState.position.z - elementPosition.z, 2)
  );

  // Calculate visible area at this distance
  const frustum = calculateFrustumSize(fov, aspect, distance);

  // Calculate element offset from camera target
  const offsetX = Math.abs(elementPosition.x - cameraState.target.x);
  const offsetY = Math.abs(elementPosition.y - cameraState.target.y);

  const visibleHalfWidth = frustum.width / 2;
  const visibleHalfHeight = frustum.height / 2;

  const elementHalfWidth = elementSize.width / 2;
  const elementHalfHeight = elementSize.height / 2;

  // Check if element is fully within frustum
  const fullyVisibleX = offsetX + elementHalfWidth <= visibleHalfWidth;
  const fullyVisibleY = offsetY + elementHalfHeight <= visibleHalfHeight;

  if (!fullyVisibleX || !fullyVisibleY) {
    const visibilityX = visibleHalfWidth / (offsetX + elementHalfWidth);
    const visibilityY = visibleHalfHeight / (offsetY + elementHalfHeight);

    return {
      visible: false,
      visibilityRatio: Math.min(visibilityX, visibilityY, 1),
      reason: `Element exceeds viewport (viewport: ${frustum.width.toFixed(0)}x${frustum.height.toFixed(0)}, element: ${elementSize.width}x${elementSize.height})`,
    };
  }

  return {
    visible: true,
    visibilityRatio: 1,
  };
}

/**
 * Validate camera configuration for all elements
 *
 * @param cameraState Camera state to validate
 * @param elements Array of elements to check
 * @param fov Field of view in degrees
 * @param aspect Aspect ratio
 * @returns Validation result with warnings and errors
 */
export function validateCameraConfiguration(
  cameraState: CameraState,
  elements: Array<{
    id: string;
    position: Position3D;
    size: { width: number; height: number };
  }>,
  fov: number,
  aspect: number
): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check each element's visibility
  elements.forEach((element) => {
    const visibility = checkElementVisibility(
      element.position,
      element.size,
      cameraState,
      fov,
      aspect
    );

    if (!visibility.visible) {
      if (visibility.visibilityRatio < 0.5) {
        errors.push(
          `Element ${element.id} severely out of view (visibility: ${(visibility.visibilityRatio * 100).toFixed(0)}%)`
        );
      } else {
        warnings.push(
          `Element ${element.id} partially out of view (visibility: ${(visibility.visibilityRatio * 100).toFixed(0)}%)`
        );
      }

      if (visibility.reason) {
        warnings.push(`  Reason: ${visibility.reason}`);
      }
    }
  });

  // Check if camera distance is reasonable
  const distance = Math.sqrt(
    Math.pow(cameraState.position.x - cameraState.target.x, 2) +
      Math.pow(cameraState.position.y - cameraState.target.y, 2) +
      Math.pow(cameraState.position.z - cameraState.target.z, 2)
  );

  if (distance < 50) {
    warnings.push(`Camera too close (${distance.toFixed(0)}), recommended >= 50`);
  }

  if (distance > 8000) {
    warnings.push(
      `Camera too far (${distance.toFixed(0)}), recommended <= 8000`
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
