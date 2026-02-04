/**
 * API Configuration Resolver
 *
 * Resolves API configurations with the following priority:
 * 1. User-configured keys (from S3)
 * 2. System defaults (from .env)
 *
 * API types are defined in api-types-config.ts based on .env variable names.
 */

import { getApiConfiguration, getUserApiConfigurations } from '@/services/s3';
import { decryptApiKey } from './encryption';
import { API_TYPES, type ApiTypeDefinition } from './api-types-config';

export interface ResolvedApiConfig {
  apiKey: string;
  baseUrl?: string;
  metadata?: Record<string, unknown>;
  source: 'user' | 'system';
}

/**
 * Get API configuration for a user
 *
 * Priority: User Config > System Default (.env)
 *
 * @param userId - User ID
 * @param apiName - API name (e.g., "LLM_API_KEY", "YUNWU_API_KEY")
 * @returns Resolved configuration or null if not found
 *
 * @example
 * const config = await getApiConfig(userId, 'LLM_API_KEY');
 * if (config) {
 *   console.log(`Using ${config.source} config`); // 'user' or 'system'
 *   const response = await fetch(config.baseUrl + '/models', {
 *     headers: { 'Authorization': `Bearer ${config.apiKey}` }
 *   });
 * }
 */
export async function getApiConfig(
  userId: string,
  apiName: string
): Promise<ResolvedApiConfig | null> {
  // Validate that this is a known API type
  const apiType = API_TYPES.find((t) => t.apiName === apiName);
  if (!apiType) {
    console.warn(`Unknown API type: ${apiName}`);
    return null;
  }

  // Try to get user-specific configuration first
  const userConfig = await getApiConfiguration(userId, apiName);

  if (userConfig && userConfig.isActive) {
    // Decrypt and return user config
    try {
      const decryptedKey = decryptApiKey(userConfig.apiKey);
      return {
        apiKey: decryptedKey,
        baseUrl: userConfig.baseUrl || apiType.defaultBaseUrl,
        metadata: userConfig.metadata as Record<string, unknown> | undefined,
        source: 'user',
      };
    } catch (error) {
      console.error(`Failed to decrypt API key for ${apiName}:`, error);
      // Fall through to system config
    }
  }

  // Fall back to system configuration from .env
  const systemKey = process.env[apiName];
  if (!systemKey) {
    return null;
  }

  return {
    apiKey: systemKey,
    baseUrl: apiType.defaultBaseUrl,
    metadata: undefined,
    source: 'system',
  };
}

/**
 * Get API configuration with fallback or throw error
 *
 * @throws Error if no configuration found
 */
export async function getApiConfigOrThrow(
  userId: string,
  apiName: string
): Promise<ResolvedApiConfig> {
  const config = await getApiConfig(userId, apiName);

  if (!config) {
    const apiType = API_TYPES.find((t) => t.apiName === apiName);
    throw new Error(
      `No API configuration found for ${apiType?.displayName || apiName}. ` +
      `Please configure in Settings → API Configuration.`
    );
  }

  return config;
}

/**
 * Check if API configuration exists (user or system)
 */
export async function hasApiConfig(
  userId: string,
  apiName: string
): Promise<boolean> {
  const config = await getApiConfig(userId, apiName);
  return config !== null;
}

/**
 * Get all available API configurations for a user
 *
 * Returns which APIs have user configs vs system configs
 */
export async function getAllApiConfigs(userId: string): Promise<{
  userConfigs: Array<{
    apiName: string;
    displayName: string;
    source: 'user';
    category: string;
  }>;
  systemConfigs: Array<{
    apiName: string;
    displayName: string;
    source: 'system';
    category: string;
    hasEnvValue: boolean;
  }>;
}> {
  // Get user configs from S3
  const userConfigs = await getUserApiConfigurations(userId);
  const activeUserConfigs = userConfigs.filter((c) => c.isActive);

  // Check which API types have system configs (.env)
  const systemConfigs: Array<{
    apiName: string;
    displayName: string;
    source: 'system';
    category: string;
    hasEnvValue: boolean;
  }> = [];

  for (const apiType of API_TYPES) {
    // Skip if user has their own config for this type
    const hasUserConfig = activeUserConfigs.some((c) => c.apiName === apiType.apiName);
    if (hasUserConfig) continue;

    // Check if system config exists in .env
    const hasEnvValue = !!process.env[apiType.apiName];

    systemConfigs.push({
      apiName: apiType.apiName,
      displayName: apiType.displayName,
      source: 'system',
      category: apiType.category,
      hasEnvValue,
    });
  }

  return {
    userConfigs: activeUserConfigs.map((c) => {
      const apiType = API_TYPES.find((t) => t.apiName === c.apiName);
      return {
        apiName: c.apiName,
        displayName: c.displayName,
        source: 'user' as const,
        category: apiType?.category || 'other',
      };
    }),
    systemConfigs,
  };
}

/**
 * Helper functions for common API types
 */
export async function getLLMConfig(userId: string) {
  return getApiConfig(userId, 'LLM_API_KEY');
}

export async function getClaudeConfig(userId: string) {
  return getApiConfig(userId, 'ANTHROPIC_API_KEY');
}

export async function getUnsplashConfig(userId: string) {
  return getApiConfig(userId, 'UNSPLASH_ACCESS_KEY');
}

export async function getYunwuConfig(userId: string) {
  return getApiConfig(userId, 'YUNWU_API_KEY');
}

export async function getDashScopeConfig(userId: string) {
  return getApiConfig(userId, 'DASHSCOPE_API_KEY');
}
