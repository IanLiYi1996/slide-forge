/**
 * Purchase History API
 *
 * GET /api/quota/purchase/history - Get user's purchase history
 */

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { USAGE_TYPE_LABELS } from '@/lib/quota-calculator';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    const where = {
      userId,
      ...(status && { status: status as 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' }),
    };

    // Get purchases with pagination
    const [purchases, total] = await Promise.all([
      db.quotaPurchase.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: Math.min(limit, 100), // Max 100 per page
      }),
      db.quotaPurchase.count({ where }),
    ]);

    // Format purchases
    const formattedPurchases = purchases.map((purchase) => ({
      id: purchase.id,
      quotaType: purchase.quotaType,
      label: USAGE_TYPE_LABELS[purchase.quotaType],
      amount: purchase.amount,
      price: purchase.price.toNumber(),
      paymentMethod: purchase.paymentMethod,
      status: purchase.status,
      transactionId: purchase.transactionId,
      expiresAt: purchase.expiresAt?.toISOString(),
      createdAt: purchase.createdAt.toISOString(),
      updatedAt: purchase.updatedAt.toISOString(),
    }));

    // Calculate summary statistics
    const stats = {
      total: total,
      completed: await db.quotaPurchase.count({
        where: { userId, status: 'COMPLETED' },
      }),
      pending: await db.quotaPurchase.count({
        where: { userId, status: 'PENDING' },
      }),
      totalSpent: purchases
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p.price.toNumber(), 0),
    };

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
