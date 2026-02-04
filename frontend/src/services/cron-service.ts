/**
 * Cron Service - Scheduled Tasks
 *
 * Manages scheduled background tasks using node-cron.
 * This service runs in-process and does not require external cron setup.
 */

import cron from 'node-cron';
import { listAllObjects, getObject, putObjectSimple } from '@/services/s3';
import type { UserQuotas, UsageType, PeriodType } from '@/services/s3';

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
    // List all user quota files
    const quotaKeys = await listAllObjects({
      prefix: 'usage/',
    });

    // Filter to only quota files
    const quotaFiles = quotaKeys.filter((key) => key.endsWith('/quotas.json'));

    console.log(`📊 Checking ${quotaFiles.length} user quotas`);

    if (quotaFiles.length === 0) {
      console.log('✅ No quotas to check');
      return {
        success: true,
        resetCount: 0,
        message: 'No quotas to reset',
      };
    }

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
        console.error('❌ Reset failure:', result.reason);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Quota reset completed in ${duration}ms:`);
    console.log(`  - Users processed: ${quotaFiles.length}`);
    console.log(`  - Quotas reset: ${totalReset}`);
    console.log(`  - Failed: ${failed}`);

    return {
      success: true,
      resetCount: totalReset,
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
