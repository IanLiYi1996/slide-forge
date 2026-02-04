import { getObject, putObjectSimple, listAllObjects, deleteObject } from './s3-client';
import { nanoid } from 'nanoid';
import type { UsageType } from './quota-service';

export type PurchaseStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface QuotaPurchase {
  id: string;
  userId: string;
  quotaType: UsageType;
  amount: number;
  price: number;
  paymentMethod: string;
  status: PurchaseStatus;
  transactionId?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

function getPurchaseKey(userId: string, purchaseId: string): string {
  return `usage/${userId}/purchases/${purchaseId}.json`;
}

function getPurchasesPrefix(userId: string): string {
  return `usage/${userId}/purchases/`;
}

export async function createPurchase(
  data: Omit<QuotaPurchase, 'id' | 'createdAt' | 'updatedAt'>
): Promise<QuotaPurchase> {
  const now = new Date().toISOString();
  const id = nanoid();

  const purchase: QuotaPurchase = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await putObjectSimple(getPurchaseKey(data.userId, id), purchase);
  return purchase;
}

export async function getPurchase(
  userId: string,
  purchaseId: string
): Promise<QuotaPurchase | null> {
  return getObject<QuotaPurchase>(getPurchaseKey(userId, purchaseId));
}

export async function updatePurchase(
  userId: string,
  purchaseId: string,
  updates: Partial<Omit<QuotaPurchase, 'id' | 'userId' | 'createdAt'>>
): Promise<QuotaPurchase | null> {
  const existing = await getPurchase(userId, purchaseId);
  if (!existing) {
    return null;
  }

  const updated: QuotaPurchase = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await putObjectSimple(getPurchaseKey(userId, purchaseId), updated);
  return updated;
}

export async function getUserPurchases(
  userId: string,
  options: {
    status?: PurchaseStatus;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ purchases: QuotaPurchase[]; total: number }> {
  const { status, limit = 50, offset = 0 } = options;

  const objectKeys = await listAllObjects({
    prefix: getPurchasesPrefix(userId),
  });

  const allPurchases: QuotaPurchase[] = [];
  for (const key of objectKeys) {
    const purchase = await getObject<QuotaPurchase>(key);
    if (purchase) {
      if (!status || purchase.status === status) {
        allPurchases.push(purchase);
      }
    }
  }

  // Sort by createdAt descending
  allPurchases.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const total = allPurchases.length;
  const paginated = allPurchases.slice(offset, offset + limit);

  return { purchases: paginated, total };
}

export async function getPurchaseStats(userId: string): Promise<{
  total: number;
  completed: number;
  pending: number;
  totalSpent: number;
}> {
  const { purchases } = await getUserPurchases(userId, { limit: 1000 });

  const completed = purchases.filter((p) => p.status === 'COMPLETED').length;
  const pending = purchases.filter((p) => p.status === 'PENDING').length;
  const totalSpent = purchases
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.price, 0);

  return {
    total: purchases.length,
    completed,
    pending,
    totalSpent,
  };
}

export async function deletePurchase(
  userId: string,
  purchaseId: string
): Promise<boolean> {
  try {
    await deleteObject(getPurchaseKey(userId, purchaseId));
    return true;
  } catch {
    return false;
  }
}
