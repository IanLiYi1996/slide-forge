import * as cdk from 'aws-cdk-lib';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { VpcConstruct } from './network/vpc';
import { S3BucketsConstruct } from './storage/s3-buckets';
import { StaticAssetsDeployment } from './storage/static-assets-deployment';
import { AgentCoreConstruct } from './compute/agentcore-construct';
import { FargateNextjsServiceConstruct } from './compute/fargate-nextjs-service';
import { CloudFrontConstruct } from './cdn/cloudfront';
import { CognitoConstruct } from './auth/cognito';
import { AdminUserCreator } from './auth/admin-user-creator';
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

    // 3. Create Cognito User Pool (before compute resources)
    const cognitoConstruct = new CognitoConstruct(this, 'Auth', {
      stackName,
      adminEmail: envConfig.cognito.adminEmail,
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

    // Configure ALB idle timeout for long-running SSE connections (Agent chat streams)
    alb.setAttribute('idle_timeout.timeout_seconds', '300');

    // Enable ALB access logs
    alb.logAccessLogs(s3Construct.logsBucket, 'alb-access-logs');

    // 7. Create CloudFront Distribution (using ALB)
    const cloudfrontConstruct = new CloudFrontConstruct(this, 'CDN', {
      alb: alb,
      staticBucket: s3Construct.staticBucket,
      logsBucket: s3Construct.logsBucket,
      stackName,
    });

    // 4. Create AgentCore Backend (for AI agent processing)
    // AgentCore runs the Strands-based agent in Bedrock AgentCore Runtime
    // Note: Runtime name must match pattern [a-zA-Z][a-zA-Z0-9_]{0,47}
    // Set SKIP_AGENTCORE_RUNTIME=true to deploy infrastructure first without runtime
    const skipRuntimeCreation = process.env.SKIP_AGENTCORE_RUNTIME === 'true';
    const runtimeName = stackName.replace(/-/g, '_').slice(0, 40) + '_agent';
    const agentCoreConstruct = new AgentCoreConstruct(this, 'AgentCore', {
      stackName,
      runtimeName,
      skipRuntimeCreation,
      workspaceBucket: s3Construct.uploadsBucket,
      cognitoUserPoolId: cognitoConstruct.userPool.userPoolId,
      cognitoClientId: cognitoConstruct.oidc.clientId,
      networkMode: 'PUBLIC',
      environmentVariables: {
        // AI Configuration
        CLAUDE_CODE_USE_BEDROCK: envConfig.claudeConfig.useBedrock ? '1' : '0',
        // Optional third-party API keys (if configured)
        ...(envConfig.thirdParty.tavilyApiKey && { TAVILY_API_KEY: envConfig.thirdParty.tavilyApiKey }),
        ...(envConfig.thirdParty.unsplashAccessKey && { UNSPLASH_ACCESS_KEY: envConfig.thirdParty.unsplashAccessKey }),
      },
    });

    // 5. Create Fargate Frontend Service (stateless Next.js frontend)
    // The frontend calls AgentCore for agent operations via AGENTCORE_RUNTIME_URL
    const fargateConstruct = new FargateNextjsServiceConstruct(this, 'Compute', {
      vpc: vpcConstruct.vpc,
      alb: alb,
      albSecurityGroup: vpcConstruct.albSecurityGroup,
      ecsSecurityGroup: vpcConstruct.ecsSecurityGroup,
      uploadsBucket: s3Construct.uploadsBucket,
      logsBucket: s3Construct.logsBucket,
      kmsKey: s3Construct.kmsKey,
      stackName,
      distributionDomain: cloudfrontConstruct.distribution.distributionDomainName,
      // Pass AgentCore Runtime URL for backend API calls
      agentCoreRuntimeUrl: agentCoreConstruct.runtimeUrl,
      // Environment configuration for frontend
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
      // Cognito authentication configuration
      cognitoConfig: {
        clientId: cognitoConstruct.oidc.clientId,
        clientSecret: cognitoConstruct.oidc.clientSecret,
        issuer: cognitoConstruct.oidc.issuer,
      },
    });

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

    // 11. Auto-deploy static assets to S3 (requires frontend to be built first)
    new StaticAssetsDeployment(this, 'StaticAssets', {
      staticBucket: s3Construct.staticBucket,
      distribution: cloudfrontConstruct.distribution,
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

    // AgentCore Outputs (main outputs are in the construct, add summary here)
    new cdk.CfnOutput(this, 'AgentCoreRuntimeUrl', {
      value: agentCoreConstruct.runtimeUrl,
      description: 'AgentCore Runtime URL for backend API',
    });

    new cdk.CfnOutput(this, 'AgentCoreECRRepository', {
      value: agentCoreConstruct.ecrRepository.repositoryUri,
      description: 'ECR Repository for AgentCore container images',
    });

    new cdk.CfnOutput(this, 'DeploymentInstructions', {
      value: [
        '',
        '========================================',
        'Slide-Forge Deployment Successful!',
        '========================================',
        '',
        'Next Steps:',
        '',
        '1. Build and push the AgentCore container:',
        `   cd agentcore && docker build -t ${agentCoreConstruct.ecrRepository.repositoryUri}:latest .`,
        `   aws ecr get-login-password | docker login --username AWS --password-stdin ${agentCoreConstruct.ecrRepository.repositoryUri}`,
        `   docker push ${agentCoreConstruct.ecrRepository.repositoryUri}:latest`,
        '',
        '2. Create optional secrets in AWS Secrets Manager (if not already configured):',
        `   aws secretsmanager create-secret --name ${stackName}/tavily-api-key --secret-string "tvly-..."`,
        `   aws secretsmanager create-secret --name ${stackName}/uploadthing-token --secret-string "sk_live_..."`,
        '',
        '3. Build and upload static assets:',
        '   cd frontend && pnpm build',
        `   aws s3 sync .next/static s3://${s3Construct.staticBucket.bucketName}/_next/static`,
        `   aws s3 sync public s3://${s3Construct.staticBucket.bucketName}/public`,
        '',
        '4. Invalidate CloudFront cache:',
        `   aws cloudfront create-invalidation --distribution-id ${cloudfrontConstruct.distribution.distributionId} --paths "/*"`,
        '',
        '5. Access your application:',
        `   https://${cloudfrontConstruct.distribution.distributionDomainName}`,
        '',
        'Architecture:',
        '- Frontend: Fargate (stateless Next.js)',
        '- Backend: Bedrock AgentCore Runtime (Strands-based agent)',
        '- Storage: S3 (no database required)',
        '',
        '========================================',
      ].join('\n'),
      description: 'Post-deployment instructions',
    });
  }
}
