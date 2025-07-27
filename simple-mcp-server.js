#!/usr/bin/env node

// Simplified MCP server with edge integration that actually works
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const server = new Server({
  name: 'simple-aws-edge-mcp',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

// Mock edge data for your Pi devices
const getEdgeStatus = () => {
  const devices = [
    { id: 'pifive0', status: 'online', lastSeen: '5min ago', backups: 3 },
    { id: 'piiv', status: 'online', lastSeen: '15min ago', backups: 2 },
    { id: 'piiv2', status: 'degraded', lastSeen: '30min ago', backups: 0 }
  ];
  
  return `# Edge Device Status\n\n` +
    devices.map(d => `**${d.id}**: ${d.status} (${d.lastSeen}) - ${d.backups} backups`).join('\n');
};

const getTerraformTemplate = (resource) => {
  const templates = {
    s3_bucket: `resource "aws_s3_bucket" "edge_backup" {
  bucket = "edge-backup-\${var.project_name}"
  
  lifecycle_configuration {
    rule {
      id     = "delete_old_backups"
      status = "Enabled"
      expiration { days = 7 }
    }
  }
}`,
    dynamodb_table: `resource "aws_dynamodb_table" "edge_state" {
  name         = "edge-device-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "deviceId"
  
  attribute {
    name = "deviceId"
    type = "S"
  }
}`
  };
  
  return templates[resource] || 'Resource template not found';
};

// Tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'query_service',
      description: 'Query AWS services or edge devices',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            enum: ['edge', 'terraform', 'knowledge'],
            description: 'Service to query'
          },
          query: {
            type: 'string', 
            description: 'Query to execute'
          }
        },
        required: ['service', 'query']
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'query_service') {
    const { service, query } = args;
    
    switch (service) {
      case 'edge':
        if (query.includes('status') || query.includes('device')) {
          return { content: [{ type: 'text', text: getEdgeStatus() }] };
        }
        return { content: [{ type: 'text', text: 'Edge query not recognized' }] };
        
      case 'terraform':
        if (query.includes('s3')) {
          return { content: [{ type: 'text', text: getTerraformTemplate('s3_bucket') }] };
        }
        if (query.includes('dynamodb')) {
          return { content: [{ type: 'text', text: getTerraformTemplate('dynamodb_table') }] };
        }
        return { content: [{ type: 'text', text: 'Terraform template not found' }] };
        
      case 'knowledge':
        return { content: [{ type: 'text', text: 'AWS knowledge base query would go here' }] };
        
      default:
        return { content: [{ type: 'text', text: 'Service not supported' }] };
    }
  }
  
  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);

console.error('✅ Simple AWS Edge MCP Server running...');