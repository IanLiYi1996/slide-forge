/**
 * Usage Log API
 *
 * POST /api/usage/log - Record usage and check quota
 */

import { auth } from '@/server/auth';
import {
  checkAndUpdateQuota,
  logUsage,
  type UsageType,
} from '@/services/s3';
import { getUserProfile } from '@/services/s3/user-service';
import { NextResponse } from 'next/server';

interface UsageLogRequest {
  usageType: UsageType;
  quantity: number;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse request body
    const body = (await request.json()) as UsageLogRequest;
    const { usageType, quantity, resourceId, metadata } = body;

    // Validate required fields
    if (!usageType || typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { error: 'Invalid request: usageType and positive quantity are required' },
        { status: 400 }
      );
    }

    // Get user profile to determine role
    const profile = await getUserProfile(userId);
    const role = profile?.role ?? 'USER';

    // Check and update quota atomically
    const quotaResult = await checkAndUpdateQuota(userId, usageType, quantity, role);

    if (quotaResult.quotaExceeded) {
      return NextResponse.json({
        success: false,
        quotaExceeded: true,
        remaining: quotaResult.remaining,
        message: `Quota exceeded. You have ${quotaResult.remaining} remaining.`,
      });
    }

    // Log the usage (append to usage logs)
    await logUsage({
      userId,
      usageType,
      quantity,
      resourceId,
      metadata,
    });

    return NextResponse.json({
      success: true,
      quotaExceeded: false,
      remaining: quotaResult.remaining,
      message: 'Usage tracked successfully',
    });
  } catch (error) {
    console.error('Usage tracking error:', error);
    return NextResponse.json(
      {
        error: 'Failed to track usage',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
