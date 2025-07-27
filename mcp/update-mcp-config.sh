#!/bin/bash

# Update MCP config to use cognitive load reducer

set -e

echo "🔧 Updating MCP configuration..."

# Get DynamoDB table names from CloudFormation
STACK_NAME="mcp-cognitive-load"
REGION="${AWS_REGION:-us-east-1}"

# Create enhanced config
cat > ~/.aws/amazonq/mcp-enhanced.json << EOF
{
  "mcpServers": {
    "aws-unified-enhanced": {
      "command": "node",
      "args": ["${HOME}/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "AWS_REGION": "${REGION}",
        "AWS_PROFILE": "mcp-cognitive-load",
        "MCP_TABLE_PREFIX": "mcp-cognitive-load",
        "ENABLE_COGNITIVE_LOAD_REDUCTION": "true",
        "CONTEXT_OPTIMIZATION_LEVEL": "aggressive",
        "SESSION_PERSISTENCE": "true"
      }
    },
    "awslabs.aws-knowledge-mcp-server": {
      "remote": "https://lev1p7o0ii.execute-api.us-west-2.amazonaws.com",
      "disabled": false,
      "autoApprove": ["search_documentation", "read_documentation", "recommend"]
    }
  }
}
EOF

echo "✅ MCP configuration updated!"
echo ""
echo "To activate: cp ~/.aws/amazonq/mcp-enhanced.json ~/.aws/amazonq/mcp.json"