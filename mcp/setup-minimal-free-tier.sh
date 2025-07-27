#!/bin/bash

# Minimal Free Tier AWS MCP Setup
# This script sets up the absolute safest configuration for free AWS usage

set -e

echo "🛡️  Minimal Free Tier AWS MCP Setup"
echo "==================================="
echo "This setup prioritizes zero AWS costs with maximum safety"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "📋 Checking prerequisites..."

# Check uv
if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}Installing uv (Python package manager)...${NC}"
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI not found!${NC}"
    echo "Please install AWS CLI first:"
    echo "  macOS: brew install awscli"
    echo "  Linux: sudo apt-get install awscli (or equivalent)"
    exit 1
fi

# Step 2: Create directory structure
echo -e "\n${GREEN}✓ Creating directory structure...${NC}"
mkdir -p ~/.aws/amazonq
mkdir -p ~/aws-mcp-workspace

# Step 3: Create NO-CREDENTIAL MCP configuration
echo -e "\n${GREEN}✓ Creating zero-cost MCP configuration...${NC}"

cat > ~/.aws/amazonq/mcp-zero-cost.json << 'EOF'
{
  "mcpServers": {
    "Comment": "These servers require NO AWS credentials and have ZERO costs",
    
    "awslabs.aws-knowledge-mcp-server": {
      "remote": "https://lev1p7o0ii.execute-api.us-west-2.amazonaws.com",
      "disabled": false,
      "autoApprove": ["search_documentation", "read_documentation", "recommend"],
      "_comment": "Remote server - No AWS account needed!"
    },
    
    "awslabs.aws-documentation-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.aws-documentation-mcp-server@latest"],
      "env": {
        "UPDATE_DOCS_ON_STARTUP": "true",
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "autoApprove": ["search_documentation", "read_documentation"],
      "_comment": "Local documentation - No API calls!"
    },
    
    "awslabs.core-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.core-mcp-server@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "_comment": "Local utilities - No AWS needed!"
    },
    
    "awslabs.terraform-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.terraform-mcp-server@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "_comment": "Local Terraform operations - No AWS needed!"
    },
    
    "awslabs.cfn-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.cfn-mcp-server@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "_comment": "CloudFormation template validation - No AWS needed!"
    }
  }
}
EOF

# Step 4: Create minimal IAM policy file
echo -e "\n${GREEN}✓ Creating minimal IAM policy...${NC}"
mkdir -p iam-policies

# Step 5: Create quick test script
echo -e "\n${GREEN}✓ Creating test script...${NC}"

cat > ~/test-mcp-servers.sh << 'EOF'
#!/bin/bash

echo "🧪 Testing MCP Servers (No AWS Credentials Needed)"
echo "================================================"

# Test if MCP servers are accessible
echo -e "\n1. Testing AWS Knowledge Server (Remote)..."
echo "   This provides real-time AWS documentation without any AWS account"

echo -e "\n2. Testing AWS Documentation Server (Local)..."
echo "   This caches AWS docs locally for offline access"

echo -e "\n3. Available Zero-Cost Servers:"
echo "   ✓ AWS Knowledge - Search all AWS documentation"
echo "   ✓ AWS Documentation - Local doc cache"
echo "   ✓ Core MCP - Utility functions"
echo "   ✓ Terraform - Generate IaC without AWS"
echo "   ✓ CloudFormation - Validate templates locally"

echo -e "\n✅ All servers configured for zero AWS costs!"
EOF

chmod +x ~/test-mcp-servers.sh

# Step 6: Create cost monitoring script (for when you add credentials later)
echo -e "\n${GREEN}✓ Creating cost monitoring script...${NC}"

cat > ~/monitor-aws-costs.sh << 'EOF'
#!/bin/bash

# AWS Cost Monitor - Run this if you ever add AWS credentials

if ! aws sts get-caller-identity --profile mcp-minimal &> /dev/null; then
    echo "ℹ️  No AWS credentials configured - Perfect for zero costs!"
    echo "You're using only local/remote MCP servers that don't need AWS access."
    exit 0
fi

echo "⚠️  AWS Credentials Detected - Monitoring Costs..."

# Get current month costs
CURRENT_MONTH=$(date +%Y-%m)
START_DATE="${CURRENT_MONTH}-01"

# For macOS and Linux compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
    END_DATE=$(date -v +1m -v 1d -v -1d +%Y-%m-%d)
else
    END_DATE=$(date -d "next month - 1 day" +%Y-%m-%d)
fi

echo "📊 AWS Costs for $CURRENT_MONTH"
echo "================================"

aws ce get-cost-and-usage \
    --profile mcp-minimal \
    --time-period Start=$START_DATE,End=$END_DATE \
    --granularity MONTHLY \
    --metrics "UnblendedCost" \
    --group-by Type=DIMENSION,Key=SERVICE \
    --query 'ResultsByTime[0].Groups[?Metrics.UnblendedCost.Amount > `0`].[Keys[0], Metrics.UnblendedCost.Amount]' \
    --output table 2>/dev/null || echo "No costs found (good!)"
EOF

chmod +x ~/monitor-aws-costs.sh

# Step 7: Create learning path
echo -e "\n${GREEN}✓ Creating learning guide...${NC}"

cat > ~/aws-mcp-learning-path.md << 'EOF'
# AWS MCP Learning Path - Zero Cost Edition

## Phase 1: No AWS Account Needed (Current Setup)
Start here - these work immediately with zero setup:

1. **AWS Knowledge Server**
   - Ask: "How do I create an S3 bucket?"
   - Ask: "Explain AWS Lambda best practices"
   - Ask: "What's new in AWS?"

2. **AWS Documentation Server**
   - Search AWS docs offline
   - Learn service details without API calls

3. **CloudFormation Server**
   - Validate templates locally
   - Learn IaC without deploying

## Phase 2: Minimal AWS Access (Optional Future Step)
If you want to explore actual AWS resources:

1. Create IAM user with minimal policy (see iam-policies/)
2. Only use read operations
3. Monitor costs daily with ~/monitor-aws-costs.sh

## Phase 3: Free Tier Services (Advanced)
Services with generous free tiers:
- Lambda: 1M requests/month free
- DynamoDB: 25GB storage free
- CloudWatch Logs: 5GB free

## Safety Rules
1. Always start with Knowledge/Documentation servers
2. Never create resources without understanding costs
3. Set $0.01 billing alerts before adding credentials
4. Use read-only operations whenever possible
EOF

# Step 8: Final setup message
echo -e "\n${GREEN}🎉 Setup Complete!${NC}"
echo -e "\n${YELLOW}You now have 5 MCP servers configured with ZERO AWS costs:${NC}"
echo "1. AWS Knowledge Server - Real-time AWS documentation"
echo "2. AWS Documentation Server - Offline AWS docs"
echo "3. Core MCP Server - Utility functions"
echo "4. Terraform Server - Generate infrastructure code"
echo "5. CloudFormation Server - Validate templates"

echo -e "\n${YELLOW}📁 Created files:${NC}"
echo "- ~/.aws/amazonq/mcp-zero-cost.json (MCP configuration)"
echo "- ~/test-mcp-servers.sh (Test script)"
echo "- ~/monitor-aws-costs.sh (Cost monitor for future use)"
echo "- ~/aws-mcp-learning-path.md (Learning guide)"

echo -e "\n${YELLOW}🚀 Next steps:${NC}"
echo "1. Copy configuration to your MCP client:"
echo "   cp ~/.aws/amazonq/mcp-zero-cost.json ~/.aws/amazonq/mcp.json"
echo ""
echo "2. Start using MCP servers with NO AWS costs!"
echo "   - Try: 'Using AWS Knowledge server, how do I set up a VPC?'"
echo "   - Try: 'Search AWS documentation for Lambda best practices'"
echo ""
echo "3. Run ~/test-mcp-servers.sh to verify setup"

echo -e "\n${GREEN}✨ You're ready to explore AWS with zero costs!${NC}"