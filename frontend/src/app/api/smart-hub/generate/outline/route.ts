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

// Outline generation prompt template
const OUTLINE_GENERATION_PROMPT = `You are an expert presentation designer.

Generate a structured outline for a presentation based on the following content:

Topic/Content: {CONTENT}
Number of Slides: {NUM_SLIDES}
Style: {STYLE}
Tone: {TONE}
Language: {LANGUAGE}

Create a clear, logical outline with {NUM_SLIDES} main points. Each point should be:
- Concise (5-15 words)
- Focused on one key idea
- Appropriate for a single slide
- Ordered logically (introduction → body → conclusion)

Guidelines:
1. First point should be an introduction/title slide
2. Middle points should cover key concepts, benefits, steps, or sections from the content
3. Last point should be a conclusion or summary
4. Use active, engaging language
5. Be specific to the topic - avoid generic points

Return the outline as a JSON object with "title" and "outline" fields:
{
  "title": "Presentation Title",
  "outline": [
    "Introduction: Topic Overview",
    "Key Point 1",
    "Key Point 2",
    ...
    "Summary and Conclusion"
  ]
}

Generate the outline now:`;

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

  const systemPrompt = `You are an expert presentation outline generator. Your task is to create a comprehensive and engaging presentation outline based on the user's topic.

Current Date: ${currentDate}

## Your Process:
1. **Analyze the topic** - Understand what the user wants to present
2. **Research if needed** - Use web search to find current, relevant information that can enhance the outline
3. **Generate outline** - Create a structured outline with the requested number of topics

## Web Search Guidelines:
- Use web search to find current statistics, recent developments, or expert insights
- Search for information that will make the presentation more credible and engaging
- Limit searches to 2-5 queries maximum (you decide how many are needed)
- Focus on finding information that directly relates to the presentation topic

## Outline Requirements:
- Generate exactly ${config.numberOfSlides} main topics
- Each topic should be a clear, engaging heading
- Use ${actualLanguage} language
- Make topics flow logically from one to another
- Ensure topics are comprehensive and cover key aspects
- Apply a ${config.tone || 'professional'} tone

## Output Format:
Return a JSON object with "title" and "outline" fields:
{
  "title": "Presentation Title",
  "outline": [
    "Introduction: Topic Overview",
    "Key Point 1",
    "Key Point 2",
    ...
    "Summary and Conclusion"
  ]
}

Remember: Use web search strategically to enhance the outline with current, relevant information.`;

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
