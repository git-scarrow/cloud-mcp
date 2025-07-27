# AWS Unified MCP Integration

## Overview
The cloud-ops-api now supports AWS Unified MCP server integration for enhanced cloud resource management, documentation search, and infrastructure as code generation.

## Integration Status
✅ **Completed Integration:**
1. Created `aws_unified_mcp_service.py` - HTTP-based service wrapper for MCP functionality
2. Created `aws_unified_mcp_direct.py` - Direct MCP tool integration
3. Enhanced `real_data_service.py` to use AWS Unified MCP for:
   - Edge device discovery
   - Cost analysis
   - Optimization recommendations
4. Added 8 new API endpoints for MCP functionality

## New API Endpoints

### 1. Search AWS Documentation
```bash
POST /mcp/search
{
  "searchTerm": "EC2 cost optimization",
  "filters": {
    "type": "best-practices"
  }
}
```

### 2. Query Specific Service
```bash
POST /mcp/query
{
  "service": "edge",
  "query": "list devices",
  "options": {"format": "json"}
}
```

### 3. Unified Query
```bash
POST /mcp/unified-query
{
  "query": "AWS free tier usage",
  "services": ["knowledge", "edge"]
}
```

### 4. Get Edge Devices
```bash
GET /mcp/edge/devices
```

### 5. Get Cost Analysis
```bash
GET /mcp/cost-analysis
```

### 6. Generate IaC Templates
```bash
POST /mcp/templates/generate
{
  "type": "terraform",
  "resource": "EC2 instance",
  "options": {
    "instance_type": "t3.micro"
  }
}
```

### 7. Validate Templates
```bash
POST /mcp/templates/validate
{
  "type": "terraform",
  "template": "..."
}
```

### 8. Get Best Practices
```bash
GET /mcp/best-practices/cost-optimization
```

## Architecture

### Direct MCP Access
The AWS Unified MCP server (running on port 3000) uses the MCP protocol, not HTTP REST. We access it through:
1. MCP tools in Claude (e.g., `mcp__aws-unified__query_service`)
2. The server returns markdown-formatted responses
3. We parse these responses to extract structured data

### Current Capabilities
- **Edge Device Monitoring**: Track status of pifive0, piiv, piiv2 devices
- **Cost Analysis**: Monitor AWS free tier usage and edge infrastructure costs
- **Documentation Search**: Search AWS docs and best practices
- **Template Generation**: Generate Terraform/CloudFormation templates
- **Optimization Recommendations**: Get cost optimization suggestions

## Known Issues
1. AWS Unified MCP server returns markdown format, requiring parsing
2. HTTP API endpoints on port 3000 return 404 - must use MCP protocol
3. Edge devices currently show as offline in the test data

## Usage Example
```python
# Get live resources including edge devices
response = requests.get("http://localhost:5001/resources/live")

# Returns:
{
  "success": true,
  "count": 4,
  "resources": [
    {
      "resource_id": "edge-pifive0",
      "provider": "Edge",
      "status": "Offline",
      "cost_monthly": 15.00
    },
    {
      "resource_id": "aws-ec2-i-085d529203426acc2",
      "provider": "AWS",
      "status": "Running",
      "cost_monthly": 8.50
    }
  ]
}
```

## Next Steps
1. Implement real-time edge device metrics collection
2. Add CloudWatch integration for edge devices
3. Create automated cost optimization workflows
4. Build infrastructure templates library