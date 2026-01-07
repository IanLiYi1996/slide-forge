/**
 * Quota Purchase API
 *
 * GET /api/quota/purchase - Get available purchase packages
 * POST /api/quota/purchase - Create a purchase order
 */

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { QUOTA_PRICING, USAGE_TYPE_LABELS } from '@/lib/quota-calculator';
import { type UsageType } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * GET - Get available purchase packages
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Format available packages for all usage types
    const packages = Object.entries(QUOTA_PRICING).flatMap(([type, tiers]) =>
      tiers.map((tier) => ({
        id: `${type}_${tier.amount}`,
        quotaType: type as UsageType,
        label: USAGE_TYPE_LABELS[type as UsageType],
        amount: tier.amount,
        price: tier.price,
        description: `${tier.amount.toLocaleString()} ${USAGE_TYPE_LABELS[type as UsageType]}`,
      }))
    );

    // Group by usage type
    const grouped = packages.reduce(
      (acc, pkg) => {
        if (!acc[pkg.quotaType]) {
          acc[pkg.quotaType] = {
            type: pkg.quotaType,
            label: pkg.label,
            packages: [],
          };
        }
        acc[pkg.quotaType].packages.push(pkg);
        return acc;
      },
      {} as Record<string, { type: UsageType; label: string; packages: typeof packages }>
    );

    return NextResponse.json({
      packages: Object.values(grouped),
    });
  } catch (error) {
    console.error('Failed to fetch purchase packages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}

interface PurchaseRequest {
  quotaType: UsageType;
  amount: number;
  paymentMethod?: string;
}

/**
 * POST - Create a purchase order
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = (await request.json()) as PurchaseRequest;
    const { quotaType, amount, paymentMethod } = body;

    // Validate request
    if (!quotaType || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid request: quotaType and positive amount are required' },
        { status: 400 }
      );
    }

    // Find the matching pricing tier
    const pricingTiers = QUOTA_PRICING[quotaType];
    if (!pricingTiers) {
      return NextResponse.json(
        { error: `Invalid quota type: ${quotaType}` },
        { status: 400 }
      );
    }

    const tier = pricingTiers.find((t) => t.amount === amount);
    if (!tier) {
      return NextResponse.json(
        { error: `No pricing tier found for amount: ${amount}` },
        { status: 400 }
      );
    }

    // Create purchase record
    const purchase = await db.quotaPurchase.create({
      data: {
        userId,
        quotaType,
        amount,
        price: tier.price,
        paymentMethod: paymentMethod || 'pending',
        status: 'PENDING',
        // TODO: Integrate with actual payment gateway
        // For now, we'll auto-complete for demo purposes
      },
    });

    // For demo: Auto-complete the purchase and add to quota
    // In production, this would be done via webhook from payment gateway
    const completedPurchase = await db.$transaction(async (tx) => {
      // Update purchase status
      const updated = await tx.quotaPurchase.update({
        where: { id: purchase.id },
        data: {
          status: 'COMPLETED',
          transactionId: `demo_${Date.now()}`,
        },
      });

      // Add purchased quota to user's quota
      await tx.usageQuota.update({
        where: {
          userId_quotaType: {
            userId,
            quotaType,
          },
        },
        data: {
          purchasedLimit: {
            increment: amount,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      purchase: {
        id: completedPurchase.id,
        quotaType: completedPurchase.quotaType,
        amount: completedPurchase.amount,
        price: completedPurchase.price.toNumber(),
        status: completedPurchase.status,
        transactionId: completedPurchase.transactionId,
        createdAt: completedPurchase.createdAt.toISOString(),
      },
      message: 'Purchase completed successfully',
    });
  } catch (error) {
    console.error('Purchase creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create purchase',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
