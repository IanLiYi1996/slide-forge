import { getObject, putObjectSimple, withOptimisticLock } from './s3-client';
import type { UserRole } from './user-service';

export type UsageType =
  | 'AI_MODEL_CALL'
  | 'SLIDE_GENERATION'
  | 'IMAGE_GENERATION'
  | 'IMAGE_SEARCH'
  | 'STORAGE'
  | 'DOCUMENT_PROCESSING'
  | 'EXPORT_PDF'
  | 'EXPORT_PPTX';

export type PeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'LIFETIME';

export interface QuotaEntry {
  quotaType: UsageType;
  baseLimit: number;
  usedAmount: number;
  purchasedLimit: number;
  periodType: PeriodType;
  resetAt: string;
}

export interface UserQuotas {
  userId: string;
  quotas: Record<UsageType, QuotaEntry>;
  updatedAt: string;
  _version?: number;
}

export interface CheckQuotaResult {
  success: boolean;
  quotaExceeded: boolean;
  remaining: number;
  message: string;
  quota?: QuotaEntry;
}

const DEFAULT_QUOTAS: Record<UserRole, Record<UsageType, number>> = {
  USER: {
    AI_MODEL_CALL: 1000,
    SLIDE_GENERATION: 50,
    IMAGE_GENERATION: 100,
    IMAGE_SEARCH: 500,
    STORAGE: 1073741824, // 1GB
    DOCUMENT_PROCESSING: 20,
    EXPORT_PDF: 50,
    EXPORT_PPTX: 20,
  },
  ADMIN: {
    AI_MODEL_CALL: 10000,
    SLIDE_GENERATION: 500,
    IMAGE_GENERATION: 1000,
    IMAGE_SEARCH: 5000,
    STORAGE: 10737418240, // 10GB
    DOCUMENT_PROCESSING: 200,
    EXPORT_PDF: 500,
    EXPORT_PPTX: 200,
  },
};

const ALL_USAGE_TYPES: UsageType[] = [
  'AI_MODEL_CALL',
  'SLIDE_GENERATION',
  'IMAGE_GENERATION',
  'IMAGE_SEARCH',
  'STORAGE',
  'DOCUMENT_PROCESSING',
  'EXPORT_PDF',
  'EXPORT_PPTX',
];

function getQuotaKey(userId: string): string {
  return `usage/${userId}/quotas.json`;
}

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

function initializeQuotasForRole(userId: string, role: UserRole): UserQuotas {
  const defaults = DEFAULT_QUOTAS[role];
  const now = new Date();
  const resetAt = getQuotaResetDate('MONTHLY', now);

  const quotas: Record<UsageType, QuotaEntry> = {} as Record<UsageType, QuotaEntry>;

  for (const type of ALL_USAGE_TYPES) {
    quotas[type] = {
      quotaType: type,
      baseLimit: defaults[type],
      usedAmount: 0,
      purchasedLimit: 0,
      periodType: 'MONTHLY',
      resetAt: resetAt.toISOString(),
    };
  }

  return {
    userId,
    quotas,
    updatedAt: now.toISOString(),
  };
}

function checkAndResetExpiredQuotas(userQuotas: UserQuotas): boolean {
  const now = new Date();
  let hasResets = false;

  for (const type of ALL_USAGE_TYPES) {
    const quota = userQuotas.quotas[type];
    if (quota && new Date(quota.resetAt) <= now && quota.periodType !== 'LIFETIME') {
      quota.usedAmount = 0;
      quota.resetAt = getQuotaResetDate(quota.periodType, now).toISOString();
      hasResets = true;
    }
  }

  if (hasResets) {
    userQuotas.updatedAt = now.toISOString();
  }

  return hasResets;
}

export async function getUserQuotas(
  userId: string,
  role: UserRole = 'USER'
): Promise<UserQuotas> {
  let userQuotas = await getObject<UserQuotas>(getQuotaKey(userId));

  if (!userQuotas) {
    userQuotas = initializeQuotasForRole(userId, role);
    await putObjectSimple(getQuotaKey(userId), userQuotas);
    return userQuotas;
  }

  const hasResets = checkAndResetExpiredQuotas(userQuotas);
  if (hasResets) {
    await putObjectSimple(getQuotaKey(userId), userQuotas);
  }

  return userQuotas;
}

export async function getQuota(
  userId: string,
  quotaType: UsageType,
  role: UserRole = 'USER'
): Promise<QuotaEntry> {
  const userQuotas = await getUserQuotas(userId, role);
  return userQuotas.quotas[quotaType];
}

export async function checkQuota(
  userId: string,
  quotaType: UsageType,
  quantity: number = 1,
  role: UserRole = 'USER'
): Promise<CheckQuotaResult> {
  const userQuotas = await getUserQuotas(userId, role);
  const quota = userQuotas.quotas[quotaType];

  const total = quota.baseLimit + quota.purchasedLimit;
  const remaining = total - quota.usedAmount;
  const wouldExceed = quota.usedAmount + quantity > total;

  return {
    success: !wouldExceed,
    quotaExceeded: wouldExceed,
    remaining: Math.max(0, remaining),
    message: wouldExceed
      ? `Quota exceeded for ${quotaType}. Used: ${quota.usedAmount}, Limit: ${total}`
      : `Quota check passed. Remaining: ${remaining}`,
    quota,
  };
}

export async function checkAndUpdateQuota(
  userId: string,
  quotaType: UsageType,
  quantity: number = 1,
  role: UserRole = 'USER',
  maxRetries: number = 3
): Promise<CheckQuotaResult> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await withOptimisticLock<UserQuotas, CheckQuotaResult>(
        getQuotaKey(userId),
        async (existing, version) => {
          let userQuotas = existing;

          if (!userQuotas) {
            userQuotas = initializeQuotasForRole(userId, role);
          } else {
            checkAndResetExpiredQuotas(userQuotas);
          }

          const quota = userQuotas.quotas[quotaType];
          const total = quota.baseLimit + quota.purchasedLimit;
          const remaining = total - quota.usedAmount;
          const wouldExceed = quota.usedAmount + quantity > total;

          if (wouldExceed) {
            return {
              newData: userQuotas,
              result: {
                success: false,
                quotaExceeded: true,
                remaining: Math.max(0, remaining),
                message: `Quota exceeded for ${quotaType}. Used: ${quota.usedAmount}, Limit: ${total}`,
                quota,
              },
            };
          }

          quota.usedAmount += quantity;
          userQuotas.updatedAt = new Date().toISOString();

          return {
            newData: userQuotas,
            result: {
              success: true,
              quotaExceeded: false,
              remaining: Math.max(0, total - quota.usedAmount),
              message: `Successfully updated quota. Remaining: ${total - quota.usedAmount}`,
              quota,
            },
          };
        },
        1 // Only 1 retry inside withOptimisticLock
      );

      return result;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, attempt)));
    }
  }

  throw new Error('Failed to update quota after maximum retries');
}

export async function incrementQuota(
  userId: string,
  quotaType: UsageType,
  quantity: number = 1,
  role: UserRole = 'USER'
): Promise<QuotaEntry> {
  const result = await checkAndUpdateQuota(userId, quotaType, quantity, role);
  if (!result.quota) {
    throw new Error('Failed to get quota after update');
  }
  return result.quota;
}

export async function addPurchasedQuota(
  userId: string,
  quotaType: UsageType,
  amount: number,
  role: UserRole = 'USER'
): Promise<QuotaEntry> {
  return withOptimisticLock<UserQuotas, QuotaEntry>(
    getQuotaKey(userId),
    async (existing) => {
      let userQuotas = existing;

      if (!userQuotas) {
        userQuotas = initializeQuotasForRole(userId, role);
      }

      const quota = userQuotas.quotas[quotaType];
      quota.purchasedLimit += amount;
      userQuotas.updatedAt = new Date().toISOString();

      return { newData: userQuotas, result: quota };
    }
  );
}

export async function resetQuota(
  userId: string,
  quotaType: UsageType,
  role: UserRole = 'USER'
): Promise<QuotaEntry> {
  return withOptimisticLock<UserQuotas, QuotaEntry>(
    getQuotaKey(userId),
    async (existing) => {
      let userQuotas = existing;

      if (!userQuotas) {
        userQuotas = initializeQuotasForRole(userId, role);
      }

      const quota = userQuotas.quotas[quotaType];
      quota.usedAmount = 0;
      quota.resetAt = getQuotaResetDate(quota.periodType).toISOString();
      userQuotas.updatedAt = new Date().toISOString();

      return { newData: userQuotas, result: quota };
    }
  );
}

export async function resetAllExpiredQuotas(
  userId: string,
  role: UserRole = 'USER'
): Promise<number> {
  let resetCount = 0;

  await withOptimisticLock<UserQuotas, void>(
    getQuotaKey(userId),
    async (existing) => {
      let userQuotas = existing;

      if (!userQuotas) {
        userQuotas = initializeQuotasForRole(userId, role);
      }

      const now = new Date();
      for (const type of ALL_USAGE_TYPES) {
        const quota = userQuotas.quotas[type];
        if (quota && new Date(quota.resetAt) <= now && quota.periodType !== 'LIFETIME') {
          quota.usedAmount = 0;
          quota.resetAt = getQuotaResetDate(quota.periodType, now).toISOString();
          resetCount++;
        }
      }

      userQuotas.updatedAt = now.toISOString();

      return { newData: userQuotas, result: undefined };
    }
  );

  return resetCount;
}

export function formatQuotaForDisplay(quota: QuotaEntry): {
  type: string;
  label: string;
  baseLimit: number;
  purchasedLimit: number;
  total: number;
  usedAmount: number;
  remaining: number;
  percentage: number;
  periodType: PeriodType;
  resetAt: string;
  formatted: {
    total: string;
    used: string;
    remaining: string;
  };
} {
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

  const total = quota.baseLimit + quota.purchasedLimit;
  const remaining = Math.max(0, total - quota.usedAmount);
  const percentage = total > 0 ? Math.min(100, (quota.usedAmount / total) * 100) : 0;

  const formatAmount = (amount: number, type: UsageType): string => {
    if (type === 'STORAGE') {
      return formatBytes(amount);
    }
    return amount.toLocaleString();
  };

  return {
    type: quota.quotaType,
    label: USAGE_TYPE_LABELS[quota.quotaType],
    baseLimit: quota.baseLimit,
    purchasedLimit: quota.purchasedLimit,
    total,
    usedAmount: quota.usedAmount,
    remaining,
    percentage,
    periodType: quota.periodType,
    resetAt: quota.resetAt,
    formatted: {
      total: formatAmount(total, quota.quotaType),
      used: formatAmount(quota.usedAmount, quota.quotaType),
      remaining: formatAmount(remaining, quota.quotaType),
    },
  };
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export { ALL_USAGE_TYPES, DEFAULT_QUOTAS };
