#!/bin/bash

# Setup Claude Desktop for AWS Unified MCP Server

echo "🚀 Setting up Claude Desktop for AWS Unified MCP Server"

# Configuration file path for macOS
CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

# Create directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# MCP server path
MCP_SERVER_PATH="/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"

# Check if server exists
if [ ! -f "$MCP_SERVER_PATH" ]; then
    echo "❌ MCP server not found at $MCP_SERVER_PATH"
    echo "📦 Building server..."
    cd /Users/sam/dev/aws/mcp/aws-unified-mcp-server
    npm run build
fi

# Create or update configuration
cat > "$CONFIG_FILE" << 'EOF'
{
  "mcpServers": {
    "aws-unified": {
      "command": "node",
      "args": ["/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_PROFILE": "default",
        "EDGE_DEVICES": "pifive0,piiv,piiv2",
        "S3_BUCKET": "edge-backup-picluster-free",
        "DYNAMODB_TABLE": "edge-device-metrics-free",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
EOF

echo "✅ Configuration created at: $CONFIG_FILE"
echo ""
echo "📋 Configuration contents:"
cat "$CONFIG_FILE"
echo ""

# Test server startup
echo "🧪 Testing MCP server..."
cd /Users/sam/dev/aws/mcp/aws-unified-mcp-server
timeout 5 npm start > /tmp/mcp-test.log 2>&1

if grep -q "MCP server running" /tmp/mcp-test.log; then
    echo "✅ MCP server starts successfully"
else
    echo "⚠️  MCP server may have issues, check logs"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Quit Claude Desktop completely (Cmd+Q)"
echo "2. Restart Claude Desktop"
echo "3. Look for the MCP icon in Claude Desktop"
echo "4. Try: 'Show me my edge device status'"
echo ""
echo "📝 Example queries to try:"
echo "- What's the status of my Pi cluster?"
echo "- Generate Terraform for edge backups"
echo "- How much am I spending on AWS?"
echo "- Create CloudWatch alarms for edge devices"
echo ""
echo "🔧 Troubleshooting:"
echo "- Check Claude Desktop developer console for errors"
echo "- Run: cd $MCP_SERVER_PATH && npm start"
echo "- Verify AWS credentials: aws sts get-caller-identity"