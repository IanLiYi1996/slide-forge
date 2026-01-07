import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { CLOUDFRONT_CONFIG } from '../common/constants';

export interface CloudFrontConstructProps {
  alb: elbv2.IApplicationLoadBalancer;
  staticBucket: s3.IBucket;
  logsBucket: s3.IBucket;
  stackName: string;
}

export class CloudFrontConstruct extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontConstructProps) {
    super(scope, id);

    // Origin Access Control for S3
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    // VPC Origin for private ALB (CloudFront can access private ALB via VPC peering)
    // Note: VpcOrigin does not support readTimeout/keepaliveTimeout parameters
    // We rely on ALB idle timeout (300s) and early SSE response to prevent timeouts
    const vpcOrigin = origins.VpcOrigin.withApplicationLoadBalancer(props.alb, {
      httpPort: 80,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      originId: `${props.stackName}-${cdk.Aws.ACCOUNT_ID}-alb-vpc-origin`,
    });

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Slide-Forge CDN - ${props.stackName} (with VPC origin for private ALB)`,

      // Default behavior: ALB origin (dynamic content + API routes)
      defaultBehavior: {
        origin: vpcOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        compress: true,
      },

      // Additional behaviors for static assets
      additionalBehaviors: {
        // Next.js static assets (_next/static/*)
        '/_next/static/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(props.staticBucket, {
            originAccessControl: oac,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: new cloudfront.CachePolicy(this, 'StaticCachePolicy', {
            cachePolicyName: `${props.stackName}-static-cache`,
            comment: 'Cache policy for immutable static assets',
            defaultTtl: cdk.Duration.days(CLOUDFRONT_CONFIG.staticCacheTtlDays),
            maxTtl: cdk.Duration.days(CLOUDFRONT_CONFIG.staticCacheTtlDays),
            minTtl: cdk.Duration.days(CLOUDFRONT_CONFIG.staticCacheTtlDays),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
          }),
          compress: true,
        },

        // Public assets (public/*)
        '/public/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(props.staticBucket, {
            originAccessControl: oac,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: new cloudfront.CachePolicy(this, 'PublicCachePolicy', {
            cachePolicyName: `${props.stackName}-public-cache`,
            comment: 'Cache policy for public assets',
            defaultTtl: cdk.Duration.days(CLOUDFRONT_CONFIG.publicCacheTtlDays),
            maxTtl: cdk.Duration.days(30),
            minTtl: cdk.Duration.days(1),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
          }),
          compress: true,
        },
      },

      // Price class (cost optimization)
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // North America and Europe only

      // TLS/SSL
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,

      // Enable logging
      logBucket: props.logsBucket,
      logFilePrefix: 'cloudfront-logs/',
      logIncludesCookies: false,

      // HTTP/2 and HTTP/3
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,

      // Enable IPv6
      enableIpv6: true,
    });

    // Grant S3 read permissions to CloudFront OAC
    // CloudFront OAC 权限通过 bucket policy 自动配置，无需手动 grant
    // props.staticBucket.grantRead(this.distribution);

    // Outputs
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${props.stackName}-distribution-id`,
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `${props.stackName}-distribution-domain`,
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Website URL',
    });
  }
}
