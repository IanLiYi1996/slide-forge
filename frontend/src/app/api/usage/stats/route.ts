/**
 * Usage Statistics API
 *
 * GET /api/usage/stats - Get usage statistics
 * Supports filtering by date range, usage type, and grouping
 */

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { USAGE_TYPE_LABELS, formatQuotaAmount } from '@/lib/quota-calculator';
import { type UsageType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const type = searchParams.get('type') as UsageType | null;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month

    // Default to last 30 days if no date range provided
    const endDate = endDateParam
      ? new Date(endDateParam)
      : endOfDay(new Date());
    const startDate = startDateParam
      ? new Date(startDateParam)
      : startOfDay(subDays(endDate, 30));

    // Build where clause
    const where = {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(type && { usageType: type }),
    };

    // Get total usage
    const totalUsage = await db.usageLog.aggregate({
      where,
      _sum: {
        quantity: true,
      },
      _count: {
        id: true,
      },
    });

    // Get usage by type
    const usageByType = await db.usageLog.groupBy({
      by: ['usageType'],
      where,
      _sum: {
        quantity: true,
      },
      _count: {
        id: true,
      },
    });

    // Format by type data
    const formattedByType = usageByType.map((item) => ({
      type: item.usageType,
      label: USAGE_TYPE_LABELS[item.usageType],
      quantity: item._sum.quantity || 0,
      count: item._count.id,
      formatted: formatQuotaAmount(item._sum.quantity || 0, item.usageType),
    }));

    // Get time series data if specific type is requested
    let timeSeries: Array<{
      date: string;
      quantity: number;
      count: number;
    }> = [];

    if (type) {
      // Get raw logs for time series
      const logs = await db.usageLog.findMany({
        where,
        select: {
          createdAt: true,
          quantity: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Group by date
      const grouped = logs.reduce(
        (acc, log) => {
          const dateKey = format(log.createdAt, 'yyyy-MM-dd');
          if (!acc[dateKey]) {
            acc[dateKey] = { quantity: 0, count: 0 };
          }
          acc[dateKey].quantity += log.quantity;
          acc[dateKey].count += 1;
          return acc;
        },
        {} as Record<string, { quantity: number; count: number }>
      );

      timeSeries = Object.entries(grouped).map(([date, data]) => ({
        date,
        quantity: data.quantity,
        count: data.count,
      }));
    }

    // Get recent activity (last 10 logs)
    const recentActivity = await db.usageLog.findMany({
      where: {
        userId,
        ...(type && { usageType: type }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        usageType: true,
        quantity: true,
        resourceId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const formattedActivity = recentActivity.map((log) => ({
      id: log.id,
      type: log.usageType,
      label: USAGE_TYPE_LABELS[log.usageType],
      quantity: log.quantity,
      resourceId: log.resourceId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({
      summary: {
        total: totalUsage._sum.quantity || 0,
        count: totalUsage._count.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      byType: formattedByType,
      timeSeries,
      recentActivity: formattedActivity,
    });
  } catch (error) {
    console.error('Usage stats error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch usage statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
