#!/bin/bash

# Update IAM user policy to include CloudFormation permissions

set -e

echo "🔐 Updating IAM user policy..."

USER_NAME="mcp-cognitive-load-user"
POLICY_NAME="MCPCognitiveLoadReducerPolicy"

# Create updated policy with CloudFormation permissions
cat > /tmp/mcp-policy-updated.json << 'EOF'
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
                "dynamodb:DescribeTable",
                "dynamodb:CreateTable",
                "dynamodb:DeleteTable",
                "dynamodb:TagResource",
                "dynamodb:UpdateTimeToLive",
                "dynamodb:DescribeTimeToLive"
            ],
            "Resource": [
                "arn:aws:dynamodb:*:*:table/mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:InvokeFunction",
                "lambda:CreateFunction",
                "lambda:DeleteFunction",
                "lambda:UpdateFunctionCode",
                "lambda:UpdateFunctionConfiguration",
                "lambda:GetFunction",
                "lambda:TagResource"
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
                "logs:PutLogEvents",
                "logs:DeleteLogGroup"
            ],
            "Resource": [
                "arn:aws:logs:*:*:log-group:/aws/lambda/mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:CreateStack",
                "cloudformation:UpdateStack",
                "cloudformation:DeleteStack",
                "cloudformation:DescribeStacks",
                "cloudformation:DescribeStackEvents",
                "cloudformation:DescribeStackResources",
                "cloudformation:ListStackResources",
                "cloudformation:GetTemplate"
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
                "iam:PassRole"
            ],
            "Resource": [
                "arn:aws:iam::*:role/mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "events:PutRule",
                "events:DeleteRule",
                "events:PutTargets",
                "events:RemoveTargets",
                "events:DescribeRule"
            ],
            "Resource": [
                "arn:aws:events:*:*:rule/mcp-cognitive-load-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudwatch:PutMetricData",
                "cloudwatch:GetMetricData",
                "cloudwatch:PutDashboard",
                "cloudwatch:DeleteDashboards"
            ],
            "Resource": "*",
            "Condition": {
                "StringLike": {
                    "cloudwatch:namespace": "mcp-cognitive-load/*"
                }
            }
        }
    ]
}
EOF

# Update the policy
aws iam put-user-policy \
    --user-name $USER_NAME \
    --policy-name $POLICY_NAME \
    --policy-document file:///tmp/mcp-policy-updated.json

# Clean up
rm /tmp/mcp-policy-updated.json

echo "✅ IAM policy updated successfully!"
echo ""
echo "The user now has permissions to:"
echo "- Create/manage CloudFormation stacks"
echo "- Create/manage DynamoDB tables"
echo "- Create/manage Lambda functions"
echo "- Create/manage IAM roles (for Lambda)"
echo "- Create/manage EventBridge rules"
echo "- Create/manage CloudWatch resources"
echo ""
echo "All limited to resources prefixed with 'mcp-cognitive-load-'"