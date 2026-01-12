/**
 * Prezi Generation API
 *
 * Generates complete Prezi presentations from user topics and outlines using AI.
 */

import { auth } from "@/server/auth";
import { streamText } from "ai";
import { modelPicker } from "@/lib/model-picker";
import { NextResponse } from "next/server";

export const maxDuration = 180; // 3 minutes

interface GeneratePreziRequest {
  topic: string;
  outline: string[];
  language: string;
  numberOfSlides: number;
  style?: string;
  enableWebSearch?: boolean;
  modelProvider?: string;
  modelId?: string;
}

const PREZI_GENERATION_PROMPT = `You are an expert Prezi-style presentation designer.

Your task is to create a complete 3D canvas-based presentation from a topic and outline.

## INPUT
Topic: {TOPIC}
Language: {LANGUAGE}
Number of Slides: {NUM_SLIDES}
Style: {STYLE}

Outline:
{OUTLINE}

## OUTPUT FORMAT

Return a JSON object with the following structure:

\`\`\`json
{
  "elements": [
    {
      "id": "unique-id",
      "type": "text" | "image" | "html" | "shape",
      "content": "...",
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 0 },
      "scale": 1,
      "size": { "width": 300, "height": 100 },
      "opacity": 1,
      "zIndex": 0,
      "locked": false,
      "animation": {
        "type": "zoom",
        "direction": "in",
        "duration": 1
      }
    }
  ],
  "keyframes": [
    {
      "id": "keyframe-1",
      "order": 0,
      "camera": {
        "position": { "x": 0, "y": 0, "z": 1000 },
        "target": { "x": 0, "y": 0, "z": 0 },
        "zoom": 1
      },
      "duration": 3,
      "transition": {
        "type": "ease-in-out",
        "duration": 1.5
      },
      "highlightElements": ["element-id"],
      "elementAnimations": {
        "element-id": "enter"
      }
    }
  ]
}
\`\`\`

## DESIGN PRINCIPLES

### 1. Spatial Layout (3D Canvas Strategy)

**Concept Clustering**: Group related concepts in 3D space
- Main topic at center (0, 0, 0)
- Subtopics radiate outward in a circular or grid pattern
- Use Z-axis for layers (foreground/background)

**Distance = Hierarchy**:
- Level 1 (Main title): 0-500 units from center
- Level 2 (Sections): 500-1000 units
- Level 3 (Details): 1000-1500 units

**Example Layout for 4-section presentation**:
\`\`\`
Center (0, 0, 0): Main Title
(-800, 0, 0): Section 1
(800, 0, 0): Section 2
(0, 800, 0): Section 3
(0, -800, 0): Section 4
\`\`\`

**Avoid Overlaps**: Ensure elements are at least 300 units apart.

### 2. Element Types

**Text Elements**:
- Use for titles, bullet points, quotes
- Size: **1200-1600px width, 400-600px height** (LARGE for maximum visibility)
- Content format for text elements:
  \`\`\`json
  "content": [
    {
      "type": "p",
      "children": [
        { "text": "Main content", "bold": true }
      ]
    },
    {
      "type": "p",
      "children": [
        { "text": "Bullet point 1" }
      ]
    }
  ]
  \`\`\`
- Main titles: **1400-1600px width, 500-600px height** (VERY LARGE and prominent)
- Content blocks: **1200-1400px width, 400-500px height** (LARGE for easy reading)
- backgroundColor: **REQUIRED** - always set to ensure text visibility (e.g., "#ffffff" for white, "#f0f0f0" for light gray)
- **CRITICAL**: Always include backgroundColor for text elements to ensure visibility
- **Font will be 48px bold** - design for large, readable text that fills the frame

**Image Elements**:
- Use Unsplash URLs: https://images.unsplash.com/photo-[id]?w=800
- Search keywords: business, technology, nature, education, teamwork, etc.
- Size: 400-800px width, 300-600px height
- Use for visual appeal and context

**HTML Elements**:
- Use for charts, diagrams, custom layouts
- Include complete HTML + inline CSS
- Size: 400-800px width, 300-600px height
- Example: Bar charts, timelines, infographics

**Shape Elements**:
- Use for backgrounds, connectors, decorations
- Types: "rectangle", "circle", "arrow"
- fillColor: e.g., "#3b82f6", "#f59e0b"
- strokeColor: e.g., "#1e40af"

### 3. Animation Strategy

**Element Animations**:
- Title elements: "zoom" (dramatic entrance)
- Content elements: "fade" or "scale"
- Image elements: "slide"
- Duration: 0.8-1.5 seconds
- Use "in" direction for enter animations

**Animation Types**:
- fade: Simple opacity animation
- zoom: Scale + fade (Prezi classic)
- scale: Size animation only
- slide: Position animation
- rotate: Rotation animation
- bounce: Bouncy scale effect
- flip: Rotation flip effect

**CRITICAL - When to Add Animations**:
- **DEFAULT**: Elements are visible immediately (opacity=1)
- **ONLY use elementAnimations** if you want a dramatic entrance effect
- **DO NOT** add elementAnimations for all elements - this causes them to be hidden initially
- **RECOMMENDED**: Add elementAnimations only to key elements (titles, important points)
- **SAFE APPROACH**: Don't use elementAnimations at all if unsure - elements will be visible by default

**Keyframe Transitions**:
- Quick transitions: 1 second (related concepts)
- Slow transitions: 2-3 seconds (between sections)
- Use "ease-in-out" for smooth motion

### 4. Camera Choreography (CRITICAL: 基于视锥体计算)

**视锥体公式** (FOV=50°, 宽高比=1.78):
- 可见高度 = 2 * tan(25°) * 距离 ≈ 0.933 * 距离
- 可见宽度 = 可见高度 * 1.78 ≈ 1.66 * 距离

**所需距离计算** (让元素铺满整个镜头):
给定元素尺寸 (宽 W, 高 H) 和边距系数 P=0.8（元素超填充，占满120%视野）:
- 从高度: 距离 = (H * P) / 0.933
- 从宽度: 距离 = (W * P) / 1.66
- **实际距离 = max(从高度, 从宽度)**, 然后向上取整到最近的 50

**计算示例** (基于新的大尺寸元素):
1. 元素 1200x400px → 距离 = max(343, 578) = **600** (元素铺满视野)
2. 元素 1400x500px → 距离 = max(429, 675) = **700**
3. 元素 1600x600px → 距离 = max(515, 771) = **800**
4. 多元素包围盒 2000x800px → 距离 = max(687, 964) = **1000**

**CRITICAL**:
- 使用非常近的距离（P=0.8）让元素铺满整个镜头
- 元素应该占据视野的 100-120%
- 用户应该能清楚看到文字内容，不是小点

**相机定位规则** (MUST FOLLOW):
- position.x: 聚焦元素的中心 x 坐标
- position.y: 聚焦元素的中心 y 坐标
- position.z: 元素 z 坐标 + 计算的距离
- target.x/y/z: 聚焦元素的精确中心位置
- zoom: 始终为 1（距离控制缩放效果）

**Zoom Pattern** (using calculated distances for LARGE elements):
1. Start: Overview showing all elements (~1500-2000)
2. Zoom in: To first section at calculated distance (typically **600-800** for large text)
3. Navigate: Between sections with smooth transitions
4. Details: Close-up views (**600-800 range** - elements fill screen)
5. End: Return to moderate overview (~1500-2000)

**CRITICAL FOR VISIBILITY**:
- Keep cameras at **600-800** range for individual large text elements (1400-1600px wide)
- Elements should **fill the entire viewport** when focused
- Users should see **text content clearly**, not tiny dots
- Don't use z < 500 (too close) or z > 2000 (too far for single elements)

### 5. Content Guidelines

**Concise Text**:
- Titles: 5-10 words max
- Bullet points: 8-15 words each
- Total bullets per slide: 3-5 max

**Element Naming**:
- Use descriptive IDs: "title-main", "section-1", "image-teamwork", etc.

**Keyframe Titles**:
- Descriptive names for each keyframe (used in editor)
- Examples: "Introduction", "Section 1: Benefits", "Conclusion"

### 6. Best Practices

**DO**:
- Create a clear visual hierarchy with size and position
- Use animations to draw attention to key points
- Maintain consistent spacing between elements
- Use the Z-axis to create depth
- Include at least 1 image per 2-3 text elements

**DON'T**:
- Overlap elements (maintain 300+ unit spacing)
- Use too many different animation types
- Create keyframes that are too close to each other (< 800 units)
- Use extremely large or small element sizes

## EXAMPLE OUTPUT

Topic: "Cloud Computing Benefits"
Outline: ["Introduction", "Cost Savings", "Scalability", "Security"]

\`\`\`json
{
  "elements": [
    {
      "id": "title-main",
      "type": "text",
      "content": [{"type": "p", "children": [{"text": "Cloud Computing Benefits", "bold": true}]}],
      "position": {"x": 0, "y": 0, "z": 0},
      "rotation": {"x": 0, "y": 0, "z": 0},
      "scale": 1,
      "size": {"width": 1600, "height": 600},
      "opacity": 1,
      "zIndex": 0,
      "locked": false,
      "backgroundColor": "#ffffff",
      "padding": 30
    },
    {
      "id": "section-1-title",
      "type": "text",
      "content": [{"type": "p", "children": [{"text": "Cost Savings", "bold": true}]}],
      "position": {"x": -2000, "y": 0, "z": 0},
      "rotation": {"x": 0, "y": 0, "z": 0},
      "scale": 1,
      "size": {"width": 1400, "height": 500},
      "opacity": 1,
      "zIndex": 0,
      "locked": false,
      "backgroundColor": "#ffffff",
      "padding": 30
    },
    {
      "id": "section-1-image",
      "type": "image",
      "url": "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800",
      "position": {"x": -800, "y": 300, "z": 0},
      "rotation": {"x": 0, "y": 0, "z": 0},
      "scale": 1,
      "size": {"width": 400, "height": 300},
      "opacity": 1,
      "zIndex": 0,
      "locked": false,
      "animation": {"type": "slide", "direction": "in", "duration": 1}
    }
  ],
  "keyframes": [
    {
      "id": "keyframe-intro",
      "order": 0,
      "camera": {
        "position": {"x": 0, "y": 0, "z": 800},
        "target": {"x": 0, "y": 0, "z": 0},
        "zoom": 1
      },
      "duration": 3,
      "transition": {"type": "ease-in-out", "duration": 1.5},
      "title": "Introduction",
      "highlightElements": ["title-main"]
    },
    {
      "id": "keyframe-section-1",
      "order": 1,
      "camera": {
        "position": {"x": -2000, "y": 0, "z": 700},
        "target": {"x": -2000, "y": 0, "z": 0},
        "zoom": 1
      },
      "duration": 5,
      "transition": {"type": "ease-in-out", "duration": 2},
      "title": "Cost Savings",
      "highlightElements": ["section-1-title", "section-1-image"]
    }
  ]
}
\`\`\`

Now generate a complete Prezi presentation based on the input above.
Return ONLY the JSON object without markdown code blocks or any extra text.`;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      topic,
      outline,
      language,
      numberOfSlides,
      style = "professional",
      enableWebSearch = false,
      modelProvider = "openai",
      modelId,
    } = (await req.json()) as GeneratePreziRequest;

    if (!topic || !outline || !language || !numberOfSlides) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const model = modelPicker(modelProvider, modelId);

    const formattedPrompt = PREZI_GENERATION_PROMPT.replace(/{TOPIC}/g, topic)
      .replace(/{LANGUAGE}/g, language)
      .replace(/{NUM_SLIDES}/g, numberOfSlides.toString())
      .replace(/{STYLE}/g, style)
      .replace(/{OUTLINE}/g, outline.map((item, i) => `${i + 1}. ${item}`).join("\n"));

    const result = streamText({
      model,
      prompt: formattedPrompt,
      // Request JSON output format
      experimental_providerMetadata: {
        anthropic: {
          response_format: { type: "json_object" },
        },
        openai: {
          response_format: { type: "json_object" },
        },
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error in Prezi generation:", error);
    return NextResponse.json(
      { error: "Failed to generate Prezi presentation" },
      { status: 500 }
    );
  }
}
