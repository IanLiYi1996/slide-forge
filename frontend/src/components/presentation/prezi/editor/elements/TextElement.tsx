/**
 * TextElement Component
 *
 * Renders text elements on the Prezi canvas using HTML overlay.
 * Integrates with Plate.js editor for rich text editing.
 */

"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { Html } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useGesture } from "@use-gesture/react";
import { usePreziEditorStore } from "@/states/prezi-editor-state";
import { type PreziTextElement } from "@/types/prezi-types";
import { elementRefManager } from "@/lib/presentation/prezi/element-ref-manager";
import { calculateAdaptiveFontSize, calculateCameraDistance } from "@/lib/presentation/prezi/text-utils";
import * as THREE from "three";

interface TextElementProps {
  element: PreziTextElement;
}

/**
 * TextElement component
 */
const TextElement: React.FC<TextElementProps> = React.memo(({ element }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [adaptiveFontSize, setAdaptiveFontSize] = useState(48);

  const { camera, size } = useThree();
  const selectedElements = usePreziEditorStore(
    (state) => state.selectedElements
  );
  const selectElements = usePreziEditorStore((state) => state.selectElements);
  const hoveredElement = usePreziEditorStore((state) => state.hoveredElement);
  const updateElement = usePreziEditorStore((state) => state.updateElement);
  const mode = usePreziEditorStore((state) => state.mode);
  const isPlaying = usePreziEditorStore((state) => state.isPlaying);

  const isSelected = selectedElements.includes(element.id);

  // Calculate adaptive font size based on camera distance
  // This ensures text remains readable when camera is far away
  useFrame(() => {
    if (camera && element.position) {
      const distance = calculateCameraDistance(camera.position, element.position);
      const newFontSize = calculateAdaptiveFontSize(
        48, // base font size
        distance,
        element.scale
      );

      // Only update if changed significantly (avoid unnecessary re-renders)
      if (Math.abs(newFontSize - adaptiveFontSize) > 1) {
        setAdaptiveFontSize(newFontSize);
      }
    }
  });

  // ✨ Check visibility
  if (element.visible === false) {
    return null; // Don't render if hidden
  }

  // ✨ Register Three.js object to ElementRefManager for animations
  useEffect(() => {
    if (groupRef.current) {
      elementRefManager.register(element.id, groupRef.current);
    }
    return () => {
      elementRefManager.unregister(element.id);
    };
  }, [element.id]);

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
          const dragScale = camera.position.z / 1000; // Scale based on camera distance
          updateElement(element.id, {
            position: {
              x: element.position.x + x * dragScale,
              y: element.position.y - y * dragScale, // Invert Y
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

  // Extract text content for display (simplified)
  const textContent = element.content
    .map((node: any) => {
      if (node.type === "p" && node.children) {
        return node.children
          .map((child: any) => child.text || "")
          .join("");
      }
      return "";
    })
    .join("\n");

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

      {/* HTML overlay for text content */}
      <Html
        transform
        occlude={false}
        zIndexRange={[100, 0]} // ✨ Ensure text renders on top
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
            backgroundColor:
              element.backgroundColor === "transparent" || element.backgroundColor === "none"
                ? "transparent"
                : element.backgroundColor || "#ffffff",
            padding: `${element.padding || 16}px`,
            opacity: element.opacity,
            border: isSelected
              ? "3px solid #3b82f6"
              : isHovered
              ? "2px solid #60a5fa"
              : element.backgroundColor === "transparent" || element.backgroundColor === "none"
              ? "1px solid rgba(0, 0, 0, 0.2)" // 透明背景时用更明显的边框
              : "1px solid #e5e7eb",
            boxShadow: isSelected
              ? "0 0 0 4px rgba(59, 130, 246, 0.3), 0 4px 20px rgba(59, 130, 246, 0.4)"
              : isHovered
              ? "0 2px 8px rgba(0, 0, 0, 0.15)"
              : element.backgroundColor === "transparent" || element.backgroundColor === "none"
              ? "none" // 透明背景时无阴影
              : "0 1px 3px rgba(0, 0, 0, 0.1)",
            outline: isSelected ? "2px solid #3b82f6" : "none",
            cursor: isSelected && mode === "select" && !element.locked ? "move" : "default",
            transform: isDragging ? "scale(1.02)" : "none",
            transition: isDragging ? "none" : "transform 0.1s",
          }}
        >
          {/* Text content (simplified rendering) */}
          <div
            className="h-full w-full text-left flex items-center"
            style={{
              fontSize: `${adaptiveFontSize}px`, // ✨ Adaptive font size based on camera distance
              lineHeight: "1.3",
              color: "#000000",
              fontWeight: "600", // ✨ 更粗的字重
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {textContent || "Empty text element"}
          </div>

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
    prevProps.element.position.x === nextProps.element.position.x &&
    prevProps.element.position.y === nextProps.element.position.y &&
    prevProps.element.position.z === nextProps.element.position.z &&
    prevProps.element.scale === nextProps.element.scale &&
    prevProps.element.opacity === nextProps.element.opacity
  );
});

TextElement.displayName = "TextElement";

export default TextElement;
