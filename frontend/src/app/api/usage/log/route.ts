/**
 * Usage Log API
 *
 * POST /api/usage/log - Record usage and check quota
 */

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { calculateRemainingQuota, isQuotaExceeded } from '@/lib/quota-calculator';
import { type UsageType } from '@prisma/client';
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

    // Use transaction to ensure consistency
    const result = await db.$transaction(async (tx) => {
      // Get or create quota for this usage type
      let quota = await tx.usageQuota.findUnique({
        where: {
          userId_quotaType: {
            userId,
            quotaType: usageType,
          },
        },
      });

      // If quota doesn't exist, initialize it
      if (!quota) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        // Import and use quota initialization
        const { initializeUserQuotas } = await import('@/lib/quota-calculator');
        const quotasToCreate = initializeUserQuotas(user.role);
        const quotaData = quotasToCreate.find((q) => q.quotaType === usageType);

        if (!quotaData) {
          throw new Error(`Invalid usage type: ${usageType}`);
        }

        quota = await tx.usageQuota.create({
          data: {
            userId,
            ...quotaData,
          },
        });
      }

      // Check if quota would be exceeded
      const wouldExceed = isQuotaExceeded(
        quota.baseLimit,
        quota.purchasedLimit,
        quota.usedAmount + quantity
      );

      if (wouldExceed) {
        const remaining = calculateRemainingQuota(
          quota.baseLimit,
          quota.purchasedLimit,
          quota.usedAmount
        );

        return {
          success: false,
          quotaExceeded: true,
          remaining,
          message: `Quota exceeded. You have ${remaining} remaining.`,
        };
      }

      // Log the usage
      await tx.usageLog.create({
        data: {
          userId,
          usageType,
          quantity,
          resourceId,
          metadata: metadata ? (metadata as object) : undefined,
        },
      });

      // Update quota usage
      const updatedQuota = await tx.usageQuota.update({
        where: {
          userId_quotaType: {
            userId,
            quotaType: usageType,
          },
        },
        data: {
          usedAmount: {
            increment: quantity,
          },
        },
      });

      const remaining = calculateRemainingQuota(
        updatedQuota.baseLimit,
        updatedQuota.purchasedLimit,
        updatedQuota.usedAmount
      );

      return {
        success: true,
        quotaExceeded: false,
        remaining,
        message: 'Usage tracked successfully',
      };
    });

    return NextResponse.json(result);
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
