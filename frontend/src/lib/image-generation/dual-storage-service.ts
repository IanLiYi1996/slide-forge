/**
 * Dual Storage Service
 * Uploads images to both UploadThing (primary) and S3 (backup)
 * Provides fallback mechanism if one storage fails
 */

import { uploadImageToS3 } from '@/services/s3/s3-client';
import type { ImageUrls } from '@/types/smart-hub';

interface DualUploadResult {
  success: boolean;
  urls?: ImageUrls;
  error?: string;
}

/**
 * Upload image buffer to both UploadThing and S3
 * @param imageBuffer - The image data as Buffer
 * @param filename - The filename to use
 * @param contentType - MIME type (default: image/png)
 */
export async function uploadToDualStorage(
  imageBuffer: Buffer,
  filename: string,
  contentType: string = 'image/png'
): Promise<DualUploadResult> {
  const results: { uploadThing?: string; s3?: { key: string; url: string } } = {};
  const errors: string[] = [];

  // Upload to UploadThing (primary)
  try {
    const { utapi } = await import('@/app/api/uploadthing/core');
    const { UTFile } = await import('uploadthing/server');

    const uint8Array = new Uint8Array(imageBuffer);
    const utFile = new UTFile([uint8Array], filename);

    console.log(`[DualStorage] Uploading to UploadThing: ${filename}`);
    const uploadResult = await utapi.uploadFiles([utFile]);

    if (uploadResult[0]?.data?.ufsUrl) {
      results.uploadThing = uploadResult[0].data.ufsUrl;
      console.log(`[DualStorage] UploadThing success: ${results.uploadThing}`);
    } else {
      const error = uploadResult[0]?.error?.message || 'Unknown UploadThing error';
      errors.push(`UploadThing: ${error}`);
      console.error(`[DualStorage] UploadThing failed:`, error);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`UploadThing: ${msg}`);
    console.error(`[DualStorage] UploadThing error:`, error);
  }

  // Upload to S3 (backup)
  try {
    console.log(`[DualStorage] Uploading to S3: ${filename}`);
    const s3Result = await uploadImageToS3(imageBuffer, filename, contentType);
    results.s3 = s3Result;
    console.log(`[DualStorage] S3 success: ${s3Result.url}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`S3: ${msg}`);
    console.error(`[DualStorage] S3 error:`, error);
  }

  // Check if at least one upload succeeded
  if (!results.uploadThing && !results.s3) {
    return {
      success: false,
      error: `Both uploads failed: ${errors.join('; ')}`,
    };
  }

  // Construct the response with primary and backup URLs
  const urls: ImageUrls = {
    primary: results.uploadThing || results.s3!.url,
    backup: results.s3?.url,
    s3Key: results.s3?.key,
  };

  // Log warning if one storage failed
  if (!results.uploadThing) {
    console.warn(`[DualStorage] UploadThing failed, using S3 as primary`);
  }
  if (!results.s3) {
    console.warn(`[DualStorage] S3 backup failed, only UploadThing available`);
  }

  return {
    success: true,
    urls,
  };
}

/**
 * Upload image from base64 data to both storages
 */
export async function uploadBase64ToDualStorage(
  base64Data: string,
  filename: string,
  contentType: string = 'image/png'
): Promise<DualUploadResult> {
  const imageBuffer = Buffer.from(base64Data, 'base64');
  return uploadToDualStorage(imageBuffer, filename, contentType);
}

/**
 * Upload image from URL to both storages
 * Downloads the image first, then uploads to both destinations
 */
export async function uploadFromUrlToDualStorage(
  imageUrl: string,
  filename: string,
  contentType: string = 'image/png'
): Promise<DualUploadResult> {
  try {
    console.log(`[DualStorage] Downloading from URL: ${imageUrl.substring(0, 50)}...`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to download image: ${response.statusText}`,
      };
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`[DualStorage] Downloaded ${imageBuffer.length} bytes`);

    return uploadToDualStorage(imageBuffer, filename, contentType);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download image',
    };
  }
}

/**
 * Get the best available URL from ImageUrls
 * Returns primary URL if available, otherwise backup
 */
export function getBestImageUrl(urls: ImageUrls | undefined, fallback?: string): string {
  if (!urls) {
    return fallback || '';
  }
  return urls.primary || urls.backup || fallback || '';
}

/**
 * Check if an image URL is accessible
 */
export async function isImageUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get accessible URL from ImageUrls, checking availability
 * Falls back to backup if primary is not accessible
 */
export async function getAccessibleImageUrl(urls: ImageUrls | undefined): Promise<string | null> {
  if (!urls) {
    return null;
  }

  // Check primary first
  if (urls.primary && await isImageUrlAccessible(urls.primary)) {
    return urls.primary;
  }

  // Fall back to backup
  if (urls.backup && await isImageUrlAccessible(urls.backup)) {
    console.warn(`[DualStorage] Primary URL inaccessible, using backup`);
    return urls.backup;
  }

  return null;
}
