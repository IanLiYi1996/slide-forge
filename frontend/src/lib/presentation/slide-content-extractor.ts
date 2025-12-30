import { type PlateSlide } from "@/components/presentation/utils/parser";

/**
 * Extract slide content as readable text for image generation
 * Converts Plate.js content structure to markdown-like text
 */
export function extractSlideContentAsText(slide: PlateSlide, index: number): string {
  let text = `# Slide ${index + 1}\n\n`;

  if (!slide.content || !Array.isArray(slide.content)) {
    return text + "Empty slide";
  }

  // Recursively extract text from Plate.js nodes
  const extractTextFromNode = (node: unknown, level = 0): string => {
    if (!node || typeof node !== "object") return "";

    const n = node as Record<string, unknown>;
    let result = "";

    // Extract text content
    if (n.text && typeof n.text === "string") {
      return n.text;
    }

    // Handle different node types
    const type = n.type as string | undefined;
    const children = n.children as unknown[] | undefined;

    if (type && children) {
      const childText = children
        .map((child) => extractTextFromNode(child, level + 1))
        .join("");

      switch (type) {
        case "h1":
          result = `\n# ${childText}\n`;
          break;
        case "h2":
          result = `\n## ${childText}\n`;
          break;
        case "h3":
          result = `\n### ${childText}\n`;
          break;
        case "p":
          result = `${childText}\n`;
          break;
        case "li":
          result = `- ${childText}\n`;
          break;
        case "ul":
        case "ol":
          result = `\n${childText}`;
          break;
        default:
          result = childText;
      }
    } else if (children) {
      result = children
        .map((child) => extractTextFromNode(child, level + 1))
        .join("");
    }

    return result;
  };

  // Extract all text from content
  const contentText = slide.content
    .map((node) => extractTextFromNode(node))
    .join("")
    .trim();

  text += contentText || "No content";

  // Add layout information
  if (slide.layoutType) {
    text += `\n\n**Layout:** ${slide.layoutType}`;
  }

  // Add root image query if present
  if (slide.rootImage?.query) {
    text += `\n**Visual Theme:** ${slide.rootImage.query}`;
  }

  return text;
}

/**
 * Build a complete prompt for slide image generation
 * Combines slide content with template style guidance
 */
export function buildSlideImagePrompt(
  slideContent: string,
  templateSystemPrompt: string,
): string {
  return `${templateSystemPrompt}

---

**YOUR TASK:**
Create a complete, professional presentation slide visualization based on the following content.
Apply all the style guidelines above to create a cohesive, visually stunning slide.

**SLIDE CONTENT:**
${slideContent}

**REQUIREMENTS:**
1. Create ONE complete slide image in the specified style
2. Include ALL text from the slide content with proper hierarchy
3. Apply the exact color palette specified in the style guide
4. Use appropriate typography as defined in the style guide
5. Add relevant visual elements (icons, illustrations, diagrams, decorations)
6. Ensure perfect text readability and positioning
7. Maintain 16:9 aspect ratio
8. Make it look like a professional presentation slide
9. Follow the aesthetic direction (hand-drawn, blueprint, minimal, etc.)
10. Balance text and visual elements harmoniously

**IMPORTANT:**
- This is a presentation slide, not a poster or infographic
- Text should be the primary focus, visuals should support
- Maintain professional presentation standards
- Apply the template's unique visual style consistently

Generate the complete slide visualization now.`;
}
