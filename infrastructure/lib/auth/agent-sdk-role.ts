/**
 * Claude Agent SDK IAM Role
 * 创建专门用于 Claude Agent SDK 的 IAM Role，包含所需的 AWS 服务权限
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface AgentSdkRoleProps {
  /**
   * Stack 名称，用于命名
   */
  stackName: string;

  /**
   * S3 Bucket（用于 Agent 读写文件）
   */
  uploadsBucket: s3.IBucket;
}

export class AgentSdkRole extends Construct {
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: AgentSdkRoleProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;

    // =========================================================================
    // 创建 Claude Agent SDK 专用 IAM Role
    // =========================================================================

    this.role = new iam.Role(this, 'AgentSdkRole', {
      roleName: `${props.stackName}-agent-sdk-role`,
      description: 'IAM Role for Claude Agent SDK to access AWS services',

      // 信任策略：允许 ECS Task 代入此角色
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // =========================================================================
    // 1. Bedrock 权限 - 调用 Claude 模型
    // =========================================================================

    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'BedrockModelAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:ListFoundationModels', // 列出可用模型
          'bedrock:GetFoundationModel', // 获取模型信息
        ],
        resources: [
          // Claude 3 系列模型
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // =========================================================================
    // 2. S3 权限 - Agent 文件操作
    // =========================================================================

    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'S3BucketAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          // 读取权限
          's3:GetObject',
          's3:GetObjectVersion',
          's3:ListBucket',
          's3:ListBucketVersions',
          // 写入权限
          's3:PutObject',
          's3:PutObjectAcl',
          's3:DeleteObject',
          // 生成预签名 URL
          's3:GetObjectAcl',
        ],
        resources: [
          props.uploadsBucket.bucketArn,
          `${props.uploadsBucket.bucketArn}/*`,
          // 允许访问特定前缀（Agent 工作目录）
          `${props.uploadsBucket.bucketArn}/agent-workspace/*`,
        ],
      })
    );

    // =========================================================================
    // 3. DynamoDB 权限 - Agent 状态管理
    // =========================================================================

    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'DynamoDBAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          // 基础操作
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          // Batch 操作
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
          // 描述表
          'dynamodb:DescribeTable',
        ],
        resources: [
          // 允许访问特定前缀的表
          `arn:aws:dynamodb:${region}:${accountId}:table/${props.stackName}-agent-*`,
          `arn:aws:dynamodb:${region}:${accountId}:table/${props.stackName}-session-*`,
          // 包括索引
          `arn:aws:dynamodb:${region}:${accountId}:table/${props.stackName}-agent-*/index/*`,
          `arn:aws:dynamodb:${region}:${accountId}:table/${props.stackName}-session-*/index/*`,
        ],
      })
    );

    // =========================================================================
    // 4. CloudWatch Logs 权限 - Agent 日志记录
    // =========================================================================

    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogsAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams',
        ],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/agent-sdk/${props.stackName}:*`,
        ],
      })
    );

    // =========================================================================
    // 5. SSM Parameter Store 权限 - 配置管理（可选）
    // =========================================================================

    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SSMParameterAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:GetParameter',
          'ssm:GetParameters',
          'ssm:GetParametersByPath',
        ],
        resources: [
          `arn:aws:ssm:${region}:${accountId}:parameter/${props.stackName}/agent/*`,
        ],
      })
    );

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'AgentSdkRoleArn', {
      value: this.role.roleArn,
      description: 'IAM Role ARN for Claude Agent SDK',
      exportName: `${props.stackName}-agent-sdk-role-arn`,
    });

    new cdk.CfnOutput(this, 'AgentSdkRoleName', {
      value: this.role.roleName,
      description: 'IAM Role Name for Claude Agent SDK',
      exportName: `${props.stackName}-agent-sdk-role-name`,
    });
  }
}
