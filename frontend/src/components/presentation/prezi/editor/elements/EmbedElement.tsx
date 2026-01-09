/**
 * EmbedElement Component
 *
 * Renders embedded content (video, iframe) on the Prezi canvas.
 * Placeholder implementation - to be fully implemented in Phase 2.
 */

"use client";

import React from "react";
import { type PreziEmbedElement } from "@/types/prezi-types";

interface EmbedElementProps {
  element: PreziEmbedElement;
}

/**
 * EmbedElement component (placeholder)
 */
const EmbedElement: React.FC<EmbedElementProps> = ({ element }) => {
  console.log("EmbedElement (placeholder):", element);
  return null; // Placeholder: to be implemented
};

export default EmbedElement;
