/**
 * API Configuration Management
 *
 * GET /api/settings/api-config - Get all API configurations
 * POST /api/settings/api-config - Create or update API configuration
 */

import { auth } from '@/server/auth';
import {
  getUserApiConfigurations,
  createApiConfiguration,
  updateApiConfiguration,
  getApiConfiguration,
} from '@/services/s3';
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/lib/encryption';
import { getAllApiConfigs } from '@/lib/api-config-resolver';
import { API_TYPES } from '@/lib/api-types-config';
import { NextResponse } from 'next/server';

/**
 * GET - Get all API configurations for the authenticated user
 * Includes both user configs and available system configs from .env
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user configs from S3
    const userConfigs = await getUserApiConfigurations(userId);

    // Return configs with masked API keys
    const maskedUserConfigs = userConfigs.map((config) => {
      const decrypted = decryptApiKey(config.apiKey);
      const apiTypeDef = API_TYPES.find((t) => t.apiName === config.apiName);

      return {
        id: config.id,
        apiName: config.apiName,
        displayName: config.displayName,
        maskedKey: maskApiKey(decrypted),
        baseUrl: config.baseUrl,
        metadata: config.metadata,
        isActive: config.isActive,
        source: 'user',
        category: apiTypeDef?.category || 'other',
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    });

    // Get system configs info
    const { systemConfigs } = await getAllApiConfigs(userId);

    // Format system configs with additional info
    const formattedSystemConfigs = systemConfigs.map((config) => {
      const apiTypeDef = API_TYPES.find((t) => t.apiName === config.apiName);
      return {
        apiName: config.apiName,
        displayName: config.displayName,
        description: apiTypeDef?.description || '',
        category: config.category,
        source: 'system',
        hasEnvValue: config.hasEnvValue,
        canOverride: true,
      };
    });

    return NextResponse.json({
      configs: maskedUserConfigs,
      systemConfigs: formattedSystemConfigs,
      availableTypes: API_TYPES, // Send all available API types for selection
    });
  } catch (error) {
    console.error('Failed to fetch API configs:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch API configurations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

interface CreateConfigRequest {
  apiName: string;
  displayName?: string;
  apiKey: string;
  baseUrl?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

/**
 * POST - Create or update API configuration
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = (await request.json()) as CreateConfigRequest;
    const { apiName, displayName, apiKey, baseUrl, metadata, isActive = true } = body;

    // Validate required fields
    if (!apiName || !apiKey) {
      return NextResponse.json(
        { error: 'apiName and apiKey are required' },
        { status: 400 }
      );
    }

    // Validate that this is a known API type
    const apiTypeDef = API_TYPES.find((t) => t.apiName === apiName);
    if (!apiTypeDef) {
      return NextResponse.json(
        { error: `Unknown API type: ${apiName}. Please add it to api-types-config.ts` },
        { status: 400 }
      );
    }

    // Validate API key format (basic check)
    if (apiKey.length < 8) {
      return NextResponse.json(
        { error: 'API key must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const encryptedKey = encryptApiKey(apiKey);

    // Use displayName from apiTypeDef if not provided
    const finalDisplayName = displayName || apiTypeDef.displayName;

    // Check if config exists
    const existingConfig = await getApiConfiguration(userId, apiName);

    let config;
    if (existingConfig) {
      // Update existing
      config = await updateApiConfiguration(userId, apiName, {
        displayName: finalDisplayName,
        apiKey: encryptedKey,
        baseUrl: baseUrl || undefined,
        metadata: metadata || undefined,
        isActive,
      });
    } else {
      // Create new
      config = await createApiConfiguration({
        userId,
        apiName,
        displayName: finalDisplayName,
        apiKey: encryptedKey,
        baseUrl,
        metadata,
      });
    }

    if (!config) {
      return NextResponse.json(
        { error: 'Failed to save API configuration' },
        { status: 500 }
      );
    }

    // Return with masked key
    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        apiName: config.apiName,
        displayName: config.displayName,
        maskedKey: maskApiKey(apiKey),
        baseUrl: config.baseUrl,
        metadata: config.metadata,
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
      message: 'API configuration saved successfully',
    });
  } catch (error) {
    console.error('Failed to save API config:', error);
    return NextResponse.json(
      {
        error: 'Failed to save API configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
