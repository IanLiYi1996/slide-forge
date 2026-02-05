/**
 * Fargate Next.js Service Construct
 *
 * Simplified Fargate deployment for the Next.js frontend.
 * This replaces the EC2-based ECS service with a stateless Fargate service.
 *
 * Key differences from ECS EC2 service:
 * - No EC2 instances, ASG, or capacity providers
 * - No sticky sessions (agent state is managed by AgentCore)
 * - Uses awsvpc network mode (Fargate requirement)
 * - Simplified configuration without volume mounts
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Construct } from 'constructs';
import { ECS_CONFIG } from '../common/constants';

export interface FargateNextjsServiceConstructProps {
  /**
   * VPC for the Fargate tasks
   */
  vpc: ec2.IVpc;

  /**
   * Application Load Balancer (passed from main stack)
   */
  alb: elbv2.IApplicationLoadBalancer;

  /**
   * Security group for the ALB
   */
  albSecurityGroup: ec2.ISecurityGroup;

  /**
   * Security group for ECS/Fargate tasks
   */
  ecsSecurityGroup: ec2.ISecurityGroup;

  /**
   * S3 bucket for uploads
   */
  uploadsBucket: s3.IBucket;

  /**
   * S3 bucket for logs
   */
  logsBucket: s3.IBucket;

  /**
   * KMS key for encryption
   */
  kmsKey: kms.IKey;

  /**
   * Stack name for resource naming
   */
  stackName: string;

  /**
   * CloudFront distribution domain for NEXTAUTH_URL
   */
  distributionDomain: string;

  /**
   * AgentCore Runtime URL (backend API endpoint)
   */
  agentCoreRuntimeUrl: string;

  /**
   * Environment variable configuration
   */
  envConfig?: {
    claudeUseBedrock?: boolean;
    anthropicApiKey?: string;
    llmApiKey?: string;
    llmBaseUrl?: string;
    llmModelName?: string;
    tavilyApiKey?: string;
    uploadthingToken?: string;
    unsplashAccessKey?: string;
  };

  /**
   * Cognito authentication configuration
   */
  cognitoConfig?: {
    clientId: string;
    clientSecret: cdk.SecretValue;
    issuer: string;
  };

  /**
   * Desired number of tasks (default: 1)
   */
  desiredCount?: number;

  /**
   * CPU units for the task (default: 1024 = 1 vCPU)
   */
  cpu?: number;

  /**
   * Memory in MiB for the task (default: 2048 = 2 GB)
   */
  memoryMiB?: number;
}

export class FargateNextjsServiceConstruct extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;
  public readonly alb: elbv2.IApplicationLoadBalancer;
  public readonly taskRole: iam.Role;

  constructor(scope: Construct, id: string, props: FargateNextjsServiceConstructProps) {
    super(scope, id);

    // =========================================================================
    // 1. ECS Cluster
    // =========================================================================

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `${props.stackName}-fargate-cluster`,
      containerInsights: true,
    });

    // =========================================================================
    // 2. Secrets
    // =========================================================================

    // NextAuth secret for session management
    const nextAuthSecret = new secretsmanager.Secret(this, 'NextAuthSecret', {
      secretName: `${props.stackName}/nextauth-secret`,
      generateSecretString: {
        excludeCharacters: '{}[]"\\',
        passwordLength: 32,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // =========================================================================
    // 3. CloudWatch Log Group
    // =========================================================================

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/${props.stackName}-fargate`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // =========================================================================
    // 4. IAM Roles
    // =========================================================================

    // Task Execution Role (for pulling images, writing logs)
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant access to secrets
    nextAuthSecret.grantRead(taskExecutionRole);

    // Task Role (for application permissions)
    this.taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'BedrockInvokeModel',
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
              resources: [
                // Foundation models
                `arn:aws:bedrock:*::foundation-model/*`,
                // Inference profiles
                `arn:aws:bedrock:*:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
                // Application inference profiles
                `arn:aws:bedrock:*:${cdk.Aws.ACCOUNT_ID}:application-inference-profile/*`,
              ],
            }),
            new iam.PolicyStatement({
              sid: 'BedrockGetInferenceProfile',
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:GetInferenceProfile', 'bedrock:ListInferenceProfiles'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Grant S3 permissions
    props.kmsKey.grantEncryptDecrypt(this.taskRole);
    props.uploadsBucket.grantReadWrite(this.taskRole);

    // =========================================================================
    // 5. Task Definition (Fargate)
    // =========================================================================

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: props.cpu || 1024, // 1 vCPU default (Fargate supports: 256, 512, 1024, 2048, 4096)
      memoryLimitMiB: props.memoryMiB || 2048, // 2 GB default
      executionRole: taskExecutionRole,
      taskRole: this.taskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // =========================================================================
    // 6. Environment Variables
    // =========================================================================

    const environment: Record<string, string> = {
      NODE_ENV: 'production',
      PORT: '3000',
      HOSTNAME: '0.0.0.0',
      AWS_REGION: cdk.Aws.REGION,

      // AI Services - Frontend calls AgentCore backend
      AGENTCORE_RUNTIME_URL: props.agentCoreRuntimeUrl,
      CLAUDE_CODE_USE_BEDROCK: props.envConfig?.claudeUseBedrock !== false ? '1' : '0',
      ENABLE_CLAUDE_AGENT: 'true',

      // S3 Configuration
      UPLOADS_BUCKET: props.uploadsBucket.bucketName,

      // NextAuth URLs
      NEXTAUTH_URL: `https://${props.distributionDomain}`,
    };

    // Optional third-party service configuration
    if (props.envConfig?.llmBaseUrl) {
      environment.LLM_BASE_URL = props.envConfig.llmBaseUrl;
    }
    if (props.envConfig?.llmModelName) {
      environment.LLM_MODEL_NAME = props.envConfig.llmModelName;
    }

    // =========================================================================
    // 7. Secrets Configuration
    // =========================================================================

    const secrets: Record<string, ecs.Secret> = {
      NEXTAUTH_SECRET: ecs.Secret.fromSecretsManager(nextAuthSecret),
    };

    // Optional API keys as secrets
    if (props.envConfig?.anthropicApiKey) {
      const anthropicSecret = new secretsmanager.Secret(this, 'AnthropicApiKey', {
        secretName: `${props.stackName}/anthropic-api-key`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.anthropicApiKey),
      });
      secrets.ANTHROPIC_API_KEY = ecs.Secret.fromSecretsManager(anthropicSecret);
    }

    if (props.envConfig?.llmApiKey) {
      const llmSecret = new secretsmanager.Secret(this, 'LlmApiKey', {
        secretName: `${props.stackName}/llm-api-key`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.llmApiKey),
      });
      secrets.LLM_API_KEY = ecs.Secret.fromSecretsManager(llmSecret);
    }

    if (props.envConfig?.tavilyApiKey) {
      const tavilySecret = new secretsmanager.Secret(this, 'TavilyApiKey', {
        secretName: `${props.stackName}/tavily-api-key`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.tavilyApiKey),
      });
      secrets.TAVILY_API_KEY = ecs.Secret.fromSecretsManager(tavilySecret);
    }

    if (props.envConfig?.uploadthingToken) {
      const uploadthingSecret = new secretsmanager.Secret(this, 'UploadthingToken', {
        secretName: `${props.stackName}/uploadthing-token`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.uploadthingToken),
      });
      secrets.UPLOADTHING_TOKEN = ecs.Secret.fromSecretsManager(uploadthingSecret);
    }

    if (props.envConfig?.unsplashAccessKey) {
      const unsplashSecret = new secretsmanager.Secret(this, 'UnsplashAccessKey', {
        secretName: `${props.stackName}/unsplash-access-key`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.unsplashAccessKey),
      });
      secrets.UNSPLASH_ACCESS_KEY = ecs.Secret.fromSecretsManager(unsplashSecret);
    }

    // Cognito configuration
    if (props.cognitoConfig) {
      const cognitoClientSecret = new secretsmanager.Secret(this, 'CognitoClientSecret', {
        secretName: `${props.stackName}/cognito-client-secret`,
        secretStringValue: props.cognitoConfig.clientSecret,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      cognitoClientSecret.grantRead(taskExecutionRole);
      secrets.COGNITO_CLIENT_SECRET = ecs.Secret.fromSecretsManager(cognitoClientSecret);
      environment.COGNITO_CLIENT_ID = props.cognitoConfig.clientId;
      environment.COGNITO_ISSUER = props.cognitoConfig.issuer;
    }

    // =========================================================================
    // 8. Container Definition
    // =========================================================================

    const container = taskDefinition.addContainer('nextjs', {
      image: ecs.ContainerImage.fromAsset('../frontend', {
        file: 'Dockerfile.production',
        platform: Platform.LINUX_AMD64,
      }),
      environment,
      secrets,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'nextjs',
        logGroup: logGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget --spider http://localhost:3000/api/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 5,
        startPeriod: cdk.Duration.seconds(120),
      },
    });

    container.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // =========================================================================
    // 9. ALB and Target Group
    // =========================================================================

    this.alb = props.alb;

    // Target Group - No sticky sessions needed (stateless frontend)
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP, // Fargate uses IP target type (awsvpc mode)

      // NOTE: No sticky sessions - agent state is managed by AgentCore backend
      // stickinessCookieDuration: undefined,

      healthCheck: {
        enabled: true,
        healthyHttpCodes: '200',
        path: '/api/health',
        protocol: elbv2.Protocol.HTTP,
        port: 'traffic-port',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Listener
    this.alb.addListener('Listener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
    });

    // =========================================================================
    // 10. Fargate Service
    // =========================================================================

    this.service = new ecs.FargateService(this, 'Service', {
      cluster: this.cluster,
      serviceName: `${props.stackName}-fargate-service`,
      taskDefinition,
      desiredCount: props.desiredCount || ECS_CONFIG.desiredCount,
      securityGroups: [props.ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      enableExecuteCommand: true,
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      // Deployment configuration
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      // Use REPLICA deployment (default)
      circuitBreaker: {
        enable: true,
        rollback: true,
      },
    });

    // Attach to target group
    this.service.attachToApplicationTargetGroup(targetGroup);

    // =========================================================================
    // 11. Auto Scaling (optional)
    // =========================================================================

    const scaling = this.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Scale based on memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Fargate cluster name',
      exportName: `${props.stackName}-fargate-cluster-name`,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.service.serviceName,
      description: 'ECS Fargate service name',
      exportName: `${props.stackName}-fargate-service-name`,
    });

    new cdk.CfnOutput(this, 'ALBDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS name',
      exportName: `${props.stackName}-fargate-alb-dns`,
    });
  }
}
