/**
 * PreziCamera Component
 *
 * Manages camera controls for the Prezi canvas including:
 * - Pan (drag to move)
 * - Zoom (scroll to zoom)
 * - Auto-camera animation for path playback
 */

"use client";

import React, { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { usePreziEditorStore } from "@/states/prezi-editor-state";
import { CAMERA_ZOOM_LIMITS } from "@/types/prezi-types";
import * as THREE from "three";

interface PreziCameraProps {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
}

/**
 * PreziCamera component
 */
const PreziCamera: React.FC<PreziCameraProps> = ({
  enablePan = true,
  enableZoom = true,
  enableRotate = false, // Disable rotation by default for 2D-like experience
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const lastUpdateTime = useRef<number>(0);
  const skipNextUpdate = useRef<boolean>(false);

  const mode = usePreziEditorStore((state) => state.mode);
  const cameraState = usePreziEditorStore((state) => state.camera);
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);
  const isPlaying = usePreziEditorStore((state) => state.isPlaying);

  // Sync camera with store state
  useEffect(() => {
    if (camera && cameraState && controlsRef.current) {
      camera.position.set(
        cameraState.position.x,
        cameraState.position.y,
        cameraState.position.z
      );
      camera.lookAt(
        cameraState.target.x,
        cameraState.target.y,
        cameraState.target.z
      );

      // Update controls target
      controlsRef.current.target.set(
        cameraState.target.x,
        cameraState.target.y,
        cameraState.target.z
      );

      // Force controls to update
      controlsRef.current.update();

      // Skip next useFrame update to avoid immediate override
      skipNextUpdate.current = true;
      lastUpdateTime.current = Date.now();
    }
  }, [camera, cameraState]);

  // Update store when camera moves (via OrbitControls)
  // Throttled to avoid conflicts with programmatic camera updates
  useFrame(() => {
    if (controlsRef.current && !isPlaying) {
      // Skip if we just programmatically updated the camera
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }

      const now = Date.now();
      // Only update every 100ms to avoid conflicts
      if (now - lastUpdateTime.current > 100) {
        const controls = controlsRef.current;

        // Update camera state in store
        updateCamera({
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          target: {
            x: controls.target.x,
            y: controls.target.y,
            z: controls.target.z,
          },
          zoom: 1 / (camera.position.z / 1000), // Convert distance to zoom level
        });

        lastUpdateTime.current = now;
      }
    }
  });

  // Determine if controls should be enabled based on mode
  const panEnabled = enablePan && (mode === "pan" || mode === "select");
  const zoomEnabled = enableZoom;
  const rotateEnabled = enableRotate && mode === "pan";

  // Disable controls during playback
  const controlsEnabled = !isPlaying;

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={controlsEnabled}
      enablePan={panEnabled}
      enableZoom={zoomEnabled}
      enableRotate={rotateEnabled}
      // Zoom settings
      minDistance={100} // Min camera distance
      maxDistance={5000} // Max camera distance
      zoomSpeed={1.2}
      // Pan settings
      panSpeed={1}
      screenSpacePanning={true} // Pan in screen space
      // Rotation settings (mostly disabled)
      minPolarAngle={Math.PI / 2} // Lock to top-down view
      maxPolarAngle={Math.PI / 2}
      // Smooth damping
      enableDamping={true}
      dampingFactor={0.05}
      // Mouse buttons
      mouseButtons={{
        LEFT: mode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
};

export default PreziCamera;
