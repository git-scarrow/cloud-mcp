#!/bin/bash

# AWS Free Tier MCP Setup Script
# This script sets up MCP servers that work with AWS Free Tier

echo "🚀 AWS Free Tier MCP Setup Script"
echo "================================="

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "📦 Installing AWS CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install awscli
    else
        echo "Please install AWS CLI manually for your system"
        exit 1
    fi
fi

# Create MCP configuration directory
MCP_CONFIG_DIR="$HOME/.aws/amazonq"
mkdir -p "$MCP_CONFIG_DIR"

# Create Free Tier safe MCP configuration
cat > "$MCP_CONFIG_DIR/mcp-free-tier.json" << 'EOF'
{
  "mcpServers": {
    "awslabs.aws-knowledge-mcp-server": {
      "remote": "https://lev1p7o0ii.execute-api.us-west-2.amazonaws.com",
      "disabled": false,
      "autoApprove": ["search_documentation", "read_documentation", "recommend"]
    },
    "awslabs.aws-documentation-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.aws-documentation-mcp-server@latest"],
      "env": {
        "UPDATE_DOCS_ON_STARTUP": "true",
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "autoApprove": ["search_documentation", "read_documentation"]
    },
    "awslabs.core-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.core-mcp-server@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false
    }
  }
}
EOF

echo "✅ Created Free Tier MCP configuration at: $MCP_CONFIG_DIR/mcp-free-tier.json"

# Configure AWS Profile if not exists
if ! aws configure get aws_access_key_id --profile mcp-free-tier &> /dev/null; then
    echo ""
    echo "🔐 Setting up AWS Profile for Free Tier usage..."
    echo "Please create an IAM user with minimal permissions first!"
    echo ""
    echo "Steps:"
    echo "1. Go to AWS Console → IAM → Users → Create User"
    echo "2. Create user 'mcp-free-tier-user' with programmatic access"
    echo "3. Attach policy: 'ReadOnlyAccess' or create custom minimal policy"
    echo "4. Save the Access Key ID and Secret Access Key"
    echo ""
    read -p "Press Enter when ready to configure AWS profile..."
    
    aws configure --profile mcp-free-tier
fi

# Test AWS configuration
echo ""
echo "🧪 Testing AWS configuration..."
if aws sts get-caller-identity --profile mcp-free-tier &> /dev/null; then
    echo "✅ AWS profile 'mcp-free-tier' is configured correctly!"
    aws sts get-caller-identity --profile mcp-free-tier --output table
else
    echo "❌ AWS profile configuration failed. Please check your credentials."
fi

# Create billing alert script
cat > "$HOME/check-aws-costs.sh" << 'EOF'
#!/bin/bash
# Check current AWS costs

PROFILE="mcp-free-tier"
CURRENT_MONTH=$(date +%Y-%m)
START_DATE="${CURRENT_MONTH}-01"
END_DATE=$(date -v +1m -v 1d -v -1d +%Y-%m-%d 2>/dev/null || date -d "next month" +%Y-%m-01)

echo "📊 AWS Cost Report for $CURRENT_MONTH"
echo "===================================="

aws ce get-cost-and-usage \
    --profile $PROFILE \
    --time-period Start=$START_DATE,End=$END_DATE \
    --granularity MONTHLY \
    --metrics "UnblendedCost" \
    --group-by Type=DIMENSION,Key=SERVICE \
    --output table
EOF

chmod +x "$HOME/check-aws-costs.sh"

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Copy the MCP configuration to your MCP client:"
echo "   cp $MCP_CONFIG_DIR/mcp-free-tier.json ~/.aws/amazonq/mcp.json"
echo ""
echo "2. Check AWS costs anytime with:"
echo "   ~/check-aws-costs.sh"
echo ""
echo "3. Start with these 100% free servers:"
echo "   - AWS Knowledge Server (remote, no AWS account needed)"
echo "   - AWS Documentation Server (local, no API calls)"
echo "   - Core MCP Server (local utilities)"
echo ""
echo "🎯 Free Tier Best Practices:"
echo "   - Always use read-only operations when possible"
echo "   - Set up billing alerts at $0.01"
echo "   - Monitor the AWS Free Tier dashboard regularly"
echo "   - Start with documentation servers before using API servers"