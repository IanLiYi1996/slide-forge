import * as cdk from 'aws-cdk-lib';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { VpcConstruct } from './network/vpc';
import { AuroraServerlessConstruct } from './storage/aurora-serverless';
import { AuroraSecretConnectionStringUpdater } from './storage/aurora-secret-connection-string';
import { S3BucketsConstruct } from './storage/s3-buckets';
import { EcsNextjsServiceConstruct } from './compute/ecs-nextjs-service';
import { CloudFrontConstruct } from './cdn/cloudfront';
import { CognitoConstruct } from './auth/cognito';
import { AdminUserCreator } from './auth/admin-user-creator';
import { AgentSdkRole } from './auth/agent-sdk-role';
import { getEnvConfig, validateEnvConfig, printEnvStatus } from '../config/env-config';

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

    // 从环境变量加载配置
    const envConfig = getEnvConfig();
    const validation = validateEnvConfig(envConfig);

    if (!validation.valid) {
      console.error('❌ 环境变量验证失败:');
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      throw new Error('环境变量配置不完整，请检查 .env 文件或环境变量');
    }

    printEnvStatus(envConfig);

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

    // 3b. Add connectionString field to Aurora secret (for Prisma compatibility)
    new AuroraSecretConnectionStringUpdater(this, 'AuroraSecretUpdater', {
      secret: auroraConstruct.secret,
    });

    // 4. Create Cognito User Pool (在 ECS 之前，不需要 CloudFront URL)
    const cognitoConstruct = new CognitoConstruct(this, 'Auth', {
      stackName,
      adminEmail: envConfig.cognito.adminEmail,
    });

    // 5. Create Claude Agent SDK IAM Role (在 ECS 之前)
    const agentSdkRole = new AgentSdkRole(this, 'AgentSdkRole', {
      stackName,
      uploadsBucket: s3Construct.uploadsBucket,
    });

    // 6. Create Application Load Balancer (before CloudFront)
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: vpcConstruct.vpc,
      internetFacing: false, // Private ALB accessed via CloudFront VPC Origin
      securityGroup: vpcConstruct.albSecurityGroup,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Enable ALB access logs
    alb.logAccessLogs(s3Construct.logsBucket, 'alb-access-logs');

    // 7. Create CloudFront Distribution (using ALB)
    const cloudfrontConstruct = new CloudFrontConstruct(this, 'CDN', {
      alb: alb,
      staticBucket: s3Construct.staticBucket,
      logsBucket: s3Construct.logsBucket,
      stackName,
    });

    // 8. Create ECS Service (after CloudFront, with distribution domain)
    const ecsConstruct = new EcsNextjsServiceConstruct(this, 'Compute', {
      vpc: vpcConstruct.vpc,
      alb: alb, // Pass existing ALB
      albSecurityGroup: vpcConstruct.albSecurityGroup,
      ecsSecurityGroup: vpcConstruct.ecsSecurityGroup,
      uploadsBucket: s3Construct.uploadsBucket,
      logsBucket: s3Construct.logsBucket,
      kmsKey: s3Construct.kmsKey,
      databaseSecret: auroraConstruct.secret,
      stackName,
      distributionDomain: cloudfrontConstruct.distribution.distributionDomainName, // ✅
      // 传递环境变量配置
      envConfig: {
        claudeUseBedrock: envConfig.claudeConfig.useBedrock,
        anthropicApiKey: envConfig.claudeConfig.anthropicApiKey,
        llmApiKey: envConfig.thirdParty.llmApiKey,
        llmBaseUrl: envConfig.thirdParty.llmBaseUrl,
        llmModelName: envConfig.thirdParty.llmModelName,
        tavilyApiKey: envConfig.thirdParty.tavilyApiKey,
        uploadthingToken: envConfig.thirdParty.uploadthingToken,
        unsplashAccessKey: envConfig.thirdParty.unsplashAccessKey,
      },
      // 传递 Cognito 配置
      cognitoConfig: {
        clientId: cognitoConstruct.oidc.clientId,
        clientSecret: cognitoConstruct.oidc.clientSecret,
        issuer: cognitoConstruct.oidc.issuer,
      },
      // 传递 Agent SDK Role ARN
      agentSdkRoleArn: agentSdkRole.role.roleArn,
    });

    // 授权 ECS Task Role 可以代入 Agent SDK Role
    ecsConstruct.taskRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: 'AssumeAgentSdkRole',
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [agentSdkRole.role.roleArn],
      })
    );

    // 9. 动态更新 Cognito Callback URLs（使用 CloudFront URL）
    const applicationUrl = `https://${cloudfrontConstruct.distribution.distributionDomainName}`;

    // 获取底层的 CfnUserPoolClient 并添加 CloudFront callback URLs
    const cfnUserPoolClient = cognitoConstruct.userPoolClient.node
      .defaultChild as cdk.aws_cognito.CfnUserPoolClient;

    cfnUserPoolClient.addPropertyOverride('CallbackURLs', [
      'http://localhost:3000/api/auth/callback/cognito',
      'http://localhost:8080/api/auth/callback/cognito',
      `${applicationUrl}/api/auth/callback/cognito`, // CloudFront URL
    ]);

    cfnUserPoolClient.addPropertyOverride('LogoutURLs', [
      'http://localhost:3000',
      'http://localhost:8080',
      applicationUrl, // CloudFront URL
    ]);

    // 10. Create Admin User (after CloudFront, with correct URL in email)
    new AdminUserCreator(this, 'AdminUserCreator', {
      userPoolId: cognitoConstruct.userPool.userPoolId,
      adminEmail: envConfig.cognito.adminEmail,
      applicationUrl: applicationUrl,
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

    // Cognito Outputs
    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: cognitoConstruct.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${stackName}-cognito-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: cognitoConstruct.oidc.clientId,
      description: 'Cognito App Client ID',
      exportName: `${stackName}-cognito-client-id`,
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: cognitoConstruct.userPoolDomain,
      description: 'Cognito Hosted UI Domain',
      exportName: `${stackName}-cognito-domain`,
    });

    new cdk.CfnOutput(this, 'CognitoIssuer', {
      value: cognitoConstruct.oidc.issuer,
      description: 'Cognito OIDC Issuer URL',
      exportName: `${stackName}-cognito-issuer`,
    });

    // Agent SDK Role Outputs are already defined in AgentSdkRole construct
    // Removed duplicate outputs to avoid CloudFormation export name conflicts

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
