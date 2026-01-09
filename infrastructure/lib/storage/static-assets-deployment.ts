/**
 * Static Assets Deployment
 * Automatically deploys Next.js static assets to S3 during CDK deployment
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import * as path from 'path';

export interface StaticAssetsDeploymentProps {
  /**
   * S3 bucket for static assets
   */
  staticBucket: s3.IBucket;

  /**
   * CloudFront distribution for cache invalidation
   */
  distribution: cloudfront.IDistribution;

  /**
   * Stack name for resource naming
   */
  stackName: string;
}

export class StaticAssetsDeployment extends Construct {
  public readonly deployment: s3deploy.BucketDeployment;

  constructor(scope: Construct, id: string, props: StaticAssetsDeploymentProps) {
    super(scope, id);

    // IMPORTANT: This deployment reads from frontend/.next/static
    // The Docker build also reads from the same directory.
    // To prevent build mismatches (403 errors), ensure:
    // 1. Frontend is built BEFORE running 'cdk deploy'
    // 2. No rebuilds occur between 'cdk deploy' start and completion
    // 3. prune: true is set to remove old chunk files
    const frontendPath = path.join(__dirname, '../../../frontend');
    const nextStaticPath = path.join(frontendPath, '.next/static');
    const publicPath = path.join(frontendPath, 'public');

    // Deploy Next.js static assets (_next/static/*)
    this.deployment = new s3deploy.BucketDeployment(this, 'NextStaticAssets', {
      sources: [
        s3deploy.Source.asset(nextStaticPath, {
          // Only if .next/static exists (after build)
          exclude: [],
        }),
      ],
      destinationBucket: props.staticBucket,
      destinationKeyPrefix: '_next/static',
      // Invalidate CloudFront cache after deployment
      distribution: props.distribution,
      distributionPaths: ['/_next/static/*'],
      // Use server-side encryption
      serverSideEncryption: s3deploy.ServerSideEncryption.AES_256,
      // CRITICAL: Delete old files to prevent build mismatches
      // Each Next.js build generates unique chunk hashes. Old files must be removed
      // to ensure S3 contains only files from the current build.
      prune: true,
      // Increase Lambda memory for faster deployment (default: 128 MB)
      memoryLimit: 3008, // 3 GB - significantly speeds up large file uploads
    });

    // Deploy public assets (public/*)
    const publicDeployment = new s3deploy.BucketDeployment(this, 'PublicAssets', {
      sources: [
        s3deploy.Source.asset(publicPath),
      ],
      destinationBucket: props.staticBucket,
      destinationKeyPrefix: 'public',
      distribution: props.distribution,
      distributionPaths: ['/public/*'],
      serverSideEncryption: s3deploy.ServerSideEncryption.AES_256,
      // Clean up old public assets (e.g., fonts, images that may change)
      prune: true,
      // Increase Lambda memory for faster deployment
      memoryLimit: 3008, // 3 GB
    });

    // Ensure deployment happens after distribution is created
    this.deployment.node.addDependency(props.distribution);
    publicDeployment.node.addDependency(props.distribution);

    new cdk.CfnOutput(this, 'StaticAssetsStatus', {
      value: 'Static assets will be automatically deployed from frontend/.next/static and frontend/public',
      description: 'Static Assets Deployment Status',
    });
  }
}
