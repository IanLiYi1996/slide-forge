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

import { listAllObjects, getObject, putObjectSimple, type UserQuotas, type PeriodType } from '@/services/s3';
import { NextResponse } from 'next/server';

/**
 * Get the next reset date based on period type
 */
function getQuotaResetDate(periodType: PeriodType, currentDate: Date = new Date()): Date {
  const resetDate = new Date(currentDate);

  switch (periodType) {
    case 'DAILY':
      resetDate.setDate(resetDate.getDate() + 1);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'WEEKLY':
      const dayOfWeek = resetDate.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      resetDate.setDate(resetDate.getDate() + daysUntilMonday);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'MONTHLY':
      resetDate.setMonth(resetDate.getMonth() + 1, 1);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'YEARLY':
      resetDate.setFullYear(resetDate.getFullYear() + 1, 0, 1);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'LIFETIME':
      return new Date('2099-12-31');
  }

  return resetDate;
}

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

    // List all user quota files
    const quotaKeys = await listAllObjects({
      prefix: 'usage/',
    });

    // Filter to only quota files
    const quotaFiles = quotaKeys.filter((key) => key.endsWith('/quotas.json'));

    console.log(`Found ${quotaFiles.length} user quotas to check`);

    // Process each user's quotas
    let totalReset = 0;
    let failed = 0;

    const resetResults = await Promise.allSettled(
      quotaFiles.map(async (quotaKey) => {
        const userQuotas = await getObject<UserQuotas>(quotaKey);
        if (!userQuotas) return 0;

        let resetCount = 0;
        let hasChanges = false;

        // Check each quota type for reset
        for (const [type, quota] of Object.entries(userQuotas.quotas)) {
          if (quota && new Date(quota.resetAt) <= now && quota.periodType !== 'LIFETIME') {
            quota.usedAmount = 0;
            quota.resetAt = getQuotaResetDate(quota.periodType, now).toISOString();
            resetCount++;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          userQuotas.updatedAt = now.toISOString();
          await putObjectSimple(quotaKey, userQuotas);
        }

        return resetCount;
      })
    );

    // Count results
    for (const result of resetResults) {
      if (result.status === 'fulfilled') {
        totalReset += result.value;
      } else {
        failed++;
        console.error('Reset failure:', result.reason);
      }
    }

    console.log(`Reset completed: ${totalReset} quotas reset, ${failed} failed`);

    return NextResponse.json({
      success: true,
      resetCount: totalReset,
      failedCount: failed,
      totalProcessed: quotaFiles.length,
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
