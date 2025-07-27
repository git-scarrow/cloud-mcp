#!/bin/bash

# Deploy Lambda function code

set -e

echo "🔧 Deploying Lambda function code..."

FUNCTION_NAME="mcp-cognitive-load-context-processor"
REGION="${AWS_REGION:-us-east-1}"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Use limited IAM user profile
export AWS_PROFILE=mcp-cognitive-load

# Create deployment package
cd "$SCRIPT_DIR/aws-unified-mcp-server/lambda"
zip -r function.zip context-processor.js

# Update Lambda function code
echo "📤 Uploading function code..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $REGION

# Clean up
rm function.zip
cd "$SCRIPT_DIR"

echo "✅ Lambda function deployed!"