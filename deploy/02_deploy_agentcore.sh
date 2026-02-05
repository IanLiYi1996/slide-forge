#!/bin/bash
# =============================================================================
# Slide Forge - Deploy to Bedrock AgentCore
# =============================================================================
# Step 2: Deploy the container to Bedrock AgentCore Runtime
#
# Features:
# - Reuses existing Cognito User Pool from slide-forge CDK stack
# - Creates IAM role with AgentCore trust policy
# - Configures JWT authorizer for authentication
#
# Prerequisites:
# - AWS CLI configured with appropriate permissions
# - Step 1 completed (01_build_and_push.sh)
# - config.env file with required values
# - Existing slide-forge CDK stack deployed
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.env"

# Load build output from step 1
if [ -f "${SCRIPT_DIR}/.build_output" ]; then
    source "${SCRIPT_DIR}/.build_output"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}Step 2: Deploy AgentCore Runtime${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""

# =============================================================================
# Validate Prerequisites
# =============================================================================

# Auto-detect AWS region
if [ -z "$AWS_REGION" ]; then
    AWS_REGION=$(aws configure get region)
    AWS_REGION=${AWS_REGION:-us-west-2}
fi

# Auto-detect AWS Account ID
if [ -z "$AWS_ACCOUNT_ID" ]; then
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}Detected AWS_ACCOUNT_ID: ${AWS_ACCOUNT_ID}${NC}"
fi

# Check for Docker image URI
if [ -z "$DOCKER_IMAGE_URI" ]; then
    echo -e "${RED}Error: Docker image URI not found. Please run step 1 first.${NC}"
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  Region: ${AWS_REGION}"
echo "  Account ID: ${AWS_ACCOUNT_ID}"
echo "  Docker Image: ${DOCKER_IMAGE_URI}"
echo "  CDK Stack Name: ${SLIDE_FORGE_STACK_NAME:-slide-forge}"
echo ""

# =============================================================================
# Lookup or Validate S3 Workspace Bucket
# =============================================================================
echo -e "${YELLOW}Checking S3 workspace bucket...${NC}"

if [ -z "$S3_WORKSPACE_BUCKET" ]; then
    # Try to lookup from CloudFormation exports
    STACK_NAME="${SLIDE_FORGE_STACK_NAME:-slide-forge}"
    echo -e "${YELLOW}Looking up S3 bucket from CloudFormation stack: ${STACK_NAME}...${NC}"

    S3_WORKSPACE_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${AWS_REGION}" \
        --query "Stacks[0].Outputs[?contains(OutputKey, 'UploadsBucket')].OutputValue | [0]" \
        --output text 2>/dev/null || echo "")

    if [ -z "$S3_WORKSPACE_BUCKET" ] || [ "$S3_WORKSPACE_BUCKET" == "None" ]; then
        echo -e "${RED}Error: Could not find S3 workspace bucket.${NC}"
        echo "Please set S3_WORKSPACE_BUCKET in config.env"
        exit 1
    fi
fi

if aws s3 ls "s3://${S3_WORKSPACE_BUCKET}" &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} S3 bucket exists: ${S3_WORKSPACE_BUCKET}"
else
    echo -e "${RED}Error: S3 bucket does not exist: ${S3_WORKSPACE_BUCKET}${NC}"
    exit 1
fi

# =============================================================================
# Lookup Existing Cognito Configuration from CDK Stack
# =============================================================================
echo ""
echo -e "${YELLOW}Checking Cognito configuration...${NC}"

STACK_NAME="${SLIDE_FORGE_STACK_NAME:-slide-forge}"

# Function to lookup CloudFormation export
lookup_cfn_export() {
    local export_name="$1"
    aws cloudformation list-exports \
        --region "${AWS_REGION}" \
        --query "Exports[?Name=='${export_name}'].Value | [0]" \
        --output text 2>/dev/null || echo ""
}

# Lookup Cognito User Pool ID if not provided
if [ -z "$COGNITO_USER_POOL_ID" ]; then
    echo -e "${YELLOW}Looking up Cognito User Pool ID from CDK stack...${NC}"

    # Try CloudFormation export first
    COGNITO_USER_POOL_ID=$(lookup_cfn_export "${STACK_NAME}-cognito-user-pool-id")

    # Fallback: try alternative export name
    if [ -z "$COGNITO_USER_POOL_ID" ] || [ "$COGNITO_USER_POOL_ID" == "None" ]; then
        COGNITO_USER_POOL_ID=$(lookup_cfn_export "${STACK_NAME}-user-pool-id")
    fi

    # Fallback: try stack outputs directly
    if [ -z "$COGNITO_USER_POOL_ID" ] || [ "$COGNITO_USER_POOL_ID" == "None" ]; then
        COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
            --stack-name "${STACK_NAME}" \
            --region "${AWS_REGION}" \
            --query "Stacks[0].Outputs[?contains(OutputKey, 'UserPoolId') || contains(OutputKey, 'CognitoUserPoolId')].OutputValue | [0]" \
            --output text 2>/dev/null || echo "")
    fi

    if [ -z "$COGNITO_USER_POOL_ID" ] || [ "$COGNITO_USER_POOL_ID" == "None" ]; then
        echo -e "${RED}Error: Could not find Cognito User Pool ID.${NC}"
        echo "Please set COGNITO_USER_POOL_ID in config.env"
        exit 1
    fi
fi

# Lookup Cognito Client ID if not provided
if [ -z "$COGNITO_CLIENT_ID" ]; then
    echo -e "${YELLOW}Looking up Cognito Client ID from CDK stack...${NC}"

    # Try CloudFormation export first
    COGNITO_CLIENT_ID=$(lookup_cfn_export "${STACK_NAME}-cognito-client-id")

    # Fallback: try stack outputs directly
    if [ -z "$COGNITO_CLIENT_ID" ] || [ "$COGNITO_CLIENT_ID" == "None" ]; then
        COGNITO_CLIENT_ID=$(aws cloudformation describe-stacks \
            --stack-name "${STACK_NAME}" \
            --region "${AWS_REGION}" \
            --query "Stacks[0].Outputs[?contains(OutputKey, 'ClientId') || contains(OutputKey, 'CognitoClientId')].OutputValue | [0]" \
            --output text 2>/dev/null || echo "")
    fi

    if [ -z "$COGNITO_CLIENT_ID" ] || [ "$COGNITO_CLIENT_ID" == "None" ]; then
        echo -e "${RED}Error: Could not find Cognito Client ID.${NC}"
        echo "Please set COGNITO_CLIENT_ID in config.env"
        exit 1
    fi
fi

# Set Cognito region (usually same as AWS_REGION)
COGNITO_REGION="${COGNITO_REGION:-${AWS_REGION}}"

# Construct discovery URL
COGNITO_DISCOVERY_URL="https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/openid-configuration"

echo -e "${GREEN}[OK]${NC} Using existing Cognito from slide-forge stack"
echo "  User Pool ID: ${COGNITO_USER_POOL_ID}"
echo "  Client ID: ${COGNITO_CLIENT_ID}"
echo "  Discovery URL: ${COGNITO_DISCOVERY_URL}"

# =============================================================================
# Create IAM Execution Role
# =============================================================================
echo ""
echo -e "${YELLOW}Checking IAM execution role...${NC}"

FULL_ROLE_NAME="${IAM_ROLE_NAME}-${AWS_REGION}-${DEPLOYMENT_ENV:-prod}"

if aws iam get-role --role-name "${FULL_ROLE_NAME}" &>/dev/null; then
    ROLE_ARN=$(aws iam get-role --role-name "${FULL_ROLE_NAME}" --query 'Role.Arn' --output text)
    echo -e "${GREEN}[OK]${NC} IAM role already exists: ${ROLE_ARN}"
else
    echo -e "${YELLOW}Creating IAM role: ${FULL_ROLE_NAME}${NC}"

    # Create trust policy for AgentCore
    cat > /tmp/trust-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "AssumeRolePolicy",
        "Effect": "Allow",
        "Principal": {
            "Service": "bedrock-agentcore.amazonaws.com"
        },
        "Action": "sts:AssumeRole",
        "Condition": {
            "StringEquals": {
                "aws:SourceAccount": "${AWS_ACCOUNT_ID}"
            },
            "ArnLike": {
                "aws:SourceArn": "arn:aws:bedrock-agentcore:${AWS_REGION}:${AWS_ACCOUNT_ID}:*"
            }
        }
    }]
}
EOF

    ROLE_ARN=$(aws iam create-role \
        --role-name "${FULL_ROLE_NAME}" \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --description "Execution role for Slide Forge Bedrock AgentCore Runtime" \
        --tags \
            Key=Project,Value="${TAG_PROJECT:-slide-forge}" \
            Key=Environment,Value="${TAG_ENVIRONMENT:-production}" \
            Key=ManagedBy,Value="${TAG_MANAGED_BY:-deployment-script}" \
        --query 'Role.Arn' \
        --output text)

    echo -e "${GREEN}[OK]${NC} IAM role created: ${ROLE_ARN}"
    rm /tmp/trust-policy.json
fi

# =============================================================================
# Update IAM Role Policy
# =============================================================================
echo -e "${YELLOW}Updating IAM role policy...${NC}"

cat > /tmp/role-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ECRImageAccess",
            "Effect": "Allow",
            "Action": [
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer"
            ],
            "Resource": ["arn:aws:ecr:${AWS_REGION}:${AWS_ACCOUNT_ID}:repository/*"]
        },
        {
            "Sid": "ECRTokenAccess",
            "Effect": "Allow",
            "Action": ["ecr:GetAuthorizationToken"],
            "Resource": "*"
        },
        {
            "Sid": "CloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:DescribeLogStreams",
                "logs:CreateLogGroup"
            ],
            "Resource": ["arn:aws:logs:${AWS_REGION}:${AWS_ACCOUNT_ID}:log-group:/aws/bedrock-agentcore/runtimes/*"]
        },
        {
            "Sid": "CloudWatchLogGroups",
            "Effect": "Allow",
            "Action": ["logs:DescribeLogGroups"],
            "Resource": ["arn:aws:logs:${AWS_REGION}:${AWS_ACCOUNT_ID}:log-group:*"]
        },
        {
            "Sid": "CloudWatchLogStream",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": ["arn:aws:logs:${AWS_REGION}:${AWS_ACCOUNT_ID}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*"]
        },
        {
            "Sid": "XRayTracing",
            "Effect": "Allow",
            "Action": [
                "xray:PutTraceSegments",
                "xray:PutTelemetryRecords",
                "xray:GetSamplingRules",
                "xray:GetSamplingTargets"
            ],
            "Resource": ["*"]
        },
        {
            "Sid": "CloudWatchMetrics",
            "Effect": "Allow",
            "Resource": "*",
            "Action": "cloudwatch:PutMetricData",
            "Condition": {
                "StringEquals": {
                    "cloudwatch:namespace": "bedrock-agentcore"
                }
            }
        },
        {
            "Sid": "GetAgentAccessToken",
            "Effect": "Allow",
            "Action": [
                "bedrock-agentcore:GetWorkloadAccessToken",
                "bedrock-agentcore:GetWorkloadAccessTokenForJWT",
                "bedrock-agentcore:GetWorkloadAccessTokenForUserId"
            ],
            "Resource": [
                "arn:aws:bedrock-agentcore:${AWS_REGION}:${AWS_ACCOUNT_ID}:workload-identity-directory/default",
                "arn:aws:bedrock-agentcore:${AWS_REGION}:${AWS_ACCOUNT_ID}:workload-identity-directory/default/workload-identity/*"
            ]
        },
        {
            "Sid": "BedrockModelInvocation",
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": [
                "arn:aws:bedrock:*::foundation-model/*",
                "arn:aws:bedrock:${AWS_REGION}:${AWS_ACCOUNT_ID}:*"
            ]
        },
        {
            "Sid": "S3WorkspaceAccess",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::${S3_WORKSPACE_BUCKET}",
                "arn:aws:s3:::${S3_WORKSPACE_BUCKET}/*"
            ]
        }
    ]
}
EOF

aws iam put-role-policy \
    --role-name "${FULL_ROLE_NAME}" \
    --policy-name "SlideForgeAgentCorePolicy" \
    --policy-document file:///tmp/role-policy.json

echo -e "${GREEN}[OK]${NC} IAM role policy updated"
rm /tmp/role-policy.json

# Wait for IAM role to propagate
echo -e "${YELLOW}Waiting 10 seconds for IAM role to propagate...${NC}"
sleep 10

# =============================================================================
# Create or Update AgentCore Runtime
# =============================================================================
echo ""
echo -e "${YELLOW}Checking AgentCore Runtime...${NC}"

RUNTIME_NAME="${AGENT_RUNTIME_NAME}"

# Check if runtime already exists
EXISTING_RUNTIME=$(aws bedrock-agentcore-control list-agent-runtimes --region "${AWS_REGION}" \
    --query "agentRuntimes[?agentRuntimeName=='${RUNTIME_NAME}'].agentRuntimeId" --output text 2>/dev/null || echo "")

# Prepare environment variables
ENV_VARS="AWS_DEFAULT_REGION=${AWS_REGION}"
[ -n "${ANTHROPIC_MODEL}" ] && ENV_VARS="${ENV_VARS},ANTHROPIC_MODEL=${ANTHROPIC_MODEL}"
[ -n "${ANTHROPIC_SMALL_FAST_MODEL}" ] && ENV_VARS="${ENV_VARS},ANTHROPIC_SMALL_FAST_MODEL=${ANTHROPIC_SMALL_FAST_MODEL}"
[ -n "${ANTHROPIC_DEFAULT_HAIKU_MODEL}" ] && ENV_VARS="${ENV_VARS},ANTHROPIC_DEFAULT_HAIKU_MODEL=${ANTHROPIC_DEFAULT_HAIKU_MODEL}"
[ -n "${DISABLE_PROMPT_CACHING}" ] && ENV_VARS="${ENV_VARS},DISABLE_PROMPT_CACHING=${DISABLE_PROMPT_CACHING}"
[ -n "${CLAUDE_CODE_USE_BEDROCK}" ] && ENV_VARS="${ENV_VARS},CLAUDE_CODE_USE_BEDROCK=${CLAUDE_CODE_USE_BEDROCK}"
ENV_VARS="${ENV_VARS},S3_WORKSPACE_BUCKET=${S3_WORKSPACE_BUCKET}"

# Prepare authorizer configuration (using existing Cognito)
AUTHORIZER_CONFIG="customJWTAuthorizer={discoveryUrl=${COGNITO_DISCOVERY_URL},allowedClients=[${COGNITO_CLIENT_ID}]}"

if [ -n "$EXISTING_RUNTIME" ]; then
    echo -e "${YELLOW}Updating existing AgentCore Runtime: ${EXISTING_RUNTIME}${NC}"

    aws bedrock-agentcore-control update-agent-runtime \
        --agent-runtime-id "${EXISTING_RUNTIME}" \
        --region "${AWS_REGION}" \
        --agent-runtime-artifact "containerConfiguration={containerUri=${DOCKER_IMAGE_URI}}" \
        --network-configuration "networkMode=PUBLIC" \
        --role-arn "${ROLE_ARN}" \
        --request-header-configuration "requestHeaderAllowlist=[Authorization]" \
        --environment-variables "${ENV_VARS}" \
        --authorizer-configuration "${AUTHORIZER_CONFIG}" \
        --output json > /tmp/runtime-output.json

    RUNTIME_ID="${EXISTING_RUNTIME}"
    echo -e "${GREEN}[OK]${NC} AgentCore Runtime updated"
else
    echo -e "${YELLOW}Creating new AgentCore Runtime: ${RUNTIME_NAME}${NC}"

    aws bedrock-agentcore-control create-agent-runtime \
        --agent-runtime-name "${RUNTIME_NAME}" \
        --region "${AWS_REGION}" \
        --agent-runtime-artifact "containerConfiguration={containerUri=${DOCKER_IMAGE_URI}}" \
        --network-configuration "networkMode=PUBLIC" \
        --role-arn "${ROLE_ARN}" \
        --request-header-configuration "requestHeaderAllowlist=[Authorization]" \
        --environment-variables "${ENV_VARS}" \
        --authorizer-configuration "${AUTHORIZER_CONFIG}" \
        --output json > /tmp/runtime-output.json

    RUNTIME_ID=$(jq -r '.agentRuntimeId' /tmp/runtime-output.json)
    echo -e "${GREEN}[OK]${NC} AgentCore Runtime created: ${RUNTIME_ID}"
fi

# Extract runtime details
RUNTIME_ARN=$(jq -r '.agentRuntimeArn' /tmp/runtime-output.json)
WORKLOAD_IDENTITY_ARN=$(jq -r '.workloadIdentityDetails.workloadIdentityArn // "N/A"' /tmp/runtime-output.json)
STATUS=$(jq -r '.status' /tmp/runtime-output.json)

# Construct Runtime URL
ENCODED_ARN=$(echo "${RUNTIME_ARN}" | sed 's/:/%3A/g' | sed 's/\//%2F/g')
RUNTIME_URL="https://bedrock-agentcore.${AWS_REGION}.amazonaws.com/runtimes/${ENCODED_ARN}"

rm /tmp/runtime-output.json

# =============================================================================
# Save Outputs
# =============================================================================
cat > "${SCRIPT_DIR}/.agentcore_output" <<EOF
export AGENT_RUNTIME_ID=${RUNTIME_ID}
export AGENT_RUNTIME_ARN=${RUNTIME_ARN}
export AGENT_RUNTIME_URL=${RUNTIME_URL}
export WORKLOAD_IDENTITY_ARN=${WORKLOAD_IDENTITY_ARN}
export IAM_ROLE_ARN=${ROLE_ARN}
export S3_WORKSPACE_BUCKET=${S3_WORKSPACE_BUCKET}
export COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
export COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
export COGNITO_DISCOVERY_URL=${COGNITO_DISCOVERY_URL}
export COGNITO_REGION=${COGNITO_REGION}
EOF

# =============================================================================
# Print Summary
# =============================================================================
echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}Step 2 Complete!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "${BLUE}AgentCore Runtime Details:${NC}"
echo "  Runtime ID: ${RUNTIME_ID}"
echo "  Runtime ARN: ${RUNTIME_ARN}"
echo "  Runtime URL: ${RUNTIME_URL}"
echo "  Status: ${STATUS}"
echo "  Workload Identity: ${WORKLOAD_IDENTITY_ARN}"
echo ""
echo -e "${BLUE}Authentication (using existing Cognito):${NC}"
echo "  User Pool ID: ${COGNITO_USER_POOL_ID}"
echo "  Client ID: ${COGNITO_CLIENT_ID}"
echo "  Discovery URL: ${COGNITO_DISCOVERY_URL}"
echo ""
echo -e "${BLUE}Storage:${NC}"
echo "  S3 Bucket: ${S3_WORKSPACE_BUCKET}"
echo ""
echo "Output saved to ${SCRIPT_DIR}/.agentcore_output"
echo ""
echo -e "${YELLOW}Note:${NC} The AgentCore runtime may take a few minutes to become available."
echo "Check the status with:"
echo "  aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id ${RUNTIME_ID} --region ${AWS_REGION}"
