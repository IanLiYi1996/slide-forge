/**
 * HTMLElement Component
 *
 * Renders custom HTML content on the Prezi canvas using HTML overlay.
 * Supports arbitrary HTML with optional CSS styling.
 */

"use client";

import React, { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useGesture } from "@use-gesture/react";
import { usePreziEditorStore } from "@/states/prezi-editor-state";
import { type PreziHTMLElement } from "@/types/prezi-types";
import * as THREE from "three";

interface HTMLElementProps {
  element: PreziHTMLElement;
}

/**
 * HTMLElement component
 */
const HTMLElement: React.FC<HTMLElementProps> = React.memo(({ element }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { camera, size } = useThree();
  const selectedElements = usePreziEditorStore(
    (state) => state.selectedElements
  );
  const selectElements = usePreziEditorStore((state) => state.selectElements);
  const updateElement = usePreziEditorStore((state) => state.updateElement);
  const mode = usePreziEditorStore((state) => state.mode);

  const isSelected = selectedElements.includes(element.id);

  // Handle click (selection)
  const handleClick = (e: any) => {
    if (e.stopPropagation) e.stopPropagation();
    if (mode === "select") {
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

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={element.scale}
    >
      {/* Invisible mesh for raycasting (click detection) */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        {...(isSelected && mode === "select" ? bind() : {})}
      >
        <planeGeometry
          args={[element.size.width, element.size.height]}
        />
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* HTML overlay for custom HTML content */}
      <Html
        transform
        occlude={false}
        position={[0, 0, 0.1]}
        style={{
          width: `${element.size.width}px`,
          height: `${element.size.height}px`,
          pointerEvents: mode === "select" ? "none" : "auto",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded"
          style={{
            backgroundColor: element.backgroundColor || "transparent",
            opacity: element.opacity,
            border: isSelected
              ? "2px solid #3b82f6"
              : isHovered
              ? "2px solid #60a5fa"
              : "none",
            boxShadow: isSelected
              ? "0 0 0 3px rgba(59, 130, 246, 0.2)"
              : "none",
            cursor: isSelected && mode === "select" && !element.locked ? "move" : "default",
            transform: isDragging ? "scale(1.02)" : "none",
            transition: isDragging ? "none" : "transform 0.1s",
          }}
        >
          {/* Custom CSS */}
          {element.css && (
            <style dangerouslySetInnerHTML={{ __html: element.css }} />
          )}

          {/* HTML content */}
          <div
            className="h-full w-full"
            dangerouslySetInnerHTML={{ __html: element.htmlContent || "<p>Empty HTML element</p>" }}
          />

          {/* Selection indicator */}
          {isSelected && (
            <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-blue-600 px-2 py-1 text-xs text-white">
              Selected
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo optimization
  return (
    prevProps.element.id === nextProps.element.id &&
    prevProps.element.htmlContent === nextProps.element.htmlContent &&
    prevProps.element.position.x === nextProps.element.position.x &&
    prevProps.element.position.y === nextProps.element.position.y &&
    prevProps.element.position.z === nextProps.element.position.z &&
    prevProps.element.scale === nextProps.element.scale &&
    prevProps.element.opacity === nextProps.element.opacity
  );
});

HTMLElement.displayName = "HTMLElement";

export default HTMLElement;
