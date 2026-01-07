/**
 * Usage Quota API
 *
 * GET /api/usage/quota - Get quota information
 * GET /api/usage/quota?type=SLIDE_GENERATION - Get specific quota
 * GET /api/usage/quota?type=SLIDE_GENERATION&quantity=1 - Check if quantity is available
 */

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  calculateRemainingQuota,
  calculateTotalQuota,
  calculateQuotaPercentage,
  initializeUserQuotas,
  USAGE_TYPE_LABELS,
  formatQuotaAmount,
} from '@/lib/quota-calculator';
import { type UsageType } from '@prisma/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as UsageType | null;
    const quantityParam = searchParams.get('quantity');
    const quantity = quantityParam ? parseInt(quantityParam, 10) : undefined;

    // Get user to check if quotas need initialization
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If specific type is requested
    if (type) {
      let quota = await db.usageQuota.findUnique({
        where: {
          userId_quotaType: {
            userId,
            quotaType: type,
          },
        },
      });

      // Initialize if doesn't exist
      if (!quota) {
        const quotasToCreate = initializeUserQuotas(user.role);
        const quotaData = quotasToCreate.find((q) => q.quotaType === type);

        if (!quotaData) {
          return NextResponse.json(
            { error: `Invalid usage type: ${type}` },
            { status: 400 }
          );
        }

        quota = await db.usageQuota.create({
          data: {
            userId,
            ...quotaData,
          },
        });
      }

      const total = calculateTotalQuota(quota.baseLimit, quota.purchasedLimit);
      const remaining = calculateRemainingQuota(
        quota.baseLimit,
        quota.purchasedLimit,
        quota.usedAmount
      );
      const percentage = calculateQuotaPercentage(
        quota.baseLimit,
        quota.purchasedLimit,
        quota.usedAmount
      );

      // If checking availability of specific quantity
      if (quantity !== undefined) {
        return NextResponse.json({
          available: remaining >= quantity,
          remaining,
          total,
          used: quota.usedAmount,
          type,
          label: USAGE_TYPE_LABELS[type],
        });
      }

      return NextResponse.json({
        type,
        label: USAGE_TYPE_LABELS[type],
        baseLimit: quota.baseLimit,
        purchasedLimit: quota.purchasedLimit,
        total,
        used: quota.usedAmount,
        remaining,
        percentage,
        periodType: quota.periodType,
        resetAt: quota.resetAt.toISOString(),
        formattedTotal: formatQuotaAmount(total, type),
        formattedUsed: formatQuotaAmount(quota.usedAmount, type),
        formattedRemaining: formatQuotaAmount(remaining, type),
      });
    }

    // Get all quotas for user
    let quotas = await db.usageQuota.findMany({
      where: { userId },
    });

    // Initialize quotas if none exist
    if (quotas.length === 0) {
      const quotasToCreate = initializeUserQuotas(user.role);

      await db.usageQuota.createMany({
        data: quotasToCreate.map((q) => ({
          userId,
          ...q,
        })),
      });

      quotas = await db.usageQuota.findMany({
        where: { userId },
      });
    }

    // Format all quotas
    const formattedQuotas = quotas.map((quota) => {
      const total = calculateTotalQuota(quota.baseLimit, quota.purchasedLimit);
      const remaining = calculateRemainingQuota(
        quota.baseLimit,
        quota.purchasedLimit,
        quota.usedAmount
      );
      const percentage = calculateQuotaPercentage(
        quota.baseLimit,
        quota.purchasedLimit,
        quota.usedAmount
      );

      return {
        type: quota.quotaType,
        label: USAGE_TYPE_LABELS[quota.quotaType],
        baseLimit: quota.baseLimit,
        purchasedLimit: quota.purchasedLimit,
        total,
        used: quota.usedAmount,
        remaining,
        percentage,
        periodType: quota.periodType,
        resetAt: quota.resetAt.toISOString(),
        formattedTotal: formatQuotaAmount(total, quota.quotaType),
        formattedUsed: formatQuotaAmount(quota.usedAmount, quota.quotaType),
        formattedRemaining: formatQuotaAmount(remaining, quota.quotaType),
      };
    });

    return NextResponse.json({
      quotas: formattedQuotas,
      role: user.role,
    });
  } catch (error) {
    console.error('Quota fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch quota',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
