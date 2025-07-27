# AWS Unified MCP Server

A TypeScript MCP server that provides unified query capabilities for all AWS zero-cost MCP servers.

## Overview

This server wraps the following zero-cost AWS MCP servers with standardized query interfaces:

1. **AWS Knowledge Server** - Real-time AWS documentation and best practices
2. **AWS Documentation Server** - Local AWS documentation search
3. **Terraform Server** - Generate and validate Terraform configurations
4. **CloudFormation Server** - Generate and validate CloudFormation templates
5. **Core MCP Server** - Utility functions (JSON/YAML, encoding, generation)

## Features

- **Unified Query Interface**: Single API to query all services
- **Multi-Service Search**: Search across multiple services simultaneously
- **Template Generation**: Generate IaC templates for AWS resources
- **Validation Tools**: Validate CloudFormation and Terraform syntax
- **Zero AWS Costs**: All operations are local or use free remote endpoints

## Installation

```bash
cd aws-unified-mcp-server
npm install
npm run build
```

## Configuration

### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "aws-unified": {
      "command": "node",
      "args": ["/path/to/aws-unified-mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "MCP_SSH_POOL_SIZE": "3",
        "MCP_SSH_TIMEOUT": "8000"
      }
    }
  }
}
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# SSH Process Pool Configuration
MCP_SSH_POOL_SIZE=3      # Max concurrent SSH connections (default: 3)
MCP_SSH_TIMEOUT=8000     # SSH timeout in milliseconds (default: 8000)

# Server Configuration
MCP_HTTP_PORT=3000       # HTTP server port
RATE_LIMIT_MAX=100       # Max requests per minute

# Security
JWT_SECRET=your-secret   # JWT signing secret
PIPEDREAM_API_KEY=key    # API key for Pipedream workflows
```

For a complete list of configuration options, see `.env.example`.

## Available Tools

### 1. query_service
Query a specific AWS service:

```typescript
{
  "service": "knowledge",  // knowledge | documentation | terraform | cloudformation | core
  "query": "How do I create an S3 bucket?",
  "options": {
    "format": "markdown",
    "maxResults": 10
  }
}
```

### 2. unified_query
Query multiple services at once:

```typescript
{
  "query": "S3 bucket best practices",
  "services": ["knowledge", "documentation"],  // optional, defaults to all
  "options": {
    "format": "text"
  }
}
```

### 3. search_aws
Search across AWS knowledge bases:

```typescript
{
  "searchTerm": "lambda cold start",
  "filters": {
    "service": "Lambda",
    "type": "best-practices"
  }
}
```

### 4. generate_template
Generate infrastructure templates:

```typescript
{
  "type": "terraform",  // terraform | cloudformation
  "resource": "s3_bucket",
  "options": {
    "variant": "withVersioning"
  }
}
```

### 5. validate_template
Validate IaC templates:

```typescript
{
  "type": "cloudformation",
  "template": "Your CloudFormation YAML/JSON here"
}
```

## Usage Examples

### Basic Queries

```javascript
// Query AWS Knowledge
await query_service({
  service: "knowledge",
  query: "What are S3 best practices?"
});

// Search documentation
await query_service({
  service: "documentation",
  query: "EC2 instance types"
});

// Generate Terraform config
await generate_template({
  type: "terraform",
  resource: "lambda_function"
});
```

### Advanced Usage

```javascript
// Multi-service search
await unified_query({
  query: "DynamoDB partition key design",
  services: ["knowledge", "documentation"],
  options: { format: "markdown" }
});

// Validate CloudFormation
await validate_template({
  type: "cloudformation",
  template: "Your template here..."
});

// Core utilities
await query_service({
  service: "core",
  query: "convert json to yaml",
  options: { format: "json" }
});
```

## Service Capabilities

### AWS Knowledge Server
- Best practices and recommendations
- Architecture guidance
- API documentation references
- Getting started guides
- What's new in AWS

### AWS Documentation Server
- Service-specific documentation
- API references
- User guides and tutorials
- Code examples
- FAQ searches

### Terraform Server
- Generate Terraform configurations
- Validate HCL syntax
- Resource explanations
- CloudFormation to Terraform conversion tips

### CloudFormation Server
- Generate CloudFormation templates
- Validate template syntax
- Explain intrinsic functions
- Resource type documentation

### Core MCP Server
- JSON/YAML formatting and conversion
- Base64 encoding/decoding
- UUID generation
- Hash generation
- String manipulation utilities

## Free Tier Tips

All operations in this server are designed for zero AWS costs:

1. **No AWS Credentials Required** - Most operations work without any AWS account
2. **Local Processing** - Template generation and validation happen locally
3. **Free Remote APIs** - Knowledge server uses free AWS endpoints
4. **Read-Only Operations** - When credentials are used, only read operations

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## License

Apache 2.0