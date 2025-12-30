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
  cpu: 1024, // 1 vCPU
  memory: 2048, // 2 GB
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
};
