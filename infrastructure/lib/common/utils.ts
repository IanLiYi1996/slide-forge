/**
 * Common utility functions for CDK constructs
 */

import { Fn, Stack } from 'aws-cdk-lib';

/**
 * Extract short ID from CloudFormation Stack ID
 *
 * Stack ID format: arn:aws:cloudformation:region:account:stack/name/715aa180-e9db-11f0-...
 * Returns: 715aa180 (first 8 characters of unique ID)
 *
 * This provides a deterministic, unique identifier for each stack that doesn't
 * change across deployments, making it perfect for resource naming.
 *
 * @param stack - CDK Stack instance
 * @returns Short ID extracted from stack (e.g., "715aa180")
 */
export function getShortIdOfStack(stack: Stack): string {
  return Fn.select(0, Fn.split('-', Fn.select(2, Fn.split('/', stack.stackId))));
}
