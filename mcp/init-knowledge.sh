#!/bin/bash

# Initialize knowledge base by triggering Lambda

set -e

echo "🧠 Initializing knowledge base..."

FUNCTION_NAME="mcp-cognitive-load-context-processor"
REGION="${AWS_REGION:-us-east-1}"

# Use limited IAM user profile
export AWS_PROFILE=mcp-cognitive-load

# Trigger Lambda with full processing
echo "📚 Populating AWS service knowledge..."
PAYLOAD=$(echo '{"processingType": "knowledge"}' | base64)
aws lambda invoke \
    --function-name $FUNCTION_NAME \
    --payload "$PAYLOAD" \
    --region $REGION \
    response.json

echo "✅ Knowledge base initialized!"
cat response.json
rm response.json