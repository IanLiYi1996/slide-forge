/**
 * ShapeElement Component
 *
 * Renders shape elements (rectangle, circle, arrow) on the Prezi canvas.
 * Placeholder implementation - to be fully implemented in Phase 2.
 */

"use client";

import React from "react";
import { type PreziShapeElement } from "@/types/prezi-types";

interface ShapeElementProps {
  element: PreziShapeElement;
}

/**
 * ShapeElement component (placeholder)
 */
const ShapeElement: React.FC<ShapeElementProps> = ({ element }) => {
  console.log("ShapeElement (placeholder):", element);
  return null; // Placeholder: to be implemented
};

export default ShapeElement;
