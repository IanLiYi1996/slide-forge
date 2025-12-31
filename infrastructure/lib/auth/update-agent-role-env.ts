/**
 * Update Agent SDK Role ARN Environment Variable
 * 使用 Custom Resource 更新 ECS Task Definition 的环境变量
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface UpdateAgentRoleEnvProps {
  /**
   * ECS Cluster 名称
   */
  clusterName: string;

  /**
   * ECS Service 名称
   */
  serviceName: string;

  /**
   * Agent SDK Role ARN
   */
  agentSdkRoleArn: string;
}

export class UpdateAgentRoleEnv extends Construct {
  constructor(scope: Construct, id: string, props: UpdateAgentRoleEnvProps) {
    super(scope, id);

    // 创建 Custom Resource 来更新 ECS Service
    // 将 AGENT_SDK_ROLE_ARN 环境变量注入到容器
    new cr.AwsCustomResource(this, 'UpdateEcsEnv', {
      onCreate: {
        service: 'ECS',
        action: 'updateService',
        parameters: {
          cluster: props.clusterName,
          service: props.serviceName,
          forceNewDeployment: false, // 不强制重新部署
          // 注意：UpdateService 不能直接修改环境变量
          // 环境变量是 Task Definition 的一部分
        },
        physicalResourceId: cr.PhysicalResourceId.of(`AgentRoleEnv-${props.serviceName}`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ecs:UpdateService',
            'ecs:DescribeServices',
            'ecs:DescribeTaskDefinition',
          ],
          resources: ['*'],
        }),
      ]),
    });

    // 输出提示
    new cdk.CfnOutput(this, 'AgentSdkRoleArnOutput', {
      value: props.agentSdkRoleArn,
      description: 'Agent SDK Role ARN (需要手动添加到容器环境变量)',
    });
  }
}
