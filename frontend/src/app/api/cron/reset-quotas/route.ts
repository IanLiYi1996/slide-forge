/**
 * Quota Reset Endpoint
 *
 * GET /api/cron/reset-quotas - Reset quotas that have reached their reset date
 *
 * Can be triggered by:
 * 1. Internal node-cron service (no auth required from localhost)
 * 2. External cron service (requires CRON_SECRET)
 * 3. Manual trigger (requires CRON_SECRET)
 */

import { db } from '@/server/db';
import { getQuotaResetDate } from '@/lib/quota-calculator';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isLocalhost = request.headers.get('host')?.includes('localhost') ||
                        request.headers.get('host')?.includes('127.0.0.1');

    // Allow localhost without auth, or valid CRON_SECRET
    if (!isLocalhost) {
      if (!cronSecret) {
        console.error('CRON_SECRET is not configured');
        return NextResponse.json(
          { error: 'Cron job not configured' },
          { status: 500 }
        );
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('Invalid cron authorization');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date();

    // Find all quotas that need to be reset
    const quotasToReset = await db.usageQuota.findMany({
      where: {
        resetAt: {
          lte: now,
        },
      },
      select: {
        id: true,
        userId: true,
        quotaType: true,
        periodType: true,
        usedAmount: true,
      },
    });

    console.log(`Found ${quotasToReset.length} quotas to reset`);

    // Reset quotas
    const resetResults = await Promise.allSettled(
      quotasToReset.map(async (quota) => {
        const nextResetDate = getQuotaResetDate(quota.periodType, now);

        return db.usageQuota.update({
          where: { id: quota.id },
          data: {
            usedAmount: 0,
            resetAt: nextResetDate,
          },
        });
      })
    );

    // Count successes and failures
    const succeeded = resetResults.filter((r) => r.status === 'fulfilled').length;
    const failed = resetResults.filter((r) => r.status === 'rejected').length;

    console.log(`Reset completed: ${succeeded} succeeded, ${failed} failed`);

    // Log any failures
    if (failed > 0) {
      const failures = resetResults
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason);
      console.error('Reset failures:', failures);
    }

    return NextResponse.json({
      success: true,
      resetCount: succeeded,
      failedCount: failed,
      totalProcessed: quotasToReset.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Quota reset cron error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset quotas',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Allow POST as well for manual triggering
 */
export async function POST(request: Request) {
  return GET(request);
}
