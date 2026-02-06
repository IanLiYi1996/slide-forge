/**
 * AgentCore Construct
 * Deploys a container to AWS Bedrock AgentCore Runtime
 *
 * This construct creates:
 * - ECR repository for the agent container
 * - IAM role with AgentCore trust policy
 * - Custom Resource to manage AgentCore Runtime via bedrock-agentcore-control APIs
 */

import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface AgentCoreConstructProps {
  /**
   * Stack name for resource naming
   */
  stackName: string;

  /**
   * Name for the AgentCore runtime
   */
  runtimeName: string;

  /**
   * S3 bucket for workspace storage
   */
  workspaceBucket: s3.IBucket;

  /**
   * Cognito User Pool ID for JWT authentication
   */
  cognitoUserPoolId: string;

  /**
   * Cognito Client ID for JWT authentication
   */
  cognitoClientId: string;

  /**
   * Docker image URI (if not using ECR from this construct)
   * If not provided, an ECR repository will be created
   */
  dockerImageUri?: string;

  /**
   * Environment variables to pass to the AgentCore runtime
   */
  environmentVariables?: Record<string, string>;

  /**
   * Network mode: PUBLIC or PRIVATE
   * @default PUBLIC
   */
  networkMode?: 'PUBLIC' | 'PRIVATE';

  /**
   * Skip runtime creation (for initial deployment when image doesn't exist yet)
   * @default false
   */
  skipRuntimeCreation?: boolean;
}

export class AgentCoreConstruct extends Construct {
  public readonly ecrRepository: ecr.Repository;
  public readonly runtimeRole: iam.Role;
  public readonly runtimeArn: string;
  public readonly runtimeUrl: string;

  constructor(scope: Construct, id: string, props: AgentCoreConstructProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;

    // =========================================================================
    // 1. ECR Repository for Agent Container
    // =========================================================================

    this.ecrRepository = new ecr.Repository(this, 'AgentCoreRepo', {
      repositoryName: `${props.stackName}-agentcore`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
        },
      ],
    });

    // =========================================================================
    // 2. IAM Execution Role for AgentCore Runtime
    // =========================================================================

    this.runtimeRole = new iam.Role(this, 'RuntimeRole', {
      roleName: `${props.stackName}-agentcore-runtime-role`,
      description: 'Execution role for Bedrock AgentCore Runtime',

      // Trust policy for AgentCore service
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': accountId,
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:bedrock-agentcore:${region}:${accountId}:*`,
          },
        },
      }),
    });

    // --- ECR Image Access ---
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ECRImageAccess',
        effect: iam.Effect.ALLOW,
        actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
        resources: [
          this.ecrRepository.repositoryArn,
          // Also allow any repository in the account (for flexibility)
          `arn:aws:ecr:${region}:${accountId}:repository/*`,
        ],
      })
    );

    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ECRTokenAccess',
        effect: iam.Effect.ALLOW,
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    // --- CloudWatch Logs ---
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogsDescribe',
        effect: iam.Effect.ALLOW,
        actions: ['logs:DescribeLogStreams', 'logs:CreateLogGroup'],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*`,
        ],
      })
    );

    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogGroupsDescribe',
        effect: iam.Effect.ALLOW,
        actions: ['logs:DescribeLogGroups'],
        resources: [`arn:aws:logs:${region}:${accountId}:log-group:*`],
      })
    );

    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogStream',
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
        ],
      })
    );

    // --- X-Ray Tracing ---
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'XRayTracing',
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'xray:GetSamplingRules',
          'xray:GetSamplingTargets',
        ],
        resources: ['*'],
      })
    );

    // --- CloudWatch Metrics ---
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchMetrics',
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'bedrock-agentcore',
          },
        },
      })
    );

    // --- AgentCore Workload Identity ---
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'GetAgentAccessToken',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agentcore:GetWorkloadAccessToken',
          'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
          'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default/workload-identity/*`,
        ],
      })
    );

    // --- Bedrock Model Invocation ---
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'BedrockModelInvocation',
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          // Foundation models (all regions)
          `arn:aws:bedrock:*::foundation-model/*`,
          // Inference profiles in this account
          `arn:aws:bedrock:${region}:${accountId}:inference-profile/*`,
          // Application inference profiles
          `arn:aws:bedrock:${region}:${accountId}:application-inference-profile/*`,
        ],
      })
    );

    // Global Inference Profile permissions
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'BedrockGetInferenceProfile',
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:GetInferenceProfile', 'bedrock:ListInferenceProfiles'],
        resources: ['*'],
      })
    );

    // --- S3 Workspace Access ---
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'S3WorkspaceAccess',
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [props.workspaceBucket.bucketArn, `${props.workspaceBucket.bucketArn}/*`],
      })
    );

    // --- Secrets Manager Access (optional, for API keys) ---
    this.runtimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SecretsManagerAccess',
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:${region}:${accountId}:secret:${props.stackName}/*`],
      })
    );

    // =========================================================================
    // 3. Custom Resource Lambda for AgentCore Management
    // =========================================================================

    const agentCoreManagerCode = this.createAgentCoreManagerCode();

    const agentCoreManagerFunction = new lambda.Function(this, 'AgentCoreManager', {
      functionName: `${props.stackName}-agentcore-manager`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(agentCoreManagerCode),
      timeout: cdk.Duration.minutes(10),
      memorySize: 256,
      environment: {
        LOG_LEVEL: 'INFO',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant Lambda permissions to manage AgentCore (full access to all AgentCore operations)
    agentCoreManagerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agentcore:*',
          'bedrock-agentcore-control:*',
        ],
        resources: ['*'],
      })
    );

    // Grant Lambda permissions to pass the runtime role
    agentCoreManagerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: [this.runtimeRole.roleArn],
      })
    );

    // =========================================================================
    // 4. Custom Resource Provider
    // =========================================================================

    const provider = new cr.Provider(this, 'AgentCoreProvider', {
      onEventHandler: agentCoreManagerFunction,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Construct discovery URL for Cognito
    const cognitoDiscoveryUrl = `https://cognito-idp.${region}.amazonaws.com/${props.cognitoUserPoolId}/.well-known/openid-configuration`;

    // Build environment variables as a dictionary (JSON string for Lambda)
    const envVarsDict: Record<string, string> = {
      AWS_DEFAULT_REGION: region,
    };
    if (props.environmentVariables) {
      Object.entries(props.environmentVariables).forEach(([key, value]) => {
        if (value) {
          envVarsDict[key] = value;
        }
      });
    }
    envVarsDict['S3_WORKSPACE_BUCKET'] = props.workspaceBucket.bucketName;

    // Determine Docker image URI
    const dockerImageUri = props.dockerImageUri || `${this.ecrRepository.repositoryUri}:latest`;

    // =========================================================================
    // 5. AgentCore Runtime Custom Resource (conditionally created)
    // =========================================================================

    if (props.skipRuntimeCreation) {
      // Skip runtime creation - just set placeholder values
      // User should push image to ECR and deploy again with skipRuntimeCreation=false
      this.runtimeArn = 'PENDING_IMAGE_PUSH';
      this.runtimeUrl = 'PENDING_IMAGE_PUSH';
    } else {
      const agentCoreRuntime = new cdk.CustomResource(this, 'AgentCoreRuntime', {
        serviceToken: provider.serviceToken,
        properties: {
          RuntimeName: props.runtimeName,
          DockerImageUri: dockerImageUri,
          RoleArn: this.runtimeRole.roleArn,
          NetworkMode: props.networkMode || 'PUBLIC',
          EnvironmentVariables: JSON.stringify(envVarsDict),
          CognitoDiscoveryUrl: cognitoDiscoveryUrl,
          CognitoClientId: props.cognitoClientId,
          // Add timestamp to force update when properties change
          Timestamp: Date.now().toString(),
        },
      });

      // Ensure runtime is created after the role
      agentCoreRuntime.node.addDependency(this.runtimeRole);

      // Store runtime outputs
      this.runtimeArn = agentCoreRuntime.getAttString('RuntimeArn');
      this.runtimeUrl = agentCoreRuntime.getAttString('RuntimeUrl');
    }

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'ECRRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI for AgentCore container',
      exportName: `${props.stackName}-agentcore-ecr-uri`,
    });

    new cdk.CfnOutput(this, 'RuntimeRoleArn', {
      value: this.runtimeRole.roleArn,
      description: 'IAM Role ARN for AgentCore Runtime',
      exportName: `${props.stackName}-agentcore-role-arn`,
    });

    new cdk.CfnOutput(this, 'AgentCoreRuntimeArn', {
      value: this.runtimeArn,
      description: 'AgentCore Runtime ARN',
      exportName: `${props.stackName}-agentcore-runtime-arn`,
    });

    new cdk.CfnOutput(this, 'AgentCoreRuntimeUrl', {
      value: this.runtimeUrl,
      description: 'AgentCore Runtime URL',
      exportName: `${props.stackName}-agentcore-runtime-url`,
    });
  }

  /**
   * Creates the Python code for the AgentCore manager Lambda function
   */
  private createAgentCoreManagerCode(): string {
    return `
import json
import logging
import boto3
import urllib.parse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Custom Resource handler for AgentCore Runtime management.

    Handles CREATE, UPDATE, and DELETE operations for AgentCore Runtimes.
    """
    logger.info(f"Received event: {json.dumps(event)}")

    request_type = event['RequestType']
    properties = event['ResourceProperties']

    runtime_name = properties['RuntimeName']
    docker_image_uri = properties['DockerImageUri']
    role_arn = properties['RoleArn']
    network_mode = properties.get('NetworkMode', 'PUBLIC')
    env_vars_str = properties.get('EnvironmentVariables', '{}')
    # Parse environment variables from JSON string to dict
    env_vars = json.loads(env_vars_str) if env_vars_str else {}
    cognito_discovery_url = properties['CognitoDiscoveryUrl']
    cognito_client_id = properties['CognitoClientId']

    client = boto3.client('bedrock-agentcore-control')

    try:
        if request_type == 'Create':
            return create_runtime(
                client, runtime_name, docker_image_uri, role_arn,
                network_mode, env_vars, cognito_discovery_url, cognito_client_id
            )
        elif request_type == 'Update':
            old_properties = event.get('OldResourceProperties', {})
            physical_resource_id = event.get('PhysicalResourceId', '')
            return update_runtime(
                client, physical_resource_id, runtime_name, docker_image_uri, role_arn,
                network_mode, env_vars, cognito_discovery_url, cognito_client_id
            )
        elif request_type == 'Delete':
            physical_resource_id = event.get('PhysicalResourceId', '')
            return delete_runtime(client, physical_resource_id)
        else:
            raise ValueError(f"Unknown request type: {request_type}")

    except Exception as e:
        logger.error(f"Error handling {request_type}: {str(e)}")
        raise


def create_runtime(client, runtime_name, docker_image_uri, role_arn, network_mode, env_vars, cognito_discovery_url, cognito_client_id):
    """Create a new AgentCore Runtime."""
    logger.info(f"Creating AgentCore Runtime: {runtime_name}")

    # Check if runtime already exists
    existing_runtime = find_runtime_by_name(client, runtime_name)
    if existing_runtime:
        logger.info(f"Runtime already exists: {existing_runtime['agentRuntimeId']}")
        return format_response(existing_runtime)

    response = client.create_agent_runtime(
        agentRuntimeName=runtime_name,
        agentRuntimeArtifact={
            'containerConfiguration': {
                'containerUri': docker_image_uri
            }
        },
        networkConfiguration={
            'networkMode': network_mode
        },
        roleArn=role_arn,
        environmentVariables=env_vars,
        authorizerConfiguration={
            'customJWTAuthorizer': {
                'discoveryUrl': cognito_discovery_url,
                'allowedClients': [cognito_client_id]
            }
        }
    )

    logger.info(f"Created runtime: {response}")
    return format_response(response)


def update_runtime(client, physical_resource_id, runtime_name, docker_image_uri, role_arn, network_mode, env_vars, cognito_discovery_url, cognito_client_id):
    """Update an existing AgentCore Runtime."""
    logger.info(f"Updating AgentCore Runtime: {physical_resource_id}")

    # Extract runtime ID from physical resource ID
    runtime_id = physical_resource_id
    if not runtime_id or runtime_id == 'None':
        # If no valid runtime ID, create a new one
        return create_runtime(
            client, runtime_name, docker_image_uri, role_arn,
            network_mode, env_vars, cognito_discovery_url, cognito_client_id
        )

    try:
        response = client.update_agent_runtime(
            agentRuntimeId=runtime_id,
            agentRuntimeArtifact={
                'containerConfiguration': {
                    'containerUri': docker_image_uri
                }
            },
            networkConfiguration={
                'networkMode': network_mode
            },
            roleArn=role_arn,
            environmentVariables=env_vars,
            authorizerConfiguration={
                'customJWTAuthorizer': {
                    'discoveryUrl': cognito_discovery_url,
                    'allowedClients': [cognito_client_id]
                }
            }
        )

        logger.info(f"Updated runtime: {response}")
        return format_response(response)

    except client.exceptions.ResourceNotFoundException:
        logger.warning(f"Runtime not found, creating new: {runtime_name}")
        return create_runtime(
            client, runtime_name, docker_image_uri, role_arn,
            network_mode, env_vars, cognito_discovery_url, cognito_client_id
        )


def delete_runtime(client, physical_resource_id):
    """Delete an AgentCore Runtime."""
    logger.info(f"Deleting AgentCore Runtime: {physical_resource_id}")

    runtime_id = physical_resource_id
    if not runtime_id or runtime_id == 'None':
        logger.warning("No runtime ID to delete")
        return {
            'PhysicalResourceId': physical_resource_id,
            'Data': {}
        }

    try:
        client.delete_agent_runtime(agentRuntimeId=runtime_id)
        logger.info(f"Deleted runtime: {runtime_id}")
    except client.exceptions.ResourceNotFoundException:
        logger.warning(f"Runtime already deleted: {runtime_id}")
    except Exception as e:
        logger.error(f"Error deleting runtime: {str(e)}")
        # Don't fail on delete - CloudFormation rollback should succeed

    return {
        'PhysicalResourceId': physical_resource_id,
        'Data': {}
    }


def find_runtime_by_name(client, runtime_name):
    """Find an existing runtime by name."""
    try:
        response = client.list_agent_runtimes()
        for runtime in response.get('agentRuntimes', []):
            if runtime.get('agentRuntimeName') == runtime_name:
                return runtime
    except Exception as e:
        logger.error(f"Error listing runtimes: {str(e)}")
    return None


def format_response(response):
    """Format the response for CloudFormation."""
    runtime_id = response.get('agentRuntimeId', '')
    runtime_arn = response.get('agentRuntimeArn', '')

    # Construct runtime URL
    # URL format: https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}
    region = boto3.session.Session().region_name
    encoded_arn = urllib.parse.quote(runtime_arn, safe='')
    runtime_url = f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}"

    return {
        'PhysicalResourceId': runtime_id,
        'Data': {
            'RuntimeId': runtime_id,
            'RuntimeArn': runtime_arn,
            'RuntimeUrl': runtime_url,
            'Status': response.get('status', 'UNKNOWN'),
            'WorkloadIdentityArn': response.get('workloadIdentityDetails', {}).get('workloadIdentityArn', 'N/A')
        }
    }
`.trim();
  }
}
