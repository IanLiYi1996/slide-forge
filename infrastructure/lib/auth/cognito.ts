/**
 * Cognito User Pool Construct
 * 创建用于应用身份认证的 Cognito User Pool 和 Client
 */

import * as cdk from 'aws-cdk-lib';
import {
  UserPool,
  UserPoolClient,
  OAuthScope,
  AdvancedSecurityMode,
  AccountRecovery,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface CognitoConstructProps {
  /**
   * Stack 名称，用于命名资源
   */
  stackName: string;

  /**
   * 初始管理员邮箱地址
   */
  adminEmail: string;

  /**
   * 应用 URL（用于 OAuth 回调）
   */
  applicationUrl: string;
}

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: cdk.SecretValue;
}

export class CognitoConstruct extends Construct {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly userPoolDomain: string;
  public readonly oidc: OIDCConfig;

  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;

    // =========================================================================
    // User Pool - 用户池配置
    // =========================================================================

    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: `${props.stackName}-user-pool`,

      // 仅邀请注册 - 禁止自助注册
      selfSignUpEnabled: false,

      // 使用邮箱登录
      signInAliases: {
        email: true,
        username: false,
      },

      // 自动验证邮箱
      autoVerify: {
        email: true,
      },

      // 密码策略 - 强安全性
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7), // 临时密码有效期
      },

      // 账户恢复 - 仅通过邮件
      accountRecovery: AccountRecovery.EMAIL_ONLY,

      // 高级安全模式 - 启用威胁防护
      advancedSecurityMode: AdvancedSecurityMode.ENFORCED,

      // 标准邮件配置
      email: undefined, // 使用 Cognito 默认邮件服务（免费层 50 封/天）

      // 删除策略 - 开发环境可删除
      removalPolicy: cdk.RemovalPolicy.DESTROY,

      // 用户属性配置
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
    });

    // =========================================================================
    // User Pool Client - 应用客户端配置
    // =========================================================================

    this.userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${props.stackName}-client`,

      // NextAuth 需要 Client Secret
      generateSecret: true,

      // 防止用户枚举攻击
      preventUserExistenceErrors: true,

      // Token 有效期
      accessTokenValidity: cdk.Duration.days(1),
      idTokenValidity: cdk.Duration.days(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // 认证流程
      authFlows: {
        userPassword: true, // 用户名密码认证
        userSrp: true, // SRP (Secure Remote Password)
        adminUserPassword: true, // 管理员创建用户
      },

      // OAuth 2.0 配置
      oAuth: {
        flows: {
          authorizationCodeGrant: true, // NextAuth 使用授权码流程
          implicitCodeGrant: false, // 不使用隐式流程（不安全）
        },
        scopes: [
          OAuthScope.OPENID,
          OAuthScope.EMAIL,
          OAuthScope.PROFILE,
        ],
        callbackUrls: [
          // 生产环境回调
          `${props.applicationUrl}/api/auth/callback/cognito`,
          // 本地开发回调
          'http://localhost:3000/api/auth/callback/cognito',
          'http://localhost:8080/api/auth/callback/cognito',
        ],
        logoutUrls: [
          props.applicationUrl,
          'http://localhost:3000',
          'http://localhost:8080',
        ],
      },
    });

    // =========================================================================
    // Cognito 托管域名
    // =========================================================================

    // 从 Stack ID 生成唯一的短 ID
    const stackId = cdk.Fn.select(2, cdk.Fn.split('/', cdk.Stack.of(this).stackId));
    const domainPrefix = `slide-forge-${stackId}`.toLowerCase();

    const domain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: domainPrefix,
      },
    });

    // 完整域名: {prefix}.auth.{region}.amazoncognito.com
    this.userPoolDomain = `${domainPrefix}.auth.${region}.amazoncognito.com`;

    // =========================================================================
    // OIDC 配置 - 供 NextAuth 使用
    // =========================================================================

    this.oidc = {
      issuer: `https://cognito-idp.${region}.amazonaws.com/${this.userPool.userPoolId}`,
      clientId: this.userPoolClient.userPoolClientId,
      clientSecret: this.userPoolClient.userPoolClientSecret,
    };

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${props.stackName}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${props.stackName}-user-pool-arn`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: this.userPoolDomain,
      description: 'Cognito Hosted UI Domain',
      exportName: `${props.stackName}-user-pool-domain`,
    });
  }
}
