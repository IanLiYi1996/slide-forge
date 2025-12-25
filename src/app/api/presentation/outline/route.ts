import { modelPicker } from "@/lib/model-picker";
import { auth } from "@/server/auth";
import { streamText } from "ai";
import { NextResponse } from "next/server";

interface OutlineRequest {
  prompt: string;
  numberOfCards: number;
  language: string;
  modelProvider?: string;
  modelId?: string;
  modelName?: string;
}

const outlineTemplate = `Given the following presentation topic and requirements, generate a structured outline with {numberOfCards} slides in a detailed format optimized for AI image generation.
The outline should be in {language} language.

Current Date: {currentDate}
Topic: {prompt}

Generate exactly {numberOfCards} slides with a complete structured format for each slide that includes narrative purpose, content structure, visual descriptions, and layout guidance.

Each slide MUST follow this exact structure:

Slide N: [Slide Title]

// NARRATIVE GOAL (叙事目标)
[A brief 1-2 sentence description of the emotional/strategic purpose of this slide - what feeling or message should it convey to the audience]

// KEY CONTENT (关键内容)
[Main text elements in structured format:
- For title/cover slides: List the main title and subtitle
- For content slides: List 2-3 key points or main sections
Keep it concise - each item should be one clear statement]

// VISUAL (视觉画面)
[Detailed 2-3 sentence description of visual elements to include:
- Central illustration, diagram, or image concept
- Visual metaphors or symbolic elements
- Suggested colors, icons, or graphical elements
- Overall visual style (hand-drawn, modern, technical, etc.)
Be specific but concise - focus on key visual elements]

// LAYOUT (布局结构)
[Brief 1-2 sentence description of spatial arrangement:
- Layout style (poster, grid, triptych, centered, split-screen, etc.)
- Text positioning (centered, left-aligned, top, bottom)
- Visual element placement (center, sides, background, foreground)
- Balance between text and imagery]

Example slide format:

Slide 1: Introduction - The Challenge We Face

// NARRATIVE GOAL (叙事目标)
Open with an engaging, problem-focused tone that immediately captures attention by identifying a key pain point the audience experiences. Set an approachable, solution-oriented atmosphere.

// KEY CONTENT (关键内容)
Title: Solving the Modern Workplace Challenge
Subtitle: A New Approach to Remote Collaboration
Context: Why traditional methods are failing

// VISUAL (视觉画面)
A dynamic illustration showing a broken chain being reconnected with a glowing digital link. Surrounding the main image are floating icons representing common workplace tools (laptop, calendar, chat bubble). Use warm, optimistic colors - soft blues and energizing oranges. Style should be modern and clean with subtle hand-drawn elements.

// LAYOUT (布局结构)
Centered poster layout with the title prominently displayed at top in large, bold typography. Main illustration occupies the central 60% of the slide with ample breathing room. Subtitle sits just below the title in a lighter weight. Icons are tastefully scattered around the edges.

Now generate {numberOfCards} slides following this exact format.
First, provide the presentation title in XML tags:
<TITLE>Your Generated Presentation Title Here</TITLE>

Then provide each slide with the complete structure above. Ensure each slide:
1. Has a clear narrative purpose that flows logically to the next slide
2. Contains specific, actionable content (not vague descriptions)
3. Includes detailed visual descriptions that an AI image generator can interpret
4. Specifies clear layout guidance for professional presentation design
5. Uses concise language - avoid unnecessary words
6. Maintains consistency in tone and style across all slides`;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      prompt,
      numberOfCards,
      language,
      modelProvider = "openai",
      modelId,
      modelName,
    } = (await req.json()) as OutlineRequest;

    if (!prompt || !numberOfCards || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }
    const languageMap: Record<string, string> = {
      "en-US": "English (US)",
      pt: "Portuguese",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      ru: "Russian",
      hi: "Hindi",
      ar: "Arabic",
    };

    const actualLanguage = languageMap[language] ?? language; // Fallback to the original if not found
    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const model = modelPicker(modelProvider, modelId, modelName);

    // Format the prompt with template variables
    const formattedPrompt = outlineTemplate
      .replace(/{numberOfCards}/g, numberOfCards.toString())
      .replace(/{language}/g, actualLanguage)
      .replace(/{currentDate}/g, currentDate)
      .replace(/{prompt}/g, prompt);

    const result = streamText({
      model,
      prompt: formattedPrompt,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error in outline generation:", error);
    return NextResponse.json(
      { error: "Failed to generate outline" },
      { status: 500 },
    );
  }
}
