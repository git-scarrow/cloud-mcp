# Deploy Enhanced AWS Unified MCP Server

## Manual Deployment Steps

### 1. Build the Server
```bash
cd /Users/sam/dev/aws/mcp/aws-unified-mcp-server
npm run dev
```

### 2. Test Edge Functionality
Once running, test with these MCP requests:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "query_service",
    "arguments": {
      "service": "edge", 
      "query": "device status"
    }
  }
}
```

### 3. Claude Desktop Configuration
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aws-unified-edge": {
      "command": "node",
      "args": ["/Users/sam/dev/aws/mcp/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_DEFAULT_REGION": "us-east-1"
      }
    }
  }
}
```

### 4. Available Edge Queries

**Device Status:**
- Query: `"device status"` or `"device health"`
- Returns: Status table for pifive0, piiv, piiv2

**Backup Monitoring:**
- Query: `"backup status"`
- Options: `{"deviceId": "pifive0"}` for specific device

**Performance Metrics:**
- Query: `"edge metrics"` or `"performance"`
- Options: `{"deviceId": "piiv", "timeRange": "24h"}`

**Cost Analysis:**
- Query: `"cost optimize"` or `"cost analysis"`
- Returns: Edge vs cloud cost breakdown

**Complete Overview:**
- Query: anything else returns full infrastructure overview

### 5. Test Edge + AWS Unified Queries

```json
{
  "name": "unified_query",
  "arguments": {
    "query": "show me cost optimization for my infrastructure", 
    "services": ["edge", "knowledge", "documentation"]
  }
}
```

## Production Notes

- Current implementation uses mock data for edge devices
- Replace mock data with real DynamoDB/S3 queries for production
- Add AWS credentials via environment variables or IAM roles
- Consider adding edge device SSH connections for live metrics

## Deployment Status
✅ Edge service integrated into MCP server
✅ All 6 services available (knowledge, documentation, terraform, cloudformation, core, edge)
✅ Enhanced unified queries with edge support
⏳ Ready for manual testing