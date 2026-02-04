/**
 * API Configuration Management - Single Config
 *
 * DELETE /api/settings/api-config/[id] - Delete API configuration
 */

import { auth } from '@/server/auth';
import {
  getUserApiConfigurations,
  deleteApiConfiguration,
} from '@/services/s3';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: configId } = await params;

    // Find the config by ID to get apiName
    const userConfigs = await getUserApiConfigurations(userId);
    const config = userConfigs.find((c) => c.id === configId);

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Delete the configuration
    await deleteApiConfiguration(userId, config.apiName);

    return NextResponse.json({
      success: true,
      message: 'API configuration deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete API config:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete API configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
