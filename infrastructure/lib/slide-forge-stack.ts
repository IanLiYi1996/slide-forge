import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcConstruct } from './network/vpc';
import { AuroraServerlessConstruct } from './storage/aurora-serverless';
import { S3BucketsConstruct } from './storage/s3-buckets';
import { EcsNextjsServiceConstruct } from './compute/ecs-nextjs-service';
import { CloudFrontConstruct } from './cdn/cloudfront';

export interface SlideForgeStackProps extends cdk.StackProps {
  /**
   * Environment: development, staging, or production
   */
  environment?: string;
}

export class SlideForgeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: SlideForgeStackProps) {
    super(scope, id, props);

    const stackName = this.stackName;
    const environment = props?.environment || 'development';

    // 1. Create VPC and Security Groups
    const vpcConstruct = new VpcConstruct(this, 'Network', {
      stackName,
      maxAzs: 3,
      natGateways: environment === 'production' ? 2 : 1, // High availability in production
    });

    // 2. Create S3 Buckets
    const s3Construct = new S3BucketsConstruct(this, 'Storage', {
      stackName,
    });

    // 3. Create Aurora Serverless Database
    const auroraConstruct = new AuroraServerlessConstruct(this, 'Database', {
      vpc: vpcConstruct.vpc,
      securityGroup: vpcConstruct.auroraSecurityGroup,
      stackName,
      minCapacity: 0.5,
      maxCapacity: environment === 'production' ? 4 : 2,
      deletionProtection: environment === 'production',
    });

    // 4. Create ECS Service
    const ecsConstruct = new EcsNextjsServiceConstruct(this, 'Compute', {
      vpc: vpcConstruct.vpc,
      albSecurityGroup: vpcConstruct.albSecurityGroup,
      ecsSecurityGroup: vpcConstruct.ecsSecurityGroup,
      uploadsBucket: s3Construct.uploadsBucket,
      logsBucket: s3Construct.logsBucket,
      kmsKey: s3Construct.kmsKey,
      databaseSecret: auroraConstruct.secret,
      stackName,
    });

    // 5. Create CloudFront Distribution
    const cloudfrontConstruct = new CloudFrontConstruct(this, 'CDN', {
      alb: ecsConstruct.alb,
      staticBucket: s3Construct.staticBucket,
      logsBucket: s3Construct.logsBucket,
      stackName,
    });

    // Add tags to all resources
    cdk.Tags.of(this).add('Project', 'Slide-Forge');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // Stack outputs
    new cdk.CfnOutput(this, 'Environment', {
      value: environment,
      description: 'Deployment environment',
    });

    new cdk.CfnOutput(this, 'DeploymentInstructions', {
      value: [
        '',
        '========================================',
        'Slide-Forge Deployment Successful!',
        '========================================',
        '',
        '📋 Next Steps:',
        '',
        '1. Create required secrets in AWS Secrets Manager:',
        `   aws secretsmanager create-secret --name ${stackName}/openai-api-key --secret-string "sk-..."`,
        `   aws secretsmanager create-secret --name ${stackName}/yunwu-api-key --secret-string "sk-..."`,
        `   aws secretsmanager create-secret --name ${stackName}/tavily-api-key --secret-string "tvly-..."`,
        `   aws secretsmanager create-secret --name ${stackName}/uploadthing-token --secret-string "sk_live_..."`,
        '',
        '2. Run Prisma migrations:',
        `   export DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id ${auroraConstruct.secret.secretArn} --query SecretString --output text | jq -r .connectionString)`,
        '   pnpm prisma migrate deploy',
        '',
        '3. Build and upload static assets:',
        '   pnpm build',
        `   aws s3 sync .next/static s3://${s3Construct.staticBucket.bucketName}/_next/static`,
        `   aws s3 sync public s3://${s3Construct.staticBucket.bucketName}/public`,
        '',
        '4. Invalidate CloudFront cache:',
        `   aws cloudfront create-invalidation --distribution-id ${cloudfrontConstruct.distribution.distributionId} --paths "/*"`,
        '',
        '5. Access your application:',
        `   https://${cloudfrontConstruct.distribution.distributionDomainName}`,
        '',
        '========================================',
      ].join('\n'),
      description: 'Post-deployment instructions',
    });
  }
}
