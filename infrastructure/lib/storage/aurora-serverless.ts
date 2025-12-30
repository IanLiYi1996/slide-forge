import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { AURORA_CONFIG } from '../common/constants';

export interface AuroraServerlessConstructProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  stackName: string;
  minCapacity?: number;
  maxCapacity?: number;
  autoPause?: boolean;
  deletionProtection?: boolean;
}

export class AuroraServerlessConstruct extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly secret: secretsmanager.ISecret;
  public readonly databaseName: string;

  constructor(scope: Construct, id: string, props: AuroraServerlessConstructProps) {
    super(scope, id);

    this.databaseName = 'slide_forge';

    // KMS Key for Aurora encryption
    const kmsKey = new kms.Key(this, 'AuroraKmsKey', {
      description: 'KMS key for Aurora encryption',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Aurora Serverless v2 Cluster
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_5,
      }),

      // Serverless v2 configuration
      writer: rds.ClusterInstance.serverlessV2('writer', {
        enablePerformanceInsights: true,
        performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      }),

      // Add a read replica for high availability
      readers: [
        rds.ClusterInstance.serverlessV2('reader', {
          scaleWithWriter: true,
        }),
      ],

      // Capacity configuration
      serverlessV2MinCapacity: props.minCapacity || AURORA_CONFIG.minCapacity,
      serverlessV2MaxCapacity: props.maxCapacity || AURORA_CONFIG.maxCapacity,

      // Credentials (auto-generated and stored in Secrets Manager)
      credentials: rds.Credentials.fromGeneratedSecret('slideforge_admin', {
        secretName: `${props.stackName}/aurora-credentials`,
      }),

      defaultDatabaseName: this.databaseName,

      // Network configuration
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.securityGroup],

      // Encryption
      storageEncrypted: true,
      storageEncryptionKey: kmsKey,

      // Backup configuration
      backup: {
        retention: cdk.Duration.days(AURORA_CONFIG.backupRetentionDays),
        preferredWindow: '03:00-04:00', // UTC
      },

      // Monitoring
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: 7, // days

      // Deletion protection (enable for production)
      deletionProtection: props.deletionProtection ?? false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT, // Create snapshot on deletion
    });

    // Store secret reference
    this.secret = this.cluster.secret!;

    // Outputs
    new cdk.CfnOutput(this, 'AuroraClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora cluster write endpoint',
      exportName: `${props.stackName}-aurora-endpoint`,
    });

    new cdk.CfnOutput(this, 'AuroraReaderEndpoint', {
      value: this.cluster.clusterReadEndpoint.hostname,
      description: 'Aurora cluster read endpoint',
      exportName: `${props.stackName}-aurora-reader-endpoint`,
    });

    new cdk.CfnOutput(this, 'AuroraSecretArn', {
      value: this.secret.secretArn,
      description: 'Aurora credentials secret ARN',
      exportName: `${props.stackName}-aurora-secret-arn`,
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: this.databaseName,
      description: 'Default database name',
    });

    // Generate DATABASE_URL format for Prisma
    const databaseUrl = `postgresql://\${Token[TOKEN.${this.secret.secretValueFromJson('username').unsafeUnwrap()}]}:\${Token[TOKEN.${this.secret.secretValueFromJson('password').unsafeUnwrap()}]}@${this.cluster.clusterEndpoint.hostname}:${this.cluster.clusterEndpoint.port}/${this.databaseName}`;

    new cdk.CfnOutput(this, 'DatabaseUrlFormat', {
      value: 'See Secrets Manager for full DATABASE_URL',
      description: 'Prisma DATABASE_URL format (use secret for actual credentials)',
    });
  }

  /**
   * Get DATABASE_URL secret for use in ECS environment
   */
  public getDatabaseUrlSecret(): secretsmanager.ISecret {
    return this.secret;
  }
}
