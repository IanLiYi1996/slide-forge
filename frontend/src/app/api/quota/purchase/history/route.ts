/**
 * Purchase History API
 *
 * GET /api/quota/purchase/history - Get user's purchase history
 */

import { auth } from '@/server/auth';
import { getUserPurchases, getPurchaseStats, type UsageType } from '@/services/s3';
import { USAGE_TYPE_LABELS } from '@/lib/quota-calculator';
import { NextResponse } from 'next/server';
import type { PurchaseStatus } from '@/services/s3';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status') as PurchaseStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get purchases with pagination
    const { purchases, total } = await getUserPurchases(userId, {
      status: status || undefined,
      limit: Math.min(limit, 100), // Max 100 per page
      offset,
    });

    // Format purchases
    const formattedPurchases = purchases.map((purchase) => ({
      id: purchase.id,
      quotaType: purchase.quotaType,
      label: USAGE_TYPE_LABELS[purchase.quotaType as UsageType],
      amount: purchase.amount,
      price: purchase.price,
      paymentMethod: purchase.paymentMethod,
      status: purchase.status,
      transactionId: purchase.transactionId,
      expiresAt: purchase.expiresAt,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    }));

    // Calculate summary statistics
    const stats = await getPurchaseStats(userId);

    return NextResponse.json({
      purchases: formattedPurchases,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + purchases.length < total,
      },
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch purchase history:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch purchase history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
