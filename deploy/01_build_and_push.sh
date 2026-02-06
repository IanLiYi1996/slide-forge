#!/bin/bash
# =============================================================================
# Slide Forge - Build and Push Docker Image to ECR
# =============================================================================
# Step 1: Build ARM64 Docker image and push to Amazon ECR
#
# Prerequisites:
# - AWS CLI configured with appropriate permissions
# - Docker installed and running
# - config.env file with required values
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load configuration
if [ -f "${SCRIPT_DIR}/config.env" ]; then
    source "${SCRIPT_DIR}/config.env"
else
    echo "Error: config.env not found. Please copy config.env.template to config.env and fill in the values."
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}Step 1: Build and Push Docker Image${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""

# Auto-detect AWS Account ID if not set
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}AWS_ACCOUNT_ID not set in config, detecting...${NC}"
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}Detected AWS_ACCOUNT_ID: ${AWS_ACCOUNT_ID}${NC}"
fi

# Auto-detect AWS Region if not set
if [ -z "$AWS_REGION" ]; then
    echo -e "${YELLOW}AWS_REGION not set, using default...${NC}"
    AWS_REGION=$(aws configure get region)
    AWS_REGION=${AWS_REGION:-us-west-2}
    echo -e "${GREEN}Using AWS_REGION: ${AWS_REGION}${NC}"
fi

# Construct ECR URI and image name
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
FULL_IMAGE_NAME="${ECR_URI}/${ECR_REPOSITORY_NAME}:${DOCKER_IMAGE_VERSION}"

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Project Root: ${PROJECT_ROOT}"
echo "  ECR Repository: ${ECR_REPOSITORY_NAME}"
echo "  Image Version: ${DOCKER_IMAGE_VERSION}"
echo "  Full Image URI: ${FULL_IMAGE_NAME}"
echo ""

# =============================================================================
# Create ECR Repository if it doesn't exist
# =============================================================================
echo -e "${YELLOW}Checking if ECR repository exists...${NC}"
if ! aws ecr describe-repositories --region "${AWS_REGION}" --repository-names "${ECR_REPOSITORY_NAME}" > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating ECR repository: ${ECR_REPOSITORY_NAME}${NC}"
    aws ecr create-repository \
        --region "${AWS_REGION}" \
        --repository-name "${ECR_REPOSITORY_NAME}" \
        --image-scanning-configuration scanOnPush=true \
        --tags \
            Key=Project,Value="${TAG_PROJECT}" \
            Key=Environment,Value="${TAG_ENVIRONMENT}" \
            Key=ManagedBy,Value="${TAG_MANAGED_BY}" \
        > /dev/null
    echo -e "${GREEN}[OK]${NC} ECR repository created"
else
    echo -e "${GREEN}[OK]${NC} ECR repository already exists"
fi

# =============================================================================
# Login to ECR
# =============================================================================
echo -e "${YELLOW}Logging into ECR...${NC}"
aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${ECR_URI}"
echo -e "${GREEN}[OK]${NC} Logged into ECR"

# =============================================================================
# Build Docker Image for ARM64
# =============================================================================
echo ""
echo -e "${YELLOW}Building Docker image for ARM64 architecture...${NC}"
echo "  This may take several minutes on first build..."
echo ""

docker build \
    --platform linux/arm64 \
    -t "${FULL_IMAGE_NAME}" \
    -f "${SCRIPT_DIR}/Dockerfile" \
    "${PROJECT_ROOT}"

echo -e "${GREEN}[OK]${NC} Docker image built (ARM64)"

# =============================================================================
# Push Image to ECR
# =============================================================================
echo ""
echo -e "${YELLOW}Pushing image to ECR...${NC}"
docker push "${FULL_IMAGE_NAME}"
echo -e "${GREEN}[OK]${NC} Image pushed to ECR"

# =============================================================================
# Save Output for Next Step
# =============================================================================
echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}Step 1 Complete!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo "Image URI: ${FULL_IMAGE_NAME}"
echo ""

# Save output for next step
cat > "${SCRIPT_DIR}/.build_output" <<EOF
export DOCKER_IMAGE_URI=${FULL_IMAGE_NAME}
export AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
export AWS_REGION=${AWS_REGION}
EOF

echo "Output saved to ${SCRIPT_DIR}/.build_output"
echo ""
echo -e "${BLUE}Next step:${NC} Run ./02_deploy_agentcore.sh to deploy to AgentCore"
