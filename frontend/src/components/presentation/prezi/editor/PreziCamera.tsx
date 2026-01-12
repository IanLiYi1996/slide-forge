/**
 * PreziCamera Component (重构版)
 *
 * 核心改进：
 * 1. 播放时直接读取虚拟相机 - 消除 Zustand 延迟
 * 2. 简化状态管理 - 播放时不写 Zustand
 * 3. 性能优化 - 减少 10x Zustand 调用
 */

"use client";

import React, { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { usePreziEditorStore } from "@/states/prezi-editor-state";
import { getCameraAnimator } from "@/lib/presentation/prezi/camera-animator";
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
  enableRotate = false,
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const lastUpdateTime = useRef<number>(0);

  const mode = usePreziEditorStore((state) => state.mode);
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);
  const isPlaying = usePreziEditorStore((state) => state.isPlaying);

  // ✨ 简化：播放时禁用 OrbitControls，编辑时启用
  useEffect(() => {
    if (!controlsRef.current) return;

    if (isPlaying) {
      controlsRef.current.enabled = false;
      console.log("[PreziCamera] OrbitControls disabled (playing)");
    } else {
      controlsRef.current.enabled = true;
      console.log("[PreziCamera] OrbitControls enabled (editing)");
    }
  }, [isPlaying]);

  // ✨ 核心修改：直接读取虚拟相机（绕过 Zustand）
  useFrame(() => {
    if (!camera || !controlsRef.current) return;

    if (isPlaying) {
      // ✅ 播放模式：直接从 CameraAnimator 读取虚拟相机
      const animator = getCameraAnimator();
      const camState = animator.getVirtualCameraState();

      // 直接应用到 Three.js 相机
      camera.position.set(camState.position.x, camState.position.y, camState.position.z);
      camera.lookAt(camState.target.x, camState.target.y, camState.target.z);

      // 应用 zoom（通过调整距离）
      if (camState.zoom && camState.zoom !== 1) {
        const direction = new THREE.Vector3();
        const targetPoint = new THREE.Vector3(
          camState.target.x,
          camState.target.y,
          camState.target.z
        );

        direction.subVectors(camera.position, targetPoint).normalize();
        const currentDistance = camera.position.distanceTo(targetPoint);
        const adjustedDistance = currentDistance / camState.zoom;

        camera.position
          .copy(targetPoint)
          .add(direction.multiplyScalar(adjustedDistance));
      }

      camera.updateProjectionMatrix();

      // 同步 OrbitControls 的 target（避免停止时跳跃）
      controlsRef.current.target.set(
        camState.target.x,
        camState.target.y,
        camState.target.z
      );
      controlsRef.current.update();

      return; // ✅ 不调用 Zustand（性能优化）
    }

    // 编辑模式：OrbitControls → Zustand（节流 100ms）
    const now = Date.now();
    if (now - lastUpdateTime.current > 100) {
      const controls = controlsRef.current;

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
        zoom: 1,
      });

      lastUpdateTime.current = now;
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
      // Zoom settings - expanded range
      minDistance={50}
      maxDistance={8000}
      zoomSpeed={1.2}
      // Pan settings
      panSpeed={1}
      screenSpacePanning={true}
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
