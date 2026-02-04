/**
 * Usage Statistics API
 *
 * GET /api/usage/stats - Get usage statistics
 * Supports filtering by date range, usage type, and grouping
 */

import { auth } from '@/server/auth';
import {
  getUserUsageStats,
  type UsageType,
} from '@/services/s3';
import { NextResponse } from 'next/server';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  AI_MODEL_CALL: 'AI Model Calls',
  SLIDE_GENERATION: 'Slide Generation',
  IMAGE_GENERATION: 'Image Generation',
  IMAGE_SEARCH: 'Image Search',
  STORAGE: 'Storage Space',
  DOCUMENT_PROCESSING: 'Document Processing',
  EXPORT_PDF: 'PDF Exports',
  EXPORT_PPTX: 'PPTX Exports',
};

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
    const groupBy = (searchParams.get('groupBy') || 'day') as 'day' | 'week' | 'month';

    // Default to last 30 days if no date range provided
    const endDate = endDateParam
      ? new Date(endDateParam)
      : endOfDay(new Date());
    const startDate = startDateParam
      ? new Date(startDateParam)
      : startOfDay(subDays(endDate, 30));

    const stats = await getUserUsageStats(userId, {
      usageType: type ?? undefined,
      startDate,
      endDate,
      groupBy,
    });

    // Format recent activity with labels
    const formattedActivity = stats.recentActivity.map((log) => ({
      id: log.id,
      type: log.usageType,
      label: USAGE_TYPE_LABELS[log.usageType],
      quantity: log.quantity,
      resourceId: log.resourceId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({
      summary: stats.summary,
      byType: stats.byType,
      timeSeries: stats.timeSeries,
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
