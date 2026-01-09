/**
 * PreziElement Component
 *
 * Base renderer for all Prezi canvas elements.
 * Routes to specific element renderers based on type.
 */

"use client";

import React from "react";
import { type PreziElement as PreziElementType } from "@/types/prezi-types";
import TextElement from "./elements/TextElement";
import ImageElement from "./elements/ImageElement";
import HTMLElement from "./elements/HTMLElement";
import ShapeElement from "./elements/ShapeElement";
import GroupElement from "./elements/GroupElement";
import EmbedElement from "./elements/EmbedElement";

interface PreziElementProps {
  element: PreziElementType;
}

/**
 * Main PreziElement router component
 */
const PreziElement: React.FC<PreziElementProps> = ({ element }) => {
  // Route to specific element renderer based on type
  switch (element.type) {
    case "text":
      return <TextElement element={element} />;

    case "image":
      return <ImageElement element={element} />;

    case "html":
      return <HTMLElement element={element} />;

    case "shape":
      return <ShapeElement element={element} />;

    case "group":
      return <GroupElement element={element} />;

    case "embed":
      return <EmbedElement element={element} />;

    default:
      // Type guard: should never reach here
      console.warn("Unknown element type:", (element as any).type);
      return null;
  }
};

export default PreziElement;
