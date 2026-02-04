import { getObject, putObjectSimple, deleteObject, listAllObjects } from './s3-client';

export interface ApiConfiguration {
  id: string;
  userId: string;
  apiName: string;
  displayName: string;
  apiKey: string; // Encrypted in storage
  baseUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function getApiConfigKey(userId: string, apiName: string): string {
  return `users/${userId}/api-configs/${apiName}.json`;
}

function getApiConfigPrefix(userId: string): string {
  return `users/${userId}/api-configs/`;
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `c${result}`;
}

export async function getApiConfiguration(
  userId: string,
  apiName: string
): Promise<ApiConfiguration | null> {
  return getObject<ApiConfiguration>(getApiConfigKey(userId, apiName));
}

export async function getUserApiConfigurations(userId: string): Promise<ApiConfiguration[]> {
  const prefix = getApiConfigPrefix(userId);
  const keys = await listAllObjects(prefix);

  const configs = await Promise.all(
    keys.map(async (key) => {
      const config = await getObject<ApiConfiguration>(key);
      return config;
    })
  );

  return configs
    .filter((c): c is ApiConfiguration => c !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function createApiConfiguration(params: {
  userId: string;
  apiName: string;
  displayName: string;
  apiKey: string;
  baseUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<ApiConfiguration> {
  const now = new Date().toISOString();

  const config: ApiConfiguration = {
    id: generateId(),
    userId: params.userId,
    apiName: params.apiName,
    displayName: params.displayName,
    apiKey: params.apiKey, // Should be encrypted before storing
    baseUrl: params.baseUrl ?? null,
    metadata: params.metadata ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await putObjectSimple(getApiConfigKey(params.userId, params.apiName), config);
  return config;
}

export async function updateApiConfiguration(
  userId: string,
  apiName: string,
  updates: Partial<Omit<ApiConfiguration, 'id' | 'userId' | 'apiName' | 'createdAt'>>
): Promise<ApiConfiguration | null> {
  const config = await getApiConfiguration(userId, apiName);
  if (!config) {
    return null;
  }

  const updatedConfig: ApiConfiguration = {
    ...config,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await putObjectSimple(getApiConfigKey(userId, apiName), updatedConfig);
  return updatedConfig;
}

export async function deleteApiConfiguration(
  userId: string,
  apiName: string
): Promise<boolean> {
  const config = await getApiConfiguration(userId, apiName);
  if (!config) {
    return false;
  }

  await deleteObject(getApiConfigKey(userId, apiName));
  return true;
}

export async function getActiveApiConfiguration(
  userId: string,
  apiName: string
): Promise<ApiConfiguration | null> {
  const config = await getApiConfiguration(userId, apiName);
  if (!config || !config.isActive) {
    return null;
  }
  return config;
}

export async function setApiConfigurationActive(
  userId: string,
  apiName: string,
  isActive: boolean
): Promise<ApiConfiguration | null> {
  return updateApiConfiguration(userId, apiName, { isActive });
}
