#!/bin/bash

# Create IAM user with limited permissions for MCP Cognitive Load Reducer

set -e

echo "🔐 Creating IAM user with limited permissions..."

USER_NAME="mcp-cognitive-load-user"
POLICY_NAME="MCPCognitiveLoadReducerPolicy"

# Create the user
echo "👤 Creating IAM user: $USER_NAME"
aws iam create-user --user-name $USER_NAME

# Create inline policy with minimal permissions
echo "📜 Creating policy with limited permissions..."
cat > /tmp/mcp-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:DescribeTable"
            ],
            "Resource": [
                "arn:aws:dynamodb:*:*:table/mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:InvokeFunction"
            ],
            "Resource": [
                "arn:aws:lambda:*:*:function:mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:logs:*:*:log-group:/aws/lambda/mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:DescribeStacks",
                "cloudformation:ListStackResources"
            ],
            "Resource": [
                "arn:aws:cloudformation:*:*:stack/mcp-cognitive-load/*"
            ]
        }
    ]
}
EOF

# Attach the policy to the user
aws iam put-user-policy \
    --user-name $USER_NAME \
    --policy-name $POLICY_NAME \
    --policy-document file:///tmp/mcp-policy.json

# Create access key
echo "🔑 Creating access key..."
ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name $USER_NAME)

# Extract credentials
ACCESS_KEY_ID=$(echo $ACCESS_KEY_OUTPUT | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo $ACCESS_KEY_OUTPUT | jq -r '.AccessKey.SecretAccessKey')

# Clean up
rm /tmp/mcp-policy.json

# Save credentials securely
echo ""
echo "✅ IAM user created successfully!"
echo ""
echo "🔐 SAVE THESE CREDENTIALS SECURELY (they won't be shown again):"
echo "================================================"
echo "User Name: $USER_NAME"
echo "Access Key ID: $ACCESS_KEY_ID"
echo "Secret Access Key: $SECRET_ACCESS_KEY"
echo "================================================"
echo ""
echo "📝 To use these credentials:"
echo "1. Run: aws configure --profile mcp-cognitive-load"
echo "2. Enter the Access Key ID and Secret Access Key above"
echo "3. Set region to: us-east-1"
echo "4. Set output format to: json"
echo ""
echo "Then export: export AWS_PROFILE=mcp-cognitive-load"
echo ""
echo "⚠️  This user has LIMITED permissions for:"
echo "- DynamoDB tables starting with 'mcp-cognitive-load-'"
echo "- Lambda functions starting with 'mcp-cognitive-load-'"
echo "- CloudWatch logs for those Lambda functions"
echo "- CloudFormation stacks named 'mcp-cognitive-load'"