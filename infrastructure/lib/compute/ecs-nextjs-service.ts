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

export interface EcsNextjsServiceConstructProps {
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.ISecurityGroup;
  ecsSecurityGroup: ec2.ISecurityGroup;
  uploadsBucket: s3.IBucket;
  logsBucket: s3.IBucket;
  kmsKey: kms.IKey;
  databaseSecret: secretsmanager.ISecret;
  stackName: string;
  distributionDomain?: string;
  // 环境变量配置
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
  // Cognito 认证配置
  cognitoConfig?: {
    clientId: string;
    clientSecret: cdk.SecretValue;
    issuer: string;
  };
  // Claude Agent SDK IAM Role（可选）
  agentSdkRoleArn?: string;
}

export class EcsNextjsServiceConstruct extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly taskRole: iam.Role;

  constructor(scope: Construct, id: string, props: EcsNextjsServiceConstructProps) {
    super(scope, id);

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `${props.stackName}-cluster`,
      containerInsights: true,
    });

    // Create NextAuth secret
    const nextAuthSecret = new secretsmanager.Secret(this, 'NextAuthSecret', {
      secretName: `${props.stackName}/nextauth-secret`,
      generateSecretString: {
        excludeCharacters: '{}[]"\\',
        passwordLength: 32,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/${props.stackName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ECS Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant access to secrets
    props.databaseSecret.grantRead(taskExecutionRole);
    nextAuthSecret.grantRead(taskExecutionRole);

    // ECS Task Role (for application permissions)
    this.taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-*`,
              ],
            }),
          ],
        }),
      },
    });

    // Grant S3 permissions
    props.kmsKey.grantEncryptDecrypt(this.taskRole);
    props.uploadsBucket.grantReadWrite(this.taskRole);

    // 如果提供了 Agent SDK Role，添加 AssumeRole 权限
    if (props.agentSdkRoleArn) {
      this.taskRole.addToPolicy(
        new iam.PolicyStatement({
          sid: 'AssumeAgentSdkRole',
          effect: iam.Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: [props.agentSdkRoleArn],
        })
      );
      console.log('✓ ECS Task Role can assume Agent SDK Role');
    }

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: ECS_CONFIG.memory,
      cpu: ECS_CONFIG.cpu,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64, // Use Graviton2 for cost savings
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      executionRole: taskExecutionRole,
      taskRole: this.taskRole,
    });

    // 构建环境变量映射
    const environment: Record<string, string> = {
      NODE_ENV: 'production',
      PORT: '3000',
      HOSTNAME: '0.0.0.0',
      AWS_REGION: cdk.Aws.REGION,

      // AI Services
      CLAUDE_CODE_USE_BEDROCK: props.envConfig?.claudeUseBedrock !== false ? '1' : '0',
      ENABLE_CLAUDE_AGENT: 'true',

      // S3 Configuration
      UPLOADS_BUCKET: props.uploadsBucket.bucketName,

      // NextAuth URLs (will be updated with CloudFront domain)
      NEXTAUTH_URL: props.distributionDomain
        ? `https://${props.distributionDomain}`
        : 'http://localhost:3000',
    };

    // 如果提供了 Agent SDK Role，传递 Role ARN
    if (props.agentSdkRoleArn) {
      environment.AGENT_SDK_ROLE_ARN = props.agentSdkRoleArn;
      console.log('✓ Agent SDK Role ARN configured for container');
    }

    // 添加可选的第三方服务配置
    if (props.envConfig?.llmBaseUrl) {
      environment.LLM_BASE_URL = props.envConfig.llmBaseUrl;
    }
    if (props.envConfig?.llmModelName) {
      environment.LLM_MODEL_NAME = props.envConfig.llmModelName;
    }

    // 构建 secrets 映射（敏感信息）
    const secrets: Record<string, ecs.Secret> = {
      DATABASE_URL: ecs.Secret.fromSecretsManager(props.databaseSecret, 'connectionString'),
      NEXTAUTH_SECRET: ecs.Secret.fromSecretsManager(nextAuthSecret),
    };

    // 从环境变量或 props 添加可选的 API keys
    if (props.envConfig?.anthropicApiKey) {
      // 如果提供了 API key，创建 secret 并使用
      const anthropicSecret = new secretsmanager.Secret(this, 'AnthropicApiKey', {
        secretName: `${props.stackName}/anthropic-api-key`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.anthropicApiKey),
      });
      secrets.ANTHROPIC_API_KEY = ecs.Secret.fromSecretsManager(anthropicSecret);
      console.log('✓ Using provided Anthropic API Key');
    }

    if (props.envConfig?.llmApiKey) {
      const llmSecret = new secretsmanager.Secret(this, 'LlmApiKey', {
        secretName: `${props.stackName}/llm-api-key`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.llmApiKey),
      });
      secrets.LLM_API_KEY = ecs.Secret.fromSecretsManager(llmSecret);
      console.log('✓ Using provided LLM API Key');
    }

    if (props.envConfig?.tavilyApiKey) {
      const tavilySecret = new secretsmanager.Secret(this, 'TavilyApiKey', {
        secretName: `${props.stackName}/tavily-api-key`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.tavilyApiKey),
      });
      secrets.TAVILY_API_KEY = ecs.Secret.fromSecretsManager(tavilySecret);
      console.log('✓ Using provided Tavily API Key');
    }

    if (props.envConfig?.uploadthingToken) {
      const uploadthingSecret = new secretsmanager.Secret(this, 'UploadthingToken', {
        secretName: `${props.stackName}/uploadthing-token`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.uploadthingToken),
      });
      secrets.UPLOADTHING_TOKEN = ecs.Secret.fromSecretsManager(uploadthingSecret);
      console.log('✓ Using provided UploadThing Token');
    }

    if (props.envConfig?.unsplashAccessKey) {
      const unsplashSecret = new secretsmanager.Secret(this, 'UnsplashAccessKey', {
        secretName: `${props.stackName}/unsplash-access-key`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.envConfig.unsplashAccessKey),
      });
      secrets.UNSPLASH_ACCESS_KEY = ecs.Secret.fromSecretsManager(unsplashSecret);
      console.log('✓ Using provided Unsplash Access Key');
    }

    // Cognito 认证配置
    if (props.cognitoConfig) {
      // 创建 Secret 存储 Client Secret
      const cognitoClientSecret = new secretsmanager.Secret(this, 'CognitoClientSecret', {
        secretName: `${props.stackName}/cognito-client-secret`,
        secretStringValue: props.cognitoConfig.clientSecret,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      // 授权 TaskExecutionRole 读取
      cognitoClientSecret.grantRead(taskExecutionRole);

      // 添加到 secrets (敏感信息)
      secrets.COGNITO_CLIENT_SECRET = ecs.Secret.fromSecretsManager(cognitoClientSecret);

      // 添加到环境变量 (非敏感信息)
      environment.COGNITO_CLIENT_ID = props.cognitoConfig.clientId;
      environment.COGNITO_ISSUER = props.cognitoConfig.issuer;

      console.log('✓ Cognito authentication configured');
    }

    // Container
    const container = taskDefinition.addContainer('nextjs', {
      image: ecs.ContainerImage.fromAsset('../../frontend', {
        file: '../infrastructure/docker/Dockerfile.nextjs',
        platform: Platform.LINUX_ARM64,
      }),
      memoryLimitMiB: ECS_CONFIG.memory,
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

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: false, // Internal ALB (accessed via CloudFront)
      securityGroup: props.albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Enable access logs
    this.alb.logAccessLogs(props.logsBucket, 'alb-access-logs');

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
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

    // Fargate Service
    this.service = new ecs.FargateService(this, 'Service', {
      cluster: this.cluster,
      serviceName: `${props.stackName}-service`,
      taskDefinition,
      desiredCount: ECS_CONFIG.desiredCount,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.ecsSecurityGroup],
      enableExecuteCommand: true,
      healthCheckGracePeriod: cdk.Duration.seconds(180),
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // Attach to target group
    this.service.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: ECS_CONFIG.minCapacity,
      maxCapacity: ECS_CONFIG.maxCapacity,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: ECS_CONFIG.targetCpuUtilization,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: ECS_CONFIG.targetMemoryUtilization,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Outputs
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS cluster name',
      exportName: `${props.stackName}-cluster-name`,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.service.serviceName,
      description: 'ECS service name',
      exportName: `${props.stackName}-service-name`,
    });

    new cdk.CfnOutput(this, 'ALBDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS name',
      exportName: `${props.stackName}-alb-dns`,
    });
  }
}
