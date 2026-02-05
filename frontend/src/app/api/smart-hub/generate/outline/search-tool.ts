import { env } from '@/env';
import { tavily } from '@tavily/core';
import { type Tool } from 'ai';
import z from 'zod';

// Only create tavily service if API key is available
const tavilyService = env.TAVILY_API_KEY
  ? tavily({ apiKey: env.TAVILY_API_KEY })
  : null;

export const webSearchTool: Tool = {
  description:
    'A search engine optimized for comprehensive, accurate, and trusted results. Use this to find current events, statistics, recent developments, or expert insights that can enhance the presentation outline.',
  parameters: z.object({
    query: z.string().describe('The search query to find relevant information'),
  }),
  execute: async ({ query }: { query: string }) => {
    if (!tavilyService) {
      console.warn('[outline] Tavily API key not configured, skipping search');
      return 'Web search is not configured';
    }

    try {
      console.log(`[outline] Searching for: ${query}`);
      const response = await tavilyService.search(query, { max_results: 5 });
      return JSON.stringify(response);
    } catch (error) {
      console.error('[outline] Search error:', error);
      return 'Search failed';
    }
  },
};

export function isWebSearchAvailable(): boolean {
  return !!env.TAVILY_API_KEY;
}
