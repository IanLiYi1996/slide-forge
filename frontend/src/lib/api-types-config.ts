/**
 * API Types Configuration
 *
 * Defines available API types based on .env variable names.
 * All API keys are stored in database (user-configured), NOT read from .env.
 *
 * This file serves as the source of truth for which APIs can be configured.
 */

/**
 * API Type Definition
 */
export interface ApiTypeDefinition {
  apiName: string; // Unique identifier (e.g., "LLM_API_KEY")
  displayName: string; // User-friendly name (e.g., "LLM Provider")
  description: string; // Description shown in UI
  category: 'llm' | 'image' | 'search' | 'storage' | 'other';
  defaultBaseUrl?: string;
  placeholder?: string; // Placeholder for API key input
  docUrl?: string; // Documentation URL
}

/**
 * Available API Types
 *
 * Add new API types here to make them configurable in the UI.
 * These correspond to .env variable names but values are NOT read from .env.
 */
export const API_TYPES: ApiTypeDefinition[] = [
  // ===== LLM Providers =====
  {
    apiName: 'LLM_API_KEY',
    displayName: 'LLM Provider',
    description: 'Primary language model API (OpenAI, Local LLM, etc.)',
    category: 'llm',
    defaultBaseUrl: 'https://api.openai.com/v1',
    placeholder: 'sk-proj-...',
    docUrl: 'https://platform.openai.com/docs',
  },
  {
    apiName: 'ANTHROPIC_API_KEY',
    displayName: 'Anthropic Claude',
    description: 'Claude API for advanced AI features',
    category: 'llm',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    placeholder: 'sk-ant-api03-...',
    docUrl: 'https://docs.anthropic.com',
  },

  // ===== Image Services =====
  {
    apiName: 'YUNWU_API_KEY',
    displayName: 'Yunwu AI',
    description: 'Image generation for slides',
    category: 'image',
    defaultBaseUrl: 'https://api.xiaomimimo.com/v1',
    placeholder: 'yunwu-key-...',
    docUrl: 'https://yunwu.ai',
  },
  {
    apiName: 'DASHSCOPE_API_KEY',
    displayName: 'DashScope',
    description: 'Alibaba Cloud AI image generation',
    category: 'image',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    placeholder: 'sk-...',
    docUrl: 'https://dashscope.aliyun.com',
  },
  {
    apiName: 'OPENAI_API_KEY',
    displayName: 'OpenAI (Images)',
    description: 'DALL-E image generation',
    category: 'image',
    defaultBaseUrl: 'https://api.openai.com/v1',
    placeholder: 'sk-proj-...',
    docUrl: 'https://platform.openai.com/docs',
  },

  // ===== Search & Media =====
  {
    apiName: 'UNSPLASH_ACCESS_KEY',
    displayName: 'Unsplash',
    description: 'Stock photo search for slide backgrounds',
    category: 'search',
    defaultBaseUrl: 'https://api.unsplash.com',
    placeholder: 'your-access-key',
    docUrl: 'https://unsplash.com/developers',
  },
  {
    apiName: 'TAVILY_API_KEY',
    displayName: 'Tavily Search',
    description: 'Web search for research',
    category: 'search',
    defaultBaseUrl: 'https://api.tavily.com',
    placeholder: 'tvly-...',
    docUrl: 'https://tavily.com',
  },

  // ===== Storage =====
  {
    apiName: 'UPLOADTHING_TOKEN',
    displayName: 'UploadThing',
    description: 'File storage and uploads',
    category: 'storage',
    placeholder: 'eyJh...',
    docUrl: 'https://uploadthing.com',
  },
];

/**
 * Get API type definition by name
 */
export function getApiTypeByName(apiName: string): ApiTypeDefinition | undefined {
  return API_TYPES.find((api) => api.apiName === apiName);
}

/**
 * Get API types by category
 */
export function getApiTypesByCategory(category: string): ApiTypeDefinition[] {
  return API_TYPES.filter((api) => api.category === category);
}

/**
 * Get all API type names
 */
export function getAllApiNames(): string[] {
  return API_TYPES.map((api) => api.apiName);
}

/**
 * Get categorized API types for UI display
 */
export function getCategorizedApiTypes() {
  const categories = {
    llm: API_TYPES.filter((api) => api.category === 'llm'),
    image: API_TYPES.filter((api) => api.category === 'image'),
    search: API_TYPES.filter((api) => api.category === 'search'),
    storage: API_TYPES.filter((api) => api.category === 'storage'),
    other: API_TYPES.filter((api) => api.category === 'other'),
  };

  return categories;
}

/**
 * Category display names
 */
export const CATEGORY_LABELS = {
  llm: 'Language Models',
  image: 'Image Generation',
  search: 'Search & Discovery',
  storage: 'File Storage',
  other: 'Other Services',
};
