import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectsCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.UPLOADS_BUCKET || '';
const DATA_PREFIX = 'data/';

export interface S3ObjectWithVersion<T> {
  data: T;
  _version: number;
  _etag?: string;
}

export interface PutOptions {
  expectedVersion?: number;
  contentType?: string;
}

export interface ListOptions {
  prefix: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListResult {
  keys: string[];
  continuationToken?: string;
  isTruncated: boolean;
}

function getFullKey(key: string): string {
  return `${DATA_PREFIX}${key}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      const isRetryable =
        error instanceof Error &&
        ('code' in error || 'name' in error) &&
        (
          (error as { code?: string }).code === 'SlowDown' ||
          (error as { code?: string }).code === 'ServiceUnavailable' ||
          (error as { code?: string }).code === 'InternalError' ||
          error.name === 'ServiceUnavailable' ||
          error.name === 'InternalError'
        );

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
      await sleep(delay);
    }
  }

  throw lastError;
}

export async function getObject<T>(key: string): Promise<T | null> {
  return withRetry(async () => {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: getFullKey(key),
      });

      const response: GetObjectCommandOutput = await s3Client.send(command);
      const body = await response.Body?.transformToString();

      if (!body) {
        return null;
      }

      return JSON.parse(body) as T;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  });
}

export async function getObjectWithVersion<T>(
  key: string
): Promise<S3ObjectWithVersion<T> | null> {
  return withRetry(async () => {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: getFullKey(key),
      });

      const response = await s3Client.send(command);
      const body = await response.Body?.transformToString();

      if (!body) {
        return null;
      }

      const data = JSON.parse(body) as T & { _version?: number };
      const version = data._version ?? 0;

      return {
        data,
        _version: version,
        _etag: response.ETag,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  });
}

export async function putObject<T>(
  key: string,
  data: T,
  options: PutOptions = {}
): Promise<{ success: true; version: number } | { success: false; reason: 'version_conflict' }> {
  const { expectedVersion, contentType = 'application/json' } = options;

  if (expectedVersion !== undefined) {
    const existing = await getObjectWithVersion<T>(key);
    const currentVersion = existing?._version ?? 0;

    if (currentVersion !== expectedVersion) {
      return { success: false, reason: 'version_conflict' };
    }
  }

  const newVersion = (expectedVersion ?? 0) + 1;
  const dataWithVersion = { ...data, _version: newVersion };

  return withRetry(async () => {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: getFullKey(key),
      Body: JSON.stringify(dataWithVersion),
      ContentType: contentType,
    });

    await s3Client.send(command);
    return { success: true as const, version: newVersion };
  });
}

export async function putObjectSimple<T>(
  key: string,
  data: T,
  contentType: string = 'application/json'
): Promise<void> {
  return withRetry(async () => {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: getFullKey(key),
      Body: JSON.stringify(data),
      ContentType: contentType,
    });

    await s3Client.send(command);
  });
}

export async function deleteObject(key: string): Promise<void> {
  return withRetry(async () => {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: getFullKey(key),
    });

    await s3Client.send(command);
  });
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) {
    batches.push(keys.slice(i, i + 1000));
  }

  for (const batch of batches) {
    await withRetry(async () => {
      const command = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: batch.map((key) => ({ Key: getFullKey(key) })),
          Quiet: true,
        },
      });

      await s3Client.send(command);
    });
  }
}

export async function objectExists(key: string): Promise<boolean> {
  return withRetry(async () => {
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: getFullKey(key),
      });

      await s3Client.send(command);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) {
        return false;
      }
      throw error;
    }
  });
}

export async function listObjects(options: ListOptions): Promise<ListResult> {
  return withRetry(async () => {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: getFullKey(options.prefix),
      MaxKeys: options.maxKeys || 1000,
      ContinuationToken: options.continuationToken,
    });

    const response = await s3Client.send(command);

    const keys = (response.Contents || [])
      .map((obj) => obj.Key)
      .filter((key): key is string => key !== undefined)
      .map((key) => key.replace(DATA_PREFIX, ''));

    return {
      keys,
      continuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated ?? false,
    };
  });
}

export async function listAllObjects(
  options: ListOptions | string
): Promise<string[]> {
  const prefix = typeof options === 'string' ? options : options.prefix;
  const allKeys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await listObjects({
      prefix,
      continuationToken,
    });

    allKeys.push(...result.keys);
    continuationToken = result.continuationToken;
  } while (continuationToken);

  return allKeys;
}

export async function withOptimisticLock<T, R>(
  key: string,
  operation: (data: T | null, version: number) => Promise<{ newData: T; result: R }>,
  maxRetries: number = 3
): Promise<R> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const existing = await getObjectWithVersion<T>(key);
    const currentVersion = existing?._version ?? 0;
    const currentData = existing?.data ?? null;

    const { newData, result } = await operation(currentData, currentVersion);

    const putResult = await putObject(key, newData, { expectedVersion: currentVersion });

    if (putResult.success) {
      return result;
    }

    if (attempt < maxRetries - 1) {
      const delay = 50 * Math.pow(2, attempt) + Math.random() * 50;
      await sleep(delay);
    }
  }

  throw new Error(`Optimistic lock failed after ${maxRetries} retries for key: ${key}`);
}

export { BUCKET_NAME, DATA_PREFIX };
