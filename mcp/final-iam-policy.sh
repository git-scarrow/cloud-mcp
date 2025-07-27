#!/bin/bash

# Final comprehensive IAM policy for MCP Cognitive Load Reducer

set -e

echo "🔐 Updating IAM user with comprehensive policy..."

USER_NAME="mcp-cognitive-load-user"
POLICY_NAME="MCPCognitiveLoadReducerPolicy"

# Create comprehensive policy
cat > /tmp/mcp-policy-final.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:*"
            ],
            "Resource": [
                "arn:aws:dynamodb:*:*:table/mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:*"
            ],
            "Resource": [
                "arn:aws:lambda:*:*:function:mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:*"
            ],
            "Resource": [
                "arn:aws:logs:*:*:log-group:/aws/lambda/mcp-cognitive-load-*",
                "arn:aws:logs:*:*:log-group:/aws/lambda/mcp-cognitive-load-*:*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:*"
            ],
            "Resource": [
                "arn:aws:cloudformation:*:*:stack/mcp-cognitive-load/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:GetRole",
                "iam:GetRolePolicy",
                "iam:PassRole",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies"
            ],
            "Resource": [
                "arn:aws:iam::*:role/mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "events:*"
            ],
            "Resource": [
                "arn:aws:events:*:*:rule/mcp-cognitive-load-*"
            ]
        }
    ]
}
EOF

# Update the policy
aws iam put-user-policy \
    --user-name $USER_NAME \
    --policy-name $POLICY_NAME \
    --policy-document file:///tmp/mcp-policy-final.json

# Clean up
rm /tmp/mcp-policy-final.json

echo "✅ IAM policy updated with comprehensive permissions!"
echo ""
echo "The user now has full permissions for resources prefixed with 'mcp-cognitive-load-'"