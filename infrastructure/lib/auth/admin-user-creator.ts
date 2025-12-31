/**
 * Admin User Creator - Custom Resource
 * 自动创建初始管理员用户并配置邮件模板
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface AdminUserCreatorProps {
  /**
   * Cognito User Pool ID
   */
  userPoolId: string;

  /**
   * 管理员邮箱地址
   */
  adminEmail: string;

  /**
   * 应用访问 URL（用于邮件模板）
   */
  applicationUrl: string;
}

export class AdminUserCreator extends Construct {
  constructor(scope: Construct, id: string, props: AdminUserCreatorProps) {
    super(scope, id);

    // =========================================================================
    // Step 1: 更新邮件模板
    // =========================================================================

    const emailTemplate = this.createEmailTemplate(props.applicationUrl);

    const updateEmailTemplate = new cr.AwsCustomResource(this, 'UpdateEmailTemplate', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'updateUserPool',
        parameters: {
          UserPoolId: props.userPoolId,
          AdminCreateUserConfig: {
            InviteMessageTemplate: {
              EmailSubject: 'Welcome to Slide-Forge - Your Admin Account',
              EmailMessage: emailTemplate,
            },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of(`EmailTemplate-${props.userPoolId}`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cognito-idp:UpdateUserPool'],
          resources: ['*'], // Cognito 不支持资源级别权限
        }),
      ]),
      logRetention: 7, // CloudWatch Logs 保留 7 天
    });

    // =========================================================================
    // Step 2: 创建管理员用户
    // =========================================================================

    const createAdminUser = new cr.AwsCustomResource(this, 'CreateAdminUser', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminCreateUser',
        parameters: {
          UserPoolId: props.userPoolId,
          Username: props.adminEmail,
          UserAttributes: [
            {
              Name: 'email',
              Value: props.adminEmail,
            },
            {
              Name: 'email_verified',
              Value: 'true',
            },
          ],
          DesiredDeliveryMediums: ['EMAIL'], // 通过邮件发送临时密码
          MessageAction: 'SUPPRESS', // 使用自定义邮件模板
        },
        physicalResourceId: cr.PhysicalResourceId.of(`AdminUser-${props.adminEmail}`),
        // 忽略用户已存在错误（避免重复创建）
        ignoreErrorCodesMatching: 'UsernameExistsException',
      },
      // 重要：不定义 onDelete，避免删除管理员用户
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'cognito-idp:AdminCreateUser',
            'cognito-idp:AdminSetUserPassword', // 可能需要重置密码
          ],
          resources: ['*'],
        }),
      ]),
      logRetention: 7,
    });

    // 确保邮件模板先更新，再创建用户
    createAdminUser.node.addDependency(updateEmailTemplate);

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'AdminEmail', {
      value: props.adminEmail,
      description: 'Initial admin user email',
    });
  }

  /**
   * 创建邮件模板（HTML 格式）
   */
  private createEmailTemplate(applicationUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border: 1px solid #e0e0e0;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .credentials {
      background: white;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 20px 0;
    }
    .credentials p {
      margin: 8px 0;
    }
    .credentials strong {
      color: #667eea;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #666;
      font-size: 14px;
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎨 Welcome to Slide-Forge</h1>
    <p>Your administrator account has been created</p>
  </div>

  <div class="content">
    <h2>Hello!</h2>

    <p>You have been granted administrator access to Slide-Forge, an AI-powered presentation creation platform.</p>

    <div class="credentials">
      <p><strong>Username:</strong> {username}</p>
      <p><strong>Temporary Password:</strong> {####}</p>
    </div>

    <div class="warning">
      <strong>⚠️ Important:</strong> This is a temporary password. You will be required to change it upon first login for security reasons.
    </div>

    <p>Click the button below to access the application:</p>

    <a href="${applicationUrl}" class="button">Go to Slide-Forge</a>

    <h3>First Login Steps:</h3>
    <ol>
      <li>Visit the application URL above</li>
      <li>Click "Sign In"</li>
      <li>Enter your email and temporary password</li>
      <li>Create a new permanent password</li>
      <li>Start creating amazing presentations!</li>
    </ol>

    <h3>As an Administrator:</h3>
    <ul>
      <li>Access all presentation features</li>
      <li>Use Claude Agent for intelligent slide generation</li>
      <li>Invite new users from AWS Cognito Console</li>
      <li>Manage user permissions</li>
    </ul>

    <div class="footer">
      <p>If you did not request this account, please ignore this email.</p>
      <p>© 2025 Slide-Forge. Powered by AWS and Claude AI.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
