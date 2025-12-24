/**
 * Presentation Template System
 *
 * Each template defines a unique visual style and prompt structure for presentation generation
 */

export interface PresentationTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "professional" | "creative" | "technical" | "minimal";
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  systemPrompt: string;
  slideStructure: string;
}

/**
 * Hand-Drawn Sketchbook Template
 * Based on user's provided example - warm, friendly, creative style
 */
const HAND_DRAWN_TEMPLATE: PresentationTemplate = {
  id: "hand-drawn",
  name: "Hand-Drawn Sketchbook",
  description: "Warm, hand-drawn illustration style simulating an artist's sketchbook",
  icon: "✏️",
  category: "creative",
  colors: {
    primary: "#3E3C38",    // Warm charcoal gray
    secondary: "#FF7F7F",  // Soft coral red
    accent: "#8FA87A",     // Sage green
    background: "#F9F7F2", // Soft off-white
  },
  systemPrompt: `You are The Architect, a precision AI designed to visualize instructions as high-end blueprint-style data displays.

**CORE DIRECTIVES:**
1. Analyze the structure, intent, and key elements of user prompts
2. Transform instructions into clean, structured visual metaphors (blueprints, diagrams, schematics)
3. Use specific, restrained color palettes and font families for maximum clarity and professional impact
4. All visual outputs must strictly maintain 16:9 aspect ratio
5. Present information in triptych or grid-based layouts, balancing text and visuals

**STYLE INSTRUCTIONS:**
Design Aesthetic: Warm hand-drawn illustration style, simulating an artist's sketchbook. Overall atmosphere is relaxed, friendly, and creative. Lines should have natural hand-drawn waves and imperfections, avoiding rigid geometric lines.

Background Color: Soft off-white with subtle watercolor paper texture, hex code #F9F7F2

Primary Font: Similar to "YanShiYouRanXiaoKai" or handwritten round style. Titles should appear casual but clear, like marker writing

Secondary Font: Clear handwriting or rounded sans-serif for body text, maintaining readability while keeping approachability

Color Palette:
- Primary Text Color: Warm charcoal gray, #3E3C38 (simulating pencil or ink)
- Primary Accent Color: Soft coral red #FF7F7F and sage green #8FA87A for highlights and visual emphasis

Visual Elements: All charts, arrows, and borders should look hand-drawn with pencil or marker. Use simple stick figures, lightbulbs, stars, and wavy connectors. Shadows should use rough hatching rather than gradients.`,
  slideStructure: `**SLIDE STRUCTURE:**

Each slide must include:
1. NARRATIVE GOAL: The emotional/strategic purpose of this slide
2. KEY CONTENT: Main text elements (title, subtitle, bullet points)
3. VISUAL: Detailed description of hand-drawn illustrations
4. LAYOUT: Spatial arrangement and composition guidelines

Format each slide as:
## Slide N: [Title]
**NARRATIVE GOAL:** [Purpose and tone]
**KEY CONTENT:**
- Title: [Main heading]
- Content: [Key points]

**VISUAL:** [Detailed illustration description with hand-drawn elements]
**LAYOUT:** [Composition structure - poster, grid, triptych, etc.]`,
};

/**
 * Modern Blueprint Template
 * Technical, precise, architectural style
 */
const BLUEPRINT_TEMPLATE: PresentationTemplate = {
  id: "blueprint",
  name: "Modern Blueprint",
  description: "Technical architectural style with precise lines and professional diagrams",
  icon: "📐",
  category: "technical",
  colors: {
    primary: "#0F172A",    // Dark slate
    secondary: "#3B82F6",  // Blueprint blue
    accent: "#06B6D4",     // Cyan
    background: "#F8FAFC", // Light slate
  },
  systemPrompt: `You are The Architect, specializing in technical blueprint-style presentations.

**STYLE:**
- Clean, precise lines and geometric shapes
- Technical diagrams with architectural precision
- Grid-based layouts with exact measurements
- Professional sans-serif fonts (similar to DIN or Helvetica)
- Monochromatic blue color scheme with cyan accents
- All elements aligned to strict grid system
- Technical annotations and dimension lines where appropriate`,
  slideStructure: `Create structured slides with:
- Clear hierarchy and grid alignment
- Technical diagrams with precise measurements
- Annotation callouts with connecting lines
- Professional spacing and margins`,
};

/**
 * Minimal Modern Template
 * Clean, spacious, contemporary design
 */
const MINIMAL_TEMPLATE: PresentationTemplate = {
  id: "minimal",
  name: "Minimal Modern",
  description: "Clean, spacious design with bold typography and ample white space",
  icon: "▫️",
  category: "minimal",
  colors: {
    primary: "#1A1A1A",    // Almost black
    secondary: "#666666",  // Medium gray
    accent: "#000000",     // Pure black
    background: "#FFFFFF", // Pure white
  },
  systemPrompt: `You are a minimalist designer focused on clarity through simplicity.

**STYLE:**
- Maximum white space for breathing room
- Bold, oversized typography
- Monochromatic color scheme
- Simple geometric shapes only
- No decorative elements
- High contrast for impact
- Modern sans-serif fonts (similar to Helvetica Neue or Inter)
- Single focal point per slide`,
  slideStructure: `Create minimal slides with:
- One key message per slide
- Large, bold typography
- Maximum 3 visual elements
- Generous margins and spacing
- High contrast between text and background`,
};

/**
 * Corporate Professional Template
 * Traditional business presentation style
 */
const CORPORATE_TEMPLATE: PresentationTemplate = {
  id: "corporate",
  name: "Corporate Professional",
  description: "Traditional business style with formal layouts and corporate colors",
  icon: "💼",
  category: "professional",
  colors: {
    primary: "#1E3A8A",    // Navy blue
    secondary: "#64748B",  // Slate gray
    accent: "#3B82F6",     // Business blue
    background: "#F1F5F9", // Light gray
  },
  systemPrompt: `You are a corporate presentation designer creating formal business presentations.

**STYLE:**
- Professional and conservative design
- Traditional layouts with clear hierarchy
- Corporate color scheme (navy, gray, blue)
- Formal serif or sans-serif fonts
- Charts and graphs with business styling
- Bullet points and numbered lists
- Company-presentation aesthetic`,
  slideStructure: `Create professional slides with:
- Clear title and subtitle structure
- Organized bullet points
- Business-appropriate charts
- Consistent header/footer
- Professional imagery and icons`,
};

/**
 * Vibrant Creative Template
 * Colorful, energetic, modern creative style
 */
const CREATIVE_TEMPLATE: PresentationTemplate = {
  id: "creative",
  name: "Vibrant Creative",
  description: "Colorful and energetic design with bold colors and dynamic layouts",
  icon: "🎨",
  category: "creative",
  colors: {
    primary: "#EC4899",    // Hot pink
    secondary: "#8B5CF6",  // Purple
    accent: "#F59E0B",     // Amber
    background: "#FEFCE8", // Light yellow
  },
  systemPrompt: `You are a creative designer making bold, colorful, energetic presentations.

**STYLE:**
- Vibrant, saturated colors
- Asymmetric, dynamic layouts
- Playful typography with varied sizes
- Gradient backgrounds
- Organic shapes and flowing lines
- Mixed media aesthetic
- Fun icons and illustrations
- Energetic composition`,
  slideStructure: `Create vibrant slides with:
- Bold color combinations
- Dynamic, asymmetric layouts
- Playful visual elements
- Creative typography treatments
- Flowing shapes and gradients`,
};

/**
 * All available templates
 */
export const PRESENTATION_TEMPLATES: Record<string, PresentationTemplate> = {
  "hand-drawn": HAND_DRAWN_TEMPLATE,
  "blueprint": BLUEPRINT_TEMPLATE,
  "minimal": MINIMAL_TEMPLATE,
  "corporate": CORPORATE_TEMPLATE,
  "creative": CREATIVE_TEMPLATE,
};

/**
 * Default template if none selected
 */
export const DEFAULT_TEMPLATE_ID = "corporate";

/**
 * Get template by ID with fallback to default
 */
export function getTemplate(templateId?: string): PresentationTemplate {
  if (!templateId || !PRESENTATION_TEMPLATES[templateId]) {
    const defaultTemplate = PRESENTATION_TEMPLATES[DEFAULT_TEMPLATE_ID];
    if (!defaultTemplate) {
      throw new Error(`Default template '${DEFAULT_TEMPLATE_ID}' not found`);
    }
    return defaultTemplate;
  }
  const template = PRESENTATION_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Template '${templateId}' not found`);
  }
  return template;
}

/**
 * Get all templates grouped by category
 */
export function getTemplatesByCategory() {
  const templates = Object.values(PRESENTATION_TEMPLATES);
  const grouped: Record<string, PresentationTemplate[]> = {
    professional: [],
    creative: [],
    technical: [],
    minimal: [],
  };

  templates.forEach((template) => {
    grouped[template.category].push(template);
  });

  return grouped;
}
