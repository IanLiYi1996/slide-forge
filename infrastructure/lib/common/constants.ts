/**
 * Common constants for Slide-Forge infrastructure
 */

export const DEFAULT_REMOVAL_POLICY = 'DESTROY'; // Change to RETAIN for production
export const DEFAULT_LOG_RETENTION_DAYS = 7;

export const VPC_CONFIG = {
  maxAzs: 3,
  natGateways: 1, // Use 2 for production high availability
};

export const ECS_CONFIG = {
  cpu: 2048, // 2 vCPU (upgraded for session pool)
  memory: 4096, // 4 GB (upgraded to support 3 pooled agent sessions)
  desiredCount: 2,
  minCapacity: 2,
  maxCapacity: 10,
  targetCpuUtilization: 70,
  targetMemoryUtilization: 80,
};

export const AURORA_CONFIG = {
  minCapacity: 0.5, // 0.5 ACU (~1 GB RAM)
  maxCapacity: 2, // 2 ACU (~4 GB RAM)
  autoPauseMinutes: 5, // Auto-pause after 5 minutes of inactivity (dev only)
  backupRetentionDays: 7,
};

export const CLOUDFRONT_CONFIG = {
  priceClass: 'PRICE_CLASS_100', // North America and Europe only
  staticCacheTtlDays: 365,
  publicCacheTtlDays: 7,
  // Timeout configurations for long-running agent operations
  // Note: CloudFront VpcOrigin has max readTimeout of 180 seconds
  originReadTimeout: 180, // 3 minutes (CloudFront VpcOrigin maximum)
  originKeepaliveTimeout: 60, // Keep TCP connection alive
};

export const ALB_CONFIG = {
  idleTimeout: 300, // 5 minutes to support long-running SSE connections
};
