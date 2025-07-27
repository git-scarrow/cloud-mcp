#!/bin/bash

# Deploy Cognitive Load Reduction System to AWS
# Total cost: ~$3.24/month after free tier

set -e

echo "🚀 Deploying AWS Cognitive Load Reduction Infrastructure..."

# Variables
STACK_NAME="mcp-cognitive-load"
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-prod}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Use limited IAM user profile
export AWS_PROFILE=mcp-cognitive-load

# Check AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ AWS CLI not configured. Please run: aws configure"
    exit 1
fi

echo "✅ Using IAM user: $(aws sts get-caller-identity --query 'Arn' --output text)"

# Deploy CloudFormation stack
echo "📦 Creating CloudFormation stack..."
aws cloudformation create-stack \
    --stack-name $STACK_NAME \
    --template-body file://${SCRIPT_DIR}/cloudformation-simple.yaml \
    --parameters ParameterKey=Environment,ParameterValue=$ENVIRONMENT \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

echo "⏳ Waiting for stack creation (this may take 5-10 minutes)..."
aws cloudformation wait stack-create-complete \
    --stack-name $STACK_NAME \
    --region $REGION

echo "✅ Stack created successfully!"

# Get outputs
echo "📋 Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table \
    --region $REGION

# Next steps
echo ""
echo "🎯 Next steps:"
echo "1. Deploy Lambda function code: ./deploy-lambda.sh"
echo "2. Initialize knowledge base: ./init-knowledge.sh"
echo "3. Update MCP config to use enhanced context"
echo ""
echo "💰 Estimated monthly cost: $3.24 (after free tier)"