import { getObject, putObjectSimple, listAllObjects } from './s3-client';
import type { UsageType } from './quota-service';

export interface UsageLogEntry {
  id: string;
  userId: string;
  usageType: UsageType;
  resourceType?: string | null;
  quantity: number;
  unit: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  estimatedCost?: number | null;
  createdAt: string;
}

export interface UsageStats {
  summary: {
    total: number;
    count: number;
    startDate: string;
    endDate: string;
  };
  byType: Array<{
    type: UsageType;
    label: string;
    quantity: number;
    count: number;
    formatted: string;
  }>;
  timeSeries: Array<{
    date: string;
    quantity: number;
    count: number;
  }>;
  recentActivity: UsageLogEntry[];
}

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

function getUsageLogPrefix(userId: string): string {
  return `usage/${userId}/logs/`;
}

function getUsageLogKey(userId: string, timestamp: Date): string {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const ts = timestamp.getTime();
  const random = Math.random().toString(36).substring(2, 8);
  return `usage/${userId}/logs/${year}-${month}/${ts}-${random}.json`;
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `c${result}`;
}

export async function logUsage(params: {
  userId: string;
  usageType: UsageType;
  quantity: number;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  unit?: string;
  estimatedCost?: number;
}): Promise<UsageLogEntry> {
  const now = new Date();

  const entry: UsageLogEntry = {
    id: generateId(),
    userId: params.userId,
    usageType: params.usageType,
    resourceType: params.resourceType ?? null,
    quantity: params.quantity,
    unit: params.unit ?? 'count',
    resourceId: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    estimatedCost: params.estimatedCost ?? null,
    createdAt: now.toISOString(),
  };

  await putObjectSimple(getUsageLogKey(params.userId, now), entry);

  return entry;
}

export async function getUserUsageLogs(
  userId: string,
  options?: {
    usageType?: UsageType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<UsageLogEntry[]> {
  const prefix = getUsageLogPrefix(userId);
  const allKeys = await listAllObjects(prefix);

  // Filter by date range based on key structure (year-month)
  let filteredKeys = allKeys;
  if (options?.startDate || options?.endDate) {
    filteredKeys = allKeys.filter((key) => {
      // Extract year-month from key path
      const match = key.match(/logs\/(\d{4}-\d{2})\//);
      if (!match || !match[1]) return true;

      const parts = match[1].split('-').map(Number);
      const year = parts[0] ?? 0;
      const month = parts[1] ?? 1;
      const keyDate = new Date(year, month - 1);

      if (options?.startDate && keyDate < new Date(options.startDate.getFullYear(), options.startDate.getMonth())) {
        return false;
      }
      if (options?.endDate && keyDate > new Date(options.endDate.getFullYear(), options.endDate.getMonth())) {
        return false;
      }
      return true;
    });
  }

  // Sort keys by timestamp (descending - newest first)
  filteredKeys.sort((a, b) => {
    const tsA = extractTimestamp(a);
    const tsB = extractTimestamp(b);
    return tsB - tsA;
  });

  // Apply limit before fetching
  const keysToFetch = options?.limit ? filteredKeys.slice(0, options.limit * 2) : filteredKeys;

  // Fetch log entries
  const entries = await Promise.all(
    keysToFetch.map(async (key) => {
      const entry = await getObject<UsageLogEntry>(key);
      return entry;
    })
  );

  // Filter and sort
  let result = entries
    .filter((e): e is UsageLogEntry => e !== null)
    .filter((e) => {
      if (options?.usageType && e.usageType !== options.usageType) {
        return false;
      }
      if (options?.startDate && new Date(e.createdAt) < options.startDate) {
        return false;
      }
      if (options?.endDate && new Date(e.createdAt) > options.endDate) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (options?.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

function extractTimestamp(key: string): number {
  const match = key.match(/\/(\d+)-[a-z0-9]+\.json$/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 0;
}

export async function getUserUsageStats(
  userId: string,
  options?: {
    usageType?: UsageType;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }
): Promise<UsageStats> {
  const endDate = options?.endDate ?? new Date();
  const startDate = options?.startDate ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const logs = await getUserUsageLogs(userId, {
    usageType: options?.usageType,
    startDate,
    endDate,
  });

  // Calculate summary
  const summary = {
    total: logs.reduce((sum, log) => sum + log.quantity, 0),
    count: logs.length,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  // Group by type
  const byTypeMap = new Map<UsageType, { quantity: number; count: number }>();
  for (const log of logs) {
    const existing = byTypeMap.get(log.usageType) || { quantity: 0, count: 0 };
    existing.quantity += log.quantity;
    existing.count++;
    byTypeMap.set(log.usageType, existing);
  }

  const byType = Array.from(byTypeMap.entries()).map(([type, data]) => ({
    type,
    label: USAGE_TYPE_LABELS[type],
    quantity: data.quantity,
    count: data.count,
    formatted: formatQuantity(data.quantity, type),
  }));

  // Group by time period
  const groupBy = options?.groupBy || 'day';
  const timeSeriesMap = new Map<string, { quantity: number; count: number }>();

  for (const log of logs) {
    const date = new Date(log.createdAt);
    const key = getTimeSeriesKey(date, groupBy);
    const existing = timeSeriesMap.get(key) || { quantity: 0, count: 0 };
    existing.quantity += log.quantity;
    existing.count++;
    timeSeriesMap.set(key, existing);
  }

  const timeSeries = Array.from(timeSeriesMap.entries())
    .map(([date, data]) => ({
      date,
      quantity: data.quantity,
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Recent activity (last 10)
  const recentActivity = logs.slice(0, 10);

  return {
    summary,
    byType,
    timeSeries,
    recentActivity,
  };
}

function getTimeSeriesKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (groupBy) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      // Get ISO week number
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${year}-W${String(weekNo).padStart(2, '0')}`;
    case 'month':
      return `${year}-${month}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

function formatQuantity(quantity: number, type: UsageType): string {
  if (type === 'STORAGE') {
    return formatBytes(quantity);
  }
  return quantity.toLocaleString();
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function getRecentUsage(
  userId: string,
  limit: number = 10
): Promise<UsageLogEntry[]> {
  return getUserUsageLogs(userId, { limit });
}

export async function getUsageByResource(
  userId: string,
  resourceId: string
): Promise<UsageLogEntry[]> {
  const logs = await getUserUsageLogs(userId);
  return logs.filter((log) => log.resourceId === resourceId);
}
