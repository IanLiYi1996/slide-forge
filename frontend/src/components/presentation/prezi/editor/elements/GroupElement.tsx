/**
 * GroupElement Component
 *
 * Renders group container elements on the Prezi canvas.
 * Placeholder implementation - to be fully implemented in Phase 2.
 */

"use client";

import React from "react";
import { type PreziGroupElement } from "@/types/prezi-types";

interface GroupElementProps {
  element: PreziGroupElement;
}

/**
 * GroupElement component (placeholder)
 */
const GroupElement: React.FC<GroupElementProps> = ({ element }) => {
  console.log("GroupElement (placeholder):", element);
  return null; // Placeholder: to be implemented
};

export default GroupElement;
