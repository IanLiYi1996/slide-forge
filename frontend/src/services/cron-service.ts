/**
 * Cron Service - Scheduled Tasks
 *
 * Manages scheduled background tasks using node-cron.
 * This service runs in-process and does not require external cron setup.
 */

import cron from 'node-cron';
import { db } from '@/server/db';
import { getQuotaResetDate } from '@/lib/quota-calculator';

/**
 * Initialize all cron jobs
 *
 * Call this in the application startup (e.g., in a startup script or API route)
 */
export function initializeCronJobs() {
  console.log('🕒 Initializing cron jobs...');

  // Schedule quota reset - Daily at midnight (00:00)
  const quotaResetJob = cron.schedule(
    '0 0 * * *',
    async () => {
      console.log('🔄 Running quota reset job...');
      await resetQuotas();
    },
    {
      timezone: 'UTC',
    }
  );

  console.log('✅ Cron jobs initialized:');
  console.log('  - Quota reset: Daily at 00:00 UTC');

  return {
    quotaResetJob,
  };
}

/**
 * Reset quotas that have reached their reset date
 */
async function resetQuotas() {
  const startTime = Date.now();
  const now = new Date();

  try {
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

    console.log(`📊 Found ${quotasToReset.length} quotas to reset`);

    if (quotasToReset.length === 0) {
      console.log('✅ No quotas need resetting');
      return {
        success: true,
        resetCount: 0,
        message: 'No quotas to reset',
      };
    }

    // Reset quotas in batches
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

    // Count results
    const succeeded = resetResults.filter((r) => r.status === 'fulfilled').length;
    const failed = resetResults.filter((r) => r.status === 'rejected').length;

    // Log failures
    if (failed > 0) {
      const failures = resetResults
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason);
      console.error('❌ Reset failures:', failures);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Quota reset completed in ${duration}ms:`);
    console.log(`  - Succeeded: ${succeeded}`);
    console.log(`  - Failed: ${failed}`);

    return {
      success: true,
      resetCount: succeeded,
      failedCount: failed,
      duration,
    };
  } catch (error) {
    console.error('❌ Fatal error during quota reset:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Manually trigger quota reset (for testing)
 */
export async function manualResetQuotas() {
  console.log('🔧 Manual quota reset triggered');
  return resetQuotas();
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopAllCronJobs() {
  console.log('🛑 Stopping all cron jobs...');
  cron.getTasks().forEach((task) => {
    task.stop();
  });
  console.log('✅ All cron jobs stopped');
}
