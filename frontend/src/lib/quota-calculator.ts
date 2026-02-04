/**
 * Quota Calculation Utilities
 *
 * Defines default quotas and provides utilities for quota management.
 */

import type { UsageType, PeriodType, UserRole } from '@/services/s3';

// Re-export types for convenience
export type { UsageType, PeriodType };

/**
 * Default quota limits by user role
 *
 * USER role gets basic limits suitable for individual use
 * ADMIN role gets 10x the limits for administrative purposes
 */
export const DEFAULT_QUOTAS: Record<UserRole, Record<UsageType, number>> = {
  USER: {
    AI_MODEL_CALL: 1000, // API calls per month
    SLIDE_GENERATION: 50, // Slides per month
    IMAGE_GENERATION: 100, // Images per month
    IMAGE_SEARCH: 500, // Unsplash searches per month
    STORAGE: 1073741824, // 1GB in bytes
    DOCUMENT_PROCESSING: 20, // Documents per month
    EXPORT_PDF: 50, // PDF exports per month
    EXPORT_PPTX: 20, // PPTX exports per month
  },
  ADMIN: {
    AI_MODEL_CALL: 10000,
    SLIDE_GENERATION: 500,
    IMAGE_GENERATION: 1000,
    IMAGE_SEARCH: 5000,
    STORAGE: 10737418240, // 10GB in bytes
    DOCUMENT_PROCESSING: 200,
    EXPORT_PDF: 500,
    EXPORT_PPTX: 200,
  },
};

/**
 * Pricing for additional quota purchases (in USD)
 *
 * These are suggested prices - can be adjusted based on business model
 */
export const QUOTA_PRICING: Record<UsageType, { amount: number; price: number }[]> = {
  AI_MODEL_CALL: [
    { amount: 1000, price: 9.99 },
    { amount: 5000, price: 39.99 },
    { amount: 10000, price: 69.99 },
  ],
  SLIDE_GENERATION: [
    { amount: 50, price: 4.99 },
    { amount: 200, price: 14.99 },
    { amount: 500, price: 29.99 },
  ],
  IMAGE_GENERATION: [
    { amount: 100, price: 4.99 },
    { amount: 500, price: 19.99 },
    { amount: 1000, price: 34.99 },
  ],
  IMAGE_SEARCH: [
    { amount: 500, price: 2.99 },
    { amount: 2000, price: 9.99 },
    { amount: 5000, price: 19.99 },
  ],
  STORAGE: [
    { amount: 5368709120, price: 4.99 }, // 5GB
    { amount: 21474836480, price: 14.99 }, // 20GB
    { amount: 53687091200, price: 29.99 }, // 50GB
  ],
  DOCUMENT_PROCESSING: [
    { amount: 20, price: 4.99 },
    { amount: 100, price: 19.99 },
    { amount: 200, price: 34.99 },
  ],
  EXPORT_PDF: [
    { amount: 50, price: 2.99 },
    { amount: 200, price: 9.99 },
    { amount: 500, price: 19.99 },
  ],
  EXPORT_PPTX: [
    { amount: 20, price: 2.99 },
    { amount: 100, price: 9.99 },
    { amount: 250, price: 19.99 },
  ],
};

/**
 * User-friendly display names for usage types
 */
export const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  AI_MODEL_CALL: 'AI Model Calls',
  SLIDE_GENERATION: 'Slide Generation',
  IMAGE_GENERATION: 'Image Generation',
  IMAGE_SEARCH: 'Image Search',
  STORAGE: 'Storage Space',
  DOCUMENT_PROCESSING: 'Document Processing',
  EXPORT_PDF: 'PDF Exports',
  EXPORT_PPTX: 'PPTX Exports',
};

/**
 * Units for displaying usage quantities
 */
export const USAGE_TYPE_UNITS: Record<UsageType, string> = {
  AI_MODEL_CALL: 'calls',
  SLIDE_GENERATION: 'slides',
  IMAGE_GENERATION: 'images',
  IMAGE_SEARCH: 'searches',
  STORAGE: 'bytes',
  DOCUMENT_PROCESSING: 'documents',
  EXPORT_PDF: 'exports',
  EXPORT_PPTX: 'exports',
};

/**
 * Calculate the next reset date based on period type
 *
 * @param periodType - The period type (DAILY, WEEKLY, MONTHLY, etc.)
 * @param currentDate - Current date (defaults to now)
 * @returns The next reset date
 *
 * @example
 * const nextReset = getQuotaResetDate('MONTHLY');
 * console.log(`Quota resets on: ${nextReset.toLocaleDateString()}`);
 */
export function getQuotaResetDate(
  periodType: PeriodType,
  currentDate: Date = new Date()
): Date {
  const resetDate = new Date(currentDate);

  switch (periodType) {
    case 'DAILY':
      resetDate.setDate(resetDate.getDate() + 1);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'WEEKLY':
      // Reset on next Monday
      const dayOfWeek = resetDate.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      resetDate.setDate(resetDate.getDate() + daysUntilMonday);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'MONTHLY':
      // Reset on the first day of next month
      resetDate.setMonth(resetDate.getMonth() + 1, 1);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'YEARLY':
      // Reset on January 1st of next year
      resetDate.setFullYear(resetDate.getFullYear() + 1, 0, 1);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'LIFETIME':
      // Far future date (effectively no reset)
      return new Date('2099-12-31');

    default:
      throw new Error(`Unknown period type: ${periodType}`);
  }

  return resetDate;
}

/**
 * Format a quota amount for display
 *
 * @param amount - The quota amount
 * @param usageType - The usage type
 * @returns Formatted string
 *
 * @example
 * formatQuotaAmount(1073741824, 'STORAGE') // "1 GB"
 * formatQuotaAmount(1000, 'AI_MODEL_CALL') // "1,000 calls"
 */
export function formatQuotaAmount(amount: number, usageType: UsageType): string {
  if (usageType === 'STORAGE') {
    return formatBytes(amount);
  }

  const unit = USAGE_TYPE_UNITS[usageType];
  return `${amount.toLocaleString()} ${unit}`;
}

/**
 * Format bytes to human-readable format
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 *
 * @example
 * formatBytes(1073741824) // "1 GB"
 * formatBytes(1536) // "1.5 KB"
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Calculate the total available quota (base + purchased)
 *
 * @param baseLimit - Base limit from role
 * @param purchasedLimit - Additional purchased limit
 * @returns Total available quota
 */
export function calculateTotalQuota(baseLimit: number, purchasedLimit: number): number {
  return baseLimit + purchasedLimit;
}

/**
 * Calculate the remaining quota
 *
 * @param baseLimit - Base limit from role
 * @param purchasedLimit - Additional purchased limit
 * @param usedAmount - Amount already used
 * @returns Remaining quota (never negative)
 */
export function calculateRemainingQuota(
  baseLimit: number,
  purchasedLimit: number,
  usedAmount: number
): number {
  const total = calculateTotalQuota(baseLimit, purchasedLimit);
  return Math.max(0, total - usedAmount);
}

/**
 * Calculate the quota usage percentage
 *
 * @param baseLimit - Base limit from role
 * @param purchasedLimit - Additional purchased limit
 * @param usedAmount - Amount already used
 * @returns Percentage (0-100)
 */
export function calculateQuotaPercentage(
  baseLimit: number,
  purchasedLimit: number,
  usedAmount: number
): number {
  const total = calculateTotalQuota(baseLimit, purchasedLimit);
  if (total === 0) return 0;

  const percentage = (usedAmount / total) * 100;
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Check if quota is exceeded
 *
 * @param baseLimit - Base limit from role
 * @param purchasedLimit - Additional purchased limit
 * @param usedAmount - Amount already used
 * @param softLimitPercentage - Soft limit percentage (default: 100, meaning strict)
 * @returns true if quota is exceeded
 */
export function isQuotaExceeded(
  baseLimit: number,
  purchasedLimit: number,
  usedAmount: number,
  softLimitPercentage = 100
): boolean {
  const total = calculateTotalQuota(baseLimit, purchasedLimit);
  const effectiveLimit = (total * softLimitPercentage) / 100;
  return usedAmount >= effectiveLimit;
}

/**
 * Get the default quota for a specific user role and usage type
 *
 * @param role - User role
 * @param usageType - Usage type
 * @returns Default quota amount
 */
export function getDefaultQuota(role: UserRole, usageType: UsageType): number {
  return DEFAULT_QUOTAS[role][usageType];
}

/**
 * Initialize quotas for a new user
 *
 * @param role - User role
 * @returns Array of quota initialization data
 */
export function initializeUserQuotas(role: UserRole): Array<{
  quotaType: UsageType;
  baseLimit: number;
  usedAmount: number;
  purchasedLimit: number;
  periodType: PeriodType;
  resetAt: Date;
}> {
  const quotas = DEFAULT_QUOTAS[role];
  const now = new Date();

  return Object.entries(quotas).map(([type, limit]) => ({
    quotaType: type as UsageType,
    baseLimit: limit,
    usedAmount: 0,
    purchasedLimit: 0,
    periodType: 'MONTHLY' as PeriodType,
    resetAt: getQuotaResetDate('MONTHLY', now),
  }));
}
