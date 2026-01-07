import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface S3BucketsConstructProps {
  stackName: string;
}

export class S3BucketsConstruct extends Construct {
  public readonly staticBucket: s3.Bucket;
  public readonly uploadsBucket: s3.Bucket;
  public readonly logsBucket: s3.Bucket;
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props: S3BucketsConstructProps) {
    super(scope, id);

    // KMS Key for S3 encryption
    this.kmsKey = new kms.Key(this, 'S3EncryptionKey', {
      description: 'KMS key for S3 bucket encryption',
      enableKeyRotation: true,
      policy: new iam.PolicyDocument({
        statements: [
          // Root account access
          new iam.PolicyStatement({
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          // S3 service access
          new iam.PolicyStatement({
            principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:GenerateDataKey',
              'kms:ReEncrypt*',
              'kms:CreateGrant',
              'kms:DescribeKey',
            ],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': `s3.${cdk.Aws.REGION}.amazonaws.com`,
              },
            },
          }),
          // ECS tasks access
          new iam.PolicyStatement({
            principals: [new iam.ServicePrincipal('ecs-tasks.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:GenerateDataKey',
              'kms:ReEncrypt*',
              'kms:CreateGrant',
              'kms:DescribeKey',
            ],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': `s3.${cdk.Aws.REGION}.amazonaws.com`,
              },
            },
          }),
          // CloudFront access
          new iam.PolicyStatement({
            principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
            actions: ['kms:Decrypt', 'kms:DescribeKey'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': `s3.${cdk.Aws.REGION}.amazonaws.com`,
              },
            },
          }),
        ],
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new kms.Alias(this, 'S3EncryptionKeyAlias', {
      aliasName: `alias/${props.stackName.toLowerCase()}-s3-encryption`,
      targetKey: this.kmsKey,
    });

    // 1. Logs Bucket (for ALB, S3, CloudFront access logs)
    this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `${props.stackName.toLowerCase()}-logs-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED, // Use S3_MANAGED for logs bucket
      enforceSSL: true,
    });

    // Add policy to allow ALB to write access logs
    this.logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [this.logsBucket.arnForObjects('alb-access-logs/*')],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
      }),
    );

    // Grant ELB logging service permission
    this.logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('logdelivery.elasticloadbalancing.amazonaws.com')],
        actions: ['s3:GetBucketAcl', 's3:PutObject'],
        resources: [
          this.logsBucket.bucketArn,
          this.logsBucket.arnForObjects('alb-access-logs/*'),
        ],
      }),
    );

    // 2. Static Assets Bucket (for .next/static and public files)
    this.staticBucket = new s3.Bucket(this, 'StaticBucket', {
      bucketName: `${props.stackName.toLowerCase()}-static-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      serverAccessLogsBucket: this.logsBucket,
      serverAccessLogsPrefix: 'static-bucket-logs/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      bucketKeyEnabled: true, // Reduce KMS costs
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    });

    // 3. Uploads Bucket (for user-uploaded documents and images)
    this.uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `${props.stackName.toLowerCase()}-uploads-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true, // Enable versioning for user uploads
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      serverAccessLogsBucket: this.logsBucket,
      serverAccessLogsPrefix: 'uploads-bucket-logs/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      bucketKeyEnabled: true,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'], // Will be restricted by CloudFront
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: 'archive-old-files',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'StaticBucketName', {
      value: this.staticBucket.bucketName,
      description: 'Static assets bucket name',
      exportName: `${props.stackName}-static-bucket`,
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: this.uploadsBucket.bucketName,
      description: 'Uploads bucket name',
      exportName: `${props.stackName}-uploads-bucket`,
    });

    new cdk.CfnOutput(this, 'LogsBucketName', {
      value: this.logsBucket.bucketName,
      description: 'Logs bucket name',
    });

    new cdk.CfnOutput(this, 'KmsKeyId', {
      value: this.kmsKey.keyId,
      description: 'KMS key ID for S3 encryption',
      exportName: `${props.stackName}-kms-key-id`,
    });
  }
}
