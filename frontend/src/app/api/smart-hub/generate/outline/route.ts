import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { streamText } from 'ai';
import { modelPicker } from '@/lib/model-picker';
import { getBedrockClaudeService } from '@/lib/bedrock/bedrock-claude-service';
import {
  getHubSessionByUserId,
  updateHubSession,
  initializePagesFromOutline,
} from '@/services/s3/hub-session-service';
import { type GenerateConfig } from '@/types/smart-hub';
import { env } from '@/env';
import { webSearchTool, isWebSearchAvailable } from './search-tool';

export const maxDuration = 60; // 1 minute

// Outline generation prompt template - Detailed format for AI image generation
const OUTLINE_GENERATION_PROMPT = `Given the following presentation topic and requirements, generate a structured outline with {NUM_SLIDES} slides in a detailed format optimized for AI image generation.
The outline should be in {LANGUAGE} language.

Topic: {CONTENT}
Style: {STYLE}
Tone: {TONE}

Generate exactly {NUM_SLIDES} slides with a complete structured format for each slide that includes narrative purpose, content structure, visual descriptions, and layout guidance.

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
- Overall visual style
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
Centered poster layout with the title prominently displayed at top in large, bold typography. Main illustration occupies the central 60% of the slide with ample breathing room. Subtitle sits just below the title in a lighter weight.

Now generate {NUM_SLIDES} slides following this exact format.

Return the result as a JSON object with "title" and "outline" fields:
{
  "title": "Your Generated Presentation Title Here",
  "outline": [
    "Slide 1: [Title]\\n\\n// NARRATIVE GOAL...\\n\\n// KEY CONTENT...\\n\\n// VISUAL...\\n\\n// LAYOUT...",
    "Slide 2: [Title]\\n\\n// NARRATIVE GOAL...\\n\\n// KEY CONTENT...\\n\\n// VISUAL...\\n\\n// LAYOUT...",
    ...
  ]
}

Ensure each slide:
1. Has a clear narrative purpose that flows logically to the next slide
2. Contains specific, actionable content (not vague descriptions)
3. Includes detailed visual descriptions that an AI image generator can interpret
4. Specifies clear layout guidance for professional presentation design
5. Uses {LANGUAGE} language for all content
6. Applies {STYLE} style and {TONE} tone consistently`;

// POST /api/smart-hub/generate/outline - Generate outline from text
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, inputText, config, useStreaming = false } = body as {
      sessionId: string;
      inputText: string;
      config: GenerateConfig;
      useStreaming?: boolean;
    };

    if (!sessionId || !inputText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify session ownership
    const hubSession = await getHubSessionByUserId(sessionId, session.user.id);
    if (!hubSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update session status
    await updateHubSession(sessionId, session.user.id, {
      status: 'outline_generation',
      inputText,
      generateConfig: config,
    });

    // Determine which provider to use
    // Priority:
    // 1. If enableWebSearch is true and Tavily is available, use LLM with web search
    // 2. Otherwise: Bedrock (default) > LLM_API_KEY (OpenAI compatible as fallback)
    const preferLLM = config.customInstructions?.includes('use-llm') || false;
    const useWebSearch = config.enableWebSearch && isWebSearchAvailable();

    if (useWebSearch && env.LLM_API_KEY) {
      // Use LLM with web search tool (Tavily)
      console.log('[outline] Using LLM with Tavily web search');
      return await generateWithLLMAndSearch(
        sessionId,
        session.user.id,
        inputText,
        config,
        useStreaming
      );
    } else if (preferLLM && env.LLM_API_KEY) {
      // Use OpenAI compatible API with streaming support (only if explicitly requested)
      return await generateWithLLM(
        sessionId,
        session.user.id,
        inputText,
        config,
        useStreaming
      );
    } else {
      // Default: Use Bedrock Claude
      return await generateWithBedrock(sessionId, session.user.id, inputText, config);
    }
  } catch (error) {
    console.error('Error generating outline:', error);
    return NextResponse.json(
      { error: 'Failed to generate outline' },
      { status: 500 }
    );
  }
}

// Generate outline using OpenAI compatible API
async function generateWithLLM(
  sessionId: string,
  userId: string,
  inputText: string,
  config: GenerateConfig,
  useStreaming: boolean
) {
  const model = modelPicker('openai');

  const formattedPrompt = OUTLINE_GENERATION_PROMPT
    .replace(/{CONTENT}/g, inputText.slice(0, 4000))
    .replace(/{NUM_SLIDES}/g, config.numberOfSlides.toString())
    .replace(/{STYLE}/g, config.style || 'professional')
    .replace(/{TONE}/g, config.tone || 'professional')
    .replace(/{LANGUAGE}/g, config.language || 'en-US');

  if (useStreaming) {
    // Return streaming response
    const result = streamText({
      model,
      prompt: formattedPrompt,
      maxTokens: 1000,
    });

    return result.toDataStreamResponse();
  }

  // Non-streaming: get full response and parse JSON
  const result = streamText({
    model,
    prompt: formattedPrompt,
    maxTokens: 1000,
  });

  // Collect the full text
  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
  }

  // Parse the JSON response
  const parsed = parseOutlineResponse(fullText);

  if (!parsed.outline || parsed.outline.length === 0) {
    // Fallback outline
    const fallbackOutline = generateFallbackOutline(inputText, config.numberOfSlides);
    const title = extractTitle(inputText) || 'Untitled Presentation';

    const updatedSession = await initializePagesFromOutline(
      sessionId,
      userId,
      fallbackOutline,
      title
    );

    return NextResponse.json({
      outline: fallbackOutline,
      title,
      session: updatedSession,
      provider: 'llm-fallback',
    });
  }

  // Initialize pages from AI-generated outline
  const updatedSession = await initializePagesFromOutline(
    sessionId,
    userId,
    parsed.outline,
    parsed.title || 'Untitled Presentation'
  );

  return NextResponse.json({
    outline: parsed.outline,
    title: parsed.title,
    session: updatedSession,
    provider: 'llm',
  });
}

// Generate outline using LLM with web search (Tavily)
async function generateWithLLMAndSearch(
  sessionId: string,
  userId: string,
  inputText: string,
  config: GenerateConfig,
  useStreaming: boolean
) {
  const model = modelPicker('openai');

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const languageMap: Record<string, string> = {
    'en-US': 'English (US)',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    pt: 'Portuguese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
  };

  const actualLanguage = languageMap[config.language || 'en-US'] ?? config.language;

  const systemPrompt = `You are an expert presentation outline generator. Your task is to create a comprehensive and engaging presentation outline with detailed visual guidance for AI image generation.

Current Date: ${currentDate}

## Your Process:
1. **Analyze the topic** - Understand what the user wants to present
2. **Research if needed** - Use web search to find current, relevant information
3. **Generate detailed outline** - Create a structured outline with visual design guidance

## Web Search Guidelines:
- Use web search to find current statistics, recent developments, or expert insights
- Limit searches to 2-5 queries maximum
- Focus on finding information that directly relates to the presentation topic

## Slide Structure Requirements:
Generate exactly ${config.numberOfSlides} slides. Each slide MUST include these four sections:

Slide N: [Slide Title]

// NARRATIVE GOAL (叙事目标)
[1-2 sentences describing the emotional/strategic purpose]

// KEY CONTENT (关键内容)
[Main text elements - title/subtitle for cover, 2-3 key points for content]

// VISUAL (视觉画面)
[2-3 sentences describing visual elements, colors, icons, style for AI image generation]

// LAYOUT (布局结构)
[1-2 sentences on spatial arrangement - layout type, text positioning, image placement]

## Output Format:
Return a JSON object with "title" and "outline" fields:
{
  "title": "Presentation Title",
  "outline": [
    "Slide 1: [Title]\\n\\n// NARRATIVE GOAL...\\n\\n// KEY CONTENT...\\n\\n// VISUAL...\\n\\n// LAYOUT...",
    "Slide 2: [Title]\\n\\n// NARRATIVE GOAL...\\n\\n// KEY CONTENT...\\n\\n// VISUAL...\\n\\n// LAYOUT...",
    ...
  ]
}

## Additional Requirements:
- Use ${actualLanguage} language for all content
- Apply a ${config.tone || 'professional'} tone throughout
- Ensure logical flow from introduction to conclusion
- Include specific, actionable visual descriptions for AI image generators`;

  if (useStreaming) {
    // Return streaming response with tool calls
    const result = streamText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Create a presentation outline for: ${inputText.slice(0, 4000)}`,
        },
      ],
      tools: {
        webSearch: webSearchTool,
      },
      maxSteps: 5,
      toolChoice: 'auto',
      maxTokens: 2000,
    });

    return result.toDataStreamResponse();
  }

  // Non-streaming: get full response with tool calls
  const result = streamText({
    model,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Create a presentation outline for: ${inputText.slice(0, 4000)}`,
      },
    ],
    tools: {
      webSearch: webSearchTool,
    },
    maxSteps: 5,
    toolChoice: 'auto',
    maxTokens: 2000,
  });

  // Collect the full text
  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
  }

  // Parse the JSON response
  const parsed = parseOutlineResponse(fullText);

  if (!parsed.outline || parsed.outline.length === 0) {
    // Fallback outline
    const fallbackOutline = generateFallbackOutline(inputText, config.numberOfSlides);
    const title = extractTitle(inputText) || 'Untitled Presentation';

    const updatedSession = await initializePagesFromOutline(
      sessionId,
      userId,
      fallbackOutline,
      title
    );

    return NextResponse.json({
      outline: fallbackOutline,
      title,
      session: updatedSession,
      provider: 'llm-search-fallback',
    });
  }

  // Initialize pages from AI-generated outline
  const updatedSession = await initializePagesFromOutline(
    sessionId,
    userId,
    parsed.outline,
    parsed.title || 'Untitled Presentation'
  );

  return NextResponse.json({
    outline: parsed.outline,
    title: parsed.title,
    session: updatedSession,
    provider: 'llm-with-search',
  });
}

// Generate outline using Bedrock Claude
async function generateWithBedrock(
  sessionId: string,
  userId: string,
  inputText: string,
  config: GenerateConfig
) {
  const bedrockService = getBedrockClaudeService();
  const result = await bedrockService.generatePresentationContent({
    topic: inputText.slice(0, 500),
    slideCount: config.numberOfSlides,
    language: config.language,
    tone: config.tone,
    additionalContext: inputText.length > 500 ? inputText : undefined,
  });

  if (!result.success || !result.outline || result.outline.length === 0) {
    // Fallback outline
    const fallbackOutline = generateFallbackOutline(inputText, config.numberOfSlides);
    const title = extractTitle(inputText) || 'Untitled Presentation';

    const updatedSession = await initializePagesFromOutline(
      sessionId,
      userId,
      fallbackOutline,
      title
    );

    return NextResponse.json({
      outline: fallbackOutline,
      title,
      session: updatedSession,
      provider: 'bedrock-fallback',
    });
  }

  // Initialize pages from AI-generated outline
  const updatedSession = await initializePagesFromOutline(
    sessionId,
    userId,
    result.outline,
    result.title || 'Untitled Presentation'
  );

  return NextResponse.json({
    outline: result.outline,
    title: result.title,
    session: updatedSession,
    provider: 'bedrock',
  });
}

// Parse outline response from LLM
function parseOutlineResponse(text: string): { title?: string; outline: string[] } {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*"outline"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title,
        outline: Array.isArray(parsed.outline) ? parsed.outline : [],
      };
    }

    // Fallback: parse as plain text list
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('{') && !line.startsWith('}'));

    return {
      outline: lines,
    };
  } catch (error) {
    console.error('Error parsing outline response:', error);
    return { outline: [] };
  }
}

// Fallback outline generation when AI fails
function generateFallbackOutline(text: string, slideCount: number): string[] {
  const outline: string[] = [];
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // Slide 1: Title/Introduction
  outline.push('Introduction and Overview');

  // Distribute remaining paragraphs across slides
  const contentSlides = slideCount - 2; // -1 for intro, -1 for conclusion
  const paragraphsPerSlide = Math.max(1, Math.ceil(paragraphs.length / contentSlides));

  for (let i = 0; i < contentSlides && outline.length < slideCount - 1; i++) {
    const startIdx = i * paragraphsPerSlide;
    const chunk = paragraphs.slice(startIdx, startIdx + paragraphsPerSlide);

    if (chunk.length > 0 && chunk[0]) {
      const firstPara = chunk[0];
      const firstSentence = firstPara.split(/[.!?]/)[0];
      const title = firstSentence?.slice(0, 100).trim() || `Section ${i + 1}`;
      outline.push(title);
    } else {
      outline.push(`Content Section ${i + 1}`);
    }
  }

  // Last slide: Conclusion
  outline.push('Summary and Conclusion');

  return outline.slice(0, slideCount);
}

// Extract title from text
function extractTitle(text: string): string | null {
  // Check for markdown title
  const mdMatch = text.match(/^#\s+(.+)$/m);
  if (mdMatch?.[1]) return mdMatch[1].trim();

  // Use first line if it looks like a title
  const firstLine = text.split('\n')[0]?.trim() ?? '';
  if (firstLine.length > 0 && firstLine.length < 100 && !firstLine.endsWith('.')) {
    return firstLine;
  }

  return null;
}
