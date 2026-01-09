/**
 * ImageElement Component
 *
 * Renders image elements on the Prezi canvas using Three.js textures.
 */

"use client";

import React, { useRef, useState, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useGesture } from "@use-gesture/react";
import { usePreziEditorStore } from "@/states/prezi-editor-state";
import { type PreziImageElement } from "@/types/prezi-types";
import * as THREE from "three";

interface ImageElementProps {
  element: PreziImageElement;
}

/**
 * ImageElement component
 */
const ImageElement: React.FC<ImageElementProps> = React.memo(({ element }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { camera } = useThree();
  const selectedElements = usePreziEditorStore(
    (state) => state.selectedElements
  );
  const selectElements = usePreziEditorStore((state) => state.selectElements);
  const updateElement = usePreziEditorStore((state) => state.updateElement);
  const mode = usePreziEditorStore((state) => state.mode);

  const isSelected = selectedElements.includes(element.id);

  // Load texture (must be called unconditionally per React Hooks rules)
  // useTexture will suspend if image is loading - handled by Suspense in PreziCanvas
  const texture = useTexture(element.url || "/placeholder-image.png");

  // Handle click (selection)
  const handleClick = (e: any) => {
    if (e.stopPropagation) e.stopPropagation();
    if (mode === "select") {
      // Toggle selection (support multi-select with Ctrl/Cmd)
      const nativeEvent = e.nativeEvent || e;
      if (nativeEvent?.shiftKey || nativeEvent?.ctrlKey) {
        if (isSelected) {
          selectElements(
            selectedElements.filter((id) => id !== element.id)
          );
        } else {
          selectElements([...selectedElements, element.id]);
        }
      } else {
        selectElements([element.id]);
      }
    }
  };

  // Handle pointer over
  const handlePointerOver = (e: any) => {
    if (e.stopPropagation) e.stopPropagation();
    setIsHovered(true);
    document.body.style.cursor = mode === "select" ? "pointer" : "default";
  };

  // Handle pointer out
  const handlePointerOut = () => {
    setIsHovered(false);
    document.body.style.cursor = "default";
  };

  // Handle drag (only in select mode when selected)
  const bind = useGesture(
    {
      onDrag: ({ offset: [x, y], dragging }) => {
        if (mode !== "select" || !isSelected || element.locked) return;

        setIsDragging(dragging ?? false);

        if (dragging && groupRef.current) {
          // Convert screen drag to world coordinates
          const dragScale = camera.position.z / 1000;
          updateElement(element.id, {
            position: {
              x: element.position.x + x * dragScale,
              y: element.position.y - y * dragScale,
              z: element.position.z,
            },
          });
        }
      },
    },
    {
      drag: {
        from: () => [0, 0],
      },
    }
  );

  // Calculate position and rotation
  const position = new THREE.Vector3(
    element.position.x,
    element.position.y,
    element.position.z
  );
  const rotation = new THREE.Euler(
    element.rotation.x,
    element.rotation.y,
    element.rotation.z
  );

  // Create material with selection/hover highlight
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: element.opacity,
      side: THREE.DoubleSide,
    });

    // Add slight tint when selected or hovered
    if (isSelected) {
      mat.color.setRGB(0.8, 0.9, 1.0); // Blue tint
    } else if (isHovered) {
      mat.color.setRGB(0.9, 0.95, 1.0); // Slight blue tint
    } else {
      mat.color.setRGB(1, 1, 1); // White (no tint)
    }

    return mat;
  }, [texture, element.opacity, isSelected, isHovered]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={element.scale * (isDragging ? 1.02 : 1)}
    >
      {/* Image mesh */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        material={material}
        {...(isSelected && mode === "select" ? bind() : {})}
      >
        <planeGeometry args={[element.size.width, element.size.height]} />
      </mesh>

      {/* Selection outline */}
      {isSelected && (
        <lineSegments>
          <edgesGeometry
            attach="geometry"
            args={[
              new THREE.PlaneGeometry(
                element.size.width,
                element.size.height
              ),
            ]}
          />
          <lineBasicMaterial attach="material" color="#3b82f6" linewidth={2} />
        </lineSegments>
      )}

      {/* Hover outline */}
      {isHovered && !isSelected && (
        <lineSegments>
          <edgesGeometry
            attach="geometry"
            args={[
              new THREE.PlaneGeometry(
                element.size.width,
                element.size.height
              ),
            ]}
          />
          <lineBasicMaterial attach="material" color="#60a5fa" linewidth={1} />
        </lineSegments>
      )}
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo optimization
  return (
    prevProps.element.id === nextProps.element.id &&
    prevProps.element.url === nextProps.element.url &&
    prevProps.element.position.x === nextProps.element.position.x &&
    prevProps.element.position.y === nextProps.element.position.y &&
    prevProps.element.position.z === nextProps.element.position.z &&
    prevProps.element.scale === nextProps.element.scale &&
    prevProps.element.opacity === nextProps.element.opacity
  );
});

ImageElement.displayName = "ImageElement";

export default ImageElement;
