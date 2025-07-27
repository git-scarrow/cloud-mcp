# Claude Desktop Configuration for AWS Unified MCP Server

## Configuration Steps

### 1. Locate Claude Desktop Configuration

The configuration file is located at:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Add MCP Server Configuration

Edit the configuration file to add the AWS Unified MCP server:

```json
{
  "mcpServers": {
    "aws-unified": {
      "command": "node",
      "args": ["/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "AWS_REGION": "us-east-1",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. Alternative NPM Configuration

If you've published the server to npm:

```json
{
  "mcpServers": {
    "aws-unified": {
      "command": "npx",
      "args": ["-y", "@your-org/aws-unified-mcp-server"],
      "env": {
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

### 4. Full Configuration Example

Here's a complete configuration with multiple servers:

```json
{
  "mcpServers": {
    "aws-unified": {
      "command": "node",
      "args": ["/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "AWS_REGION": "us-east-1",
        "EDGE_DEVICES": "pifive0,piiv,piiv2",
        "S3_BUCKET": "edge-backup-picluster-free",
        "DYNAMODB_TABLE": "edge-device-metrics-free"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/sam/dev"]
    }
  }
}
```

### 5. Environment Variables

You can pass environment variables for AWS credentials and configuration:

```json
{
  "mcpServers": {
    "aws-unified": {
      "command": "node",
      "args": ["/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_PROFILE": "default",
        "EDGE_SYNC_ENABLED": "true",
        "COST_OPTIMIZATION_MODE": "true",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Verification Steps

### 1. Restart Claude Desktop
After saving the configuration, completely quit and restart Claude Desktop.

### 2. Check Server Connection
In Claude Desktop, you should see the MCP server icon indicating it's connected.

### 3. Test Queries
Try these natural language queries in Claude:

- "Show me the status of my edge devices"
- "Generate Terraform for an S3 bucket"
- "Check my AWS free tier usage"
- "How do I set up CloudWatch monitoring for Pi devices?"

### 4. Troubleshooting

If the server doesn't connect:

1. **Check logs**: Look for errors in Claude Desktop's developer console
2. **Verify path**: Ensure the path to `index.js` is correct
3. **Test manually**: Run the server standalone first:
   ```bash
   cd /Users/sam/dev/aws/mcp/aws-unified-mcp-server
   npm start
   ```
4. **Permissions**: Ensure the script is executable
5. **Dependencies**: Make sure all npm packages are installed

## Advanced Configuration

### Custom Parameters

```json
{
  "mcpServers": {
    "aws-unified": {
      "command": "node",
      "args": [
        "/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js",
        "--max-tokens", "20000",
        "--cache-ttl", "300"
      ],
      "env": {
        "AWS_REGION": "us-east-1",
        "ENABLE_CACHING": "true",
        "MOCK_MODE": "false"
      }
    }
  }
}
```

### Multiple Regions

```json
{
  "mcpServers": {
    "aws-unified-east": {
      "command": "node",
      "args": ["/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "AWS_REGION": "us-east-1",
        "SERVER_NAME": "AWS East"
      }
    },
    "aws-unified-west": {
      "command": "node",
      "args": ["/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "AWS_REGION": "us-west-2",
        "SERVER_NAME": "AWS West"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can use natural language in Claude Desktop:

### Edge Monitoring
- "What's the status of pifive0?"
- "Show me backup history for all edge devices"
- "Are there any degraded edge devices?"

### Infrastructure Generation
- "Create Terraform for edge monitoring setup"
- "Generate CloudFormation for Lambda edge processor"
- "Build infrastructure for hybrid edge-cloud architecture"

### Cost Analysis
- "Analyze my edge vs cloud costs"
- "Am I within AWS free tier limits?"
- "Optimize costs for edge backup storage"

### Multi-Service Queries
- "How do I monitor edge devices with CloudWatch?"
- "Best practices for edge data synchronization"
- "Create a disaster recovery plan for my Pi cluster"

## Security Considerations

1. **AWS Credentials**: Use AWS profiles or IAM roles instead of hardcoding credentials
2. **Least Privilege**: Create a read-only IAM role for the MCP server
3. **Environment Isolation**: Use separate configurations for dev/prod
4. **Audit Logging**: Enable CloudTrail for API calls made by the MCP server

## Next Steps

1. Install the configuration
2. Restart Claude Desktop
3. Test with simple queries
4. Gradually explore advanced features
5. Customize environment variables for your setup
6. Consider creating wrapper scripts for different environments