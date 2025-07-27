# AWS Free Tier Setup Guide for MCP Servers

## 1. Set Up Billing Alerts First!

### Create a Zero-Dollar Budget Alert
1. Go to AWS Billing Dashboard → Budgets
2. Create budget → Cost budget
3. Set budget amount to $0.01
4. Add your email for alerts
5. Set alert at 80% and 100% of budget

### Enable Free Tier Usage Alerts
1. Go to Billing preferences
2. Enable "Receive Free Tier Usage Alerts"
3. Enter your email address

## 2. Create Limited IAM User

### Create IAM User with Minimal Permissions
```bash
# Option 1: Via AWS Console
# Go to IAM → Users → Create User
# Username: mcp-free-tier-user
# Access type: Programmatic access
```

### Attach These Free-Tier-Safe Policies:
- `AWSLambda_ReadOnlyAccess` (Lambda is free up to 1M requests/month)
- `AmazonDynamoDBReadOnlyAccess` (DynamoDB has free tier)
- `AmazonS3ReadOnlyAccess` (S3 has 5GB free storage)
- `CloudWatchLogsReadOnlyAccess` (CloudWatch has free tier)

## 3. Install and Configure AWS CLI

```bash
# Install AWS CLI
brew install awscli

# Install uv for Python management
curl -LsSf https://astral.sh/uv/install.sh | sh

# Configure AWS profile
aws configure --profile mcp-free-tier
# Access Key ID: [Your IAM user's key]
# Secret Access Key: [Your IAM user's secret]
# Default region: us-east-1
# Default output: json
```

## 4. Free Tier Compatible MCP Servers

### Always Free Services:
1. **AWS Knowledge MCP Server** (Remote - No AWS costs!)
   - Real-time AWS documentation access
   - No AWS account required
   - Perfect for learning

2. **AWS Documentation MCP Server** (Local - No AWS costs!)
   - Offline AWS documentation
   - No API calls to AWS

3. **CloudFormation MCP Server** (Free - Template validation only)
   - Validate templates locally
   - No stack creation costs

4. **CDK MCP Server** (Free - Local development)
   - Generate CloudFormation templates
   - No deployment costs

### Free Tier Services (with limits):
5. **Lambda Tool MCP Server**
   - 1 million free requests per month
   - 400,000 GB-seconds compute time

6. **DynamoDB MCP Server**
   - 25 GB storage free
   - 25 read/write capacity units

7. **S3 Tables MCP Server**
   - 5 GB storage free for 12 months
   - 20,000 GET requests/month

## 5. Safe MCP Server Configurations

### AWS Knowledge Server (100% Free)
```json
{
  "mcpServers": {
    "awslabs.aws-knowledge-mcp-server": {
      "remote": "https://lev1p7o0ii.execute-api.us-west-2.amazonaws.com"
    }
  }
}
```

### AWS Documentation Server (100% Free)
```json
{
  "mcpServers": {
    "awslabs.aws-documentation-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.aws-documentation-mcp-server@latest"],
      "env": {
        "UPDATE_DOCS_ON_STARTUP": "true"
      }
    }
  }
}
```

### Lambda Tool Server (Free Tier)
```json
{
  "mcpServers": {
    "awslabs.lambda-tool-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.lambda-tool-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "mcp-free-tier",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

## 6. Usage Tips to Stay Free

### DO:
- Use read-only operations when possible
- Use AWS Knowledge/Documentation servers for learning
- Set up AWS Budget alerts at $0.01
- Use `--dry-run` flags when available
- Monitor Free Tier dashboard regularly

### DON'T:
- Create resources without understanding costs
- Use production-level configurations
- Leave resources running (especially EC2/RDS)
- Use services not in Free Tier

## 7. Monitoring Your Usage

### Check Free Tier Usage:
```bash
# Check current month costs
aws ce get-cost-and-usage \
  --profile mcp-free-tier \
  --time-period Start=2025-07-01,End=2025-07-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Free Tier Dashboard:
1. Go to AWS Billing Dashboard
2. Click "Free Tier" in left menu
3. Monitor usage percentages

## 8. Emergency Cost Control

If you see unexpected charges:
1. Immediately go to AWS Console
2. Use "Resource Groups" to find all resources
3. Delete/stop all unnecessary resources
4. Check CloudTrail for what created resources

## 9. Best Free Learning Path

1. Start with AWS Knowledge MCP Server (no costs)
2. Use AWS Documentation MCP Server (no costs)
3. Try Lambda Tool with simple functions (free tier)
4. Experiment with DynamoDB read operations (free tier)
5. Use CloudFormation for template validation only

## 10. Sample Free Tier Projects

### Project 1: AWS Learning Assistant
- Use AWS Knowledge server to learn about services
- No AWS costs at all

### Project 2: Lambda Function Explorer
- List and describe existing Lambda functions
- Stay within read-only operations

### Project 3: DynamoDB Schema Analyzer
- Read table schemas and metrics
- No write operations

Remember: The safest approach is to start with documentation and knowledge servers, then gradually explore services with generous free tiers while monitoring usage closely!