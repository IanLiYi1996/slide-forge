/**
 * Usage Quota API
 *
 * GET /api/usage/quota - Get quota information
 * GET /api/usage/quota?type=SLIDE_GENERATION - Get specific quota
 * GET /api/usage/quota?type=SLIDE_GENERATION&quantity=1 - Check if quantity is available
 */

import { auth } from '@/server/auth';
import {
  getUserQuotas,
  getQuota,
  formatQuotaForDisplay,
  ALL_USAGE_TYPES,
  type UsageType,
} from '@/services/s3';
import { getUserProfile } from '@/services/s3/user-service';
import { NextResponse } from 'next/server';

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

    // Get user profile for role
    const profile = await getUserProfile(userId);
    const role = profile?.role ?? 'USER';

    // If specific type is requested
    if (type) {
      if (!ALL_USAGE_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Invalid usage type: ${type}` },
          { status: 400 }
        );
      }

      const quota = await getQuota(userId, type, role);
      const formatted = formatQuotaForDisplay(quota);

      // If checking availability of specific quantity
      if (quantity !== undefined) {
        return NextResponse.json({
          available: formatted.remaining >= quantity,
          remaining: formatted.remaining,
          total: formatted.total,
          used: formatted.usedAmount,
          type,
          label: USAGE_TYPE_LABELS[type],
        });
      }

      return NextResponse.json({
        type,
        label: formatted.label,
        baseLimit: formatted.baseLimit,
        purchasedLimit: formatted.purchasedLimit,
        total: formatted.total,
        used: formatted.usedAmount,
        remaining: formatted.remaining,
        percentage: formatted.percentage,
        periodType: formatted.periodType,
        resetAt: formatted.resetAt,
        formattedTotal: formatted.formatted.total,
        formattedUsed: formatted.formatted.used,
        formattedRemaining: formatted.formatted.remaining,
      });
    }

    // Get all quotas for user
    const userQuotas = await getUserQuotas(userId, role);

    // Format all quotas
    const formattedQuotas = ALL_USAGE_TYPES.map((quotaType) => {
      const quota = userQuotas.quotas[quotaType];
      const formatted = formatQuotaForDisplay(quota);

      return {
        type: quotaType,
        label: formatted.label,
        baseLimit: formatted.baseLimit,
        purchasedLimit: formatted.purchasedLimit,
        total: formatted.total,
        used: formatted.usedAmount,
        remaining: formatted.remaining,
        percentage: formatted.percentage,
        periodType: formatted.periodType,
        resetAt: formatted.resetAt,
        formattedTotal: formatted.formatted.total,
        formattedUsed: formatted.formatted.used,
        formattedRemaining: formatted.formatted.remaining,
      };
    });

    return NextResponse.json({
      quotas: formattedQuotas,
      role,
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
