/**
 * Usage Tracker Hook
 *
 * Provides a unified interface for tracking usage across the application.
 * Automatically handles quota checking and provides user feedback.
 */

'use client';

import { type UsageType } from '@prisma/client';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface UsageMetadata {
  [key: string]: unknown;
}

interface TrackUsageResponse {
  success: boolean;
  quotaExceeded?: boolean;
  remaining?: number;
  message?: string;
}

export interface UseUsageTrackerReturn {
  trackUsage: (
    usageType: UsageType,
    quantity: number,
    metadata?: UsageMetadata
  ) => Promise<boolean>;
  isTracking: boolean;
}

/**
 * Hook for tracking usage and checking quotas
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { trackUsage, isTracking } = useUsageTracker();
 *
 *   const handleGenerate = async () => {
 *     const allowed = await trackUsage('SLIDE_GENERATION', 1, {
 *       slideId: 'slide-123',
 *       theme: 'modern'
 *     });
 *
 *     if (allowed) {
 *       // Proceed with generation
 *     }
 *   };
 *
 *   return <button onClick={handleGenerate} disabled={isTracking}>Generate</button>;
 * }
 * ```
 */
export function useUsageTracker(): UseUsageTrackerReturn {
  const [isTracking, setIsTracking] = useState(false);

  const trackUsage = useCallback(
    async (
      usageType: UsageType,
      quantity: number,
      metadata?: UsageMetadata
    ): Promise<boolean> => {
      // Don't track if already tracking (prevent duplicate calls)
      if (isTracking) {
        return false;
      }

      setIsTracking(true);

      try {
        const response = await fetch('/api/usage/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            usageType,
            quantity,
            metadata,
          }),
        });

        if (!response.ok) {
          // Handle HTTP errors
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to track usage');
        }

        const data: TrackUsageResponse = await response.json();

        if (data.quotaExceeded) {
          // Show quota exceeded error with toast
          toast.error(
            `Quota exceeded for ${formatUsageType(usageType)}`,
            {
              description: data.message || 'Please upgrade your plan or wait for quota reset.',
              action: {
                label: 'View Quota',
                onClick: () => {
                  window.location.href = '/settings/quota';
                },
              },
            }
          );
          return false;
        }

        // Show success with remaining quota info
        if (data.remaining !== undefined && data.remaining < 10) {
          // Warning when quota is low
          toast.warning(
            `Low quota: ${data.remaining} ${formatUsageType(usageType)} remaining`,
            {
              description: 'Consider purchasing additional quota.',
            }
          );
        }

        return true;
      } catch (error) {
        console.error('Failed to track usage:', error);

        // Show error toast
        toast.error('Failed to track usage', {
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        });

        // Return true to not block the main operation
        // Tracking failures should not prevent user actions
        return true;
      } finally {
        setIsTracking(false);
      }
    },
    [isTracking]
  );

  return {
    trackUsage,
    isTracking,
  };
}

/**
 * Format usage type for display
 */
function formatUsageType(usageType: UsageType): string {
  const labels: Record<UsageType, string> = {
    AI_MODEL_CALL: 'AI Model Calls',
    SLIDE_GENERATION: 'Slide Generation',
    IMAGE_GENERATION: 'Image Generation',
    IMAGE_SEARCH: 'Image Search',
    STORAGE: 'Storage',
    DOCUMENT_PROCESSING: 'Document Processing',
    EXPORT_PDF: 'PDF Exports',
    EXPORT_PPTX: 'PPTX Exports',
  };

  return labels[usageType] || usageType;
}

/**
 * Preload usage quota check without tracking
 *
 * Useful for showing UI state before an action
 *
 * @example
 * ```tsx
 * const { data: quota } = useQuery({
 *   queryKey: ['quota', 'SLIDE_GENERATION'],
 *   queryFn: () => checkQuotaAvailable('SLIDE_GENERATION', 1),
 * });
 *
 * return (
 *   <button disabled={!quota?.available}>
 *     Generate Slide {quota?.remaining && `(${quota.remaining} left)`}
 *   </button>
 * );
 * ```
 */
export async function checkQuotaAvailable(
  usageType: UsageType,
  quantity: number
): Promise<{
  available: boolean;
  remaining: number;
  total: number;
  used: number;
}> {
  const response = await fetch(
    `/api/usage/quota?type=${usageType}&quantity=${quantity}`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to check quota');
  }

  return response.json();
}
