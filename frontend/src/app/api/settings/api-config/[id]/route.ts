/**
 * API Configuration Management - Single Config
 *
 * DELETE /api/settings/api-config/[id] - Delete API configuration
 */

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const configId = params.id;

    // Verify ownership before deleting
    const config = await db.apiConfiguration.findUnique({
      where: { id: configId },
      select: { userId: true },
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    if (config.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this configuration' },
        { status: 403 }
      );
    }

    // Delete the configuration
    await db.apiConfiguration.delete({
      where: { id: configId },
    });

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
