/**
 * Generate Prezi Outline API
 *
 * Generates a presentation outline from a topic using AI.
 */

import { auth } from "@/server/auth";
import { streamText } from "ai";
import { modelPicker } from "@/lib/model-picker";
import { NextResponse } from "next/server";

export const maxDuration = 60; // 1 minute

interface GenerateOutlineRequest {
  topic: string;
  numberOfSlides?: number;
  style?: string;
  language?: string;
}

const OUTLINE_GENERATION_PROMPT = `You are an expert presentation designer.

Generate a structured outline for a presentation on the following topic:

Topic: {TOPIC}
Number of Slides: {NUM_SLIDES}
Style: {STYLE}
Language: {LANGUAGE}

Create a clear, logical outline with {NUM_SLIDES} main points. Each point should be:
- Concise (5-10 words)
- Focused on one key idea
- Appropriate for a single slide
- Ordered logically (introduction → body → conclusion)

Guidelines:
1. First point should be an introduction/overview
2. Middle points should cover key concepts, benefits, or steps
3. Last point should be a conclusion or call-to-action
4. Use active, engaging language
5. Avoid generic points - be specific to the topic

Return ONLY the outline as a plain text list, one point per line, without numbering or bullet points.

Example output format:
Introduction to Cloud Computing
Cost Efficiency and Savings
Scalability and Flexibility
Security and Compliance
Real-world Use Cases
Future Trends and Conclusion

Now generate the outline:`;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      topic,
      numberOfSlides = 10,
      style = "professional",
      language = "en-US",
    } = (await req.json()) as GenerateOutlineRequest;

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const model = modelPicker("openai");

    const formattedPrompt = OUTLINE_GENERATION_PROMPT
      .replace(/{TOPIC}/g, topic)
      .replace(/{NUM_SLIDES}/g, numberOfSlides.toString())
      .replace(/{STYLE}/g, style)
      .replace(/{LANGUAGE}/g, language);

    const result = streamText({
      model,
      prompt: formattedPrompt,
      maxTokens: 500,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error generating outline:", error);
    return NextResponse.json(
      { error: "Failed to generate outline" },
      { status: 500 }
    );
  }
}
