# AWS Unified MCP Server - Use Cases & Examples

## 🏠 Edge Device Management

### Monitor Pi Cluster Health
```json
{
  "service": "edge",
  "query": "device status"
}
```
**Returns**: Real-time status of pifive0, piiv, piiv2 with uptime and backup status

### Check Specific Device
```json
{
  "service": "edge",
  "query": "backup status",
  "options": {
    "deviceId": "pifive0"
  }
}
```
**Returns**: Backup history and sync status for master node

### Analyze Edge Performance
```json
{
  "service": "edge",
  "query": "edge metrics",
  "options": {
    "timeRange": "24h"
  }
}
```
**Returns**: CPU, memory, network metrics for all edge devices

## 🏗️ Infrastructure as Code

### Generate S3 Bucket for Edge Backups
```json
{
  "service": "terraform",
  "query": "create s3 bucket with lifecycle policy for edge backups"
}
```
**Returns**: Complete Terraform code with 7-day retention policy

### Create DynamoDB for Edge State
```json
{
  "service": "terraform",
  "query": "create dynamodb table for device metrics"
}
```
**Returns**: Pay-per-request DynamoDB table configuration

### CloudFormation Alternative
```json
{
  "service": "cloudformation",
  "query": "generate lambda function for edge data processing"
}
```
**Returns**: CloudFormation template with IAM roles and triggers

## 💰 Cost Optimization

### Unified Cost Analysis
```json
{
  "query": "analyze cost optimization for my edge infrastructure",
  "services": ["edge", "knowledge", "documentation"]
}
```
**Returns**: Combined analysis of edge costs vs cloud costs with recommendations

### Free Tier Usage Check
```json
{
  "service": "edge",
  "query": "cost optimize"
}
```
**Returns**: Current free tier usage and optimization suggestions

## 🔍 AWS Knowledge & Documentation

### Service-Specific Help
```json
{
  "service": "documentation",
  "query": "s3 lifecycle policies best practices"
}
```
**Returns**: AWS documentation on S3 lifecycle management

### Search Across AWS
```json
{
  "searchTerm": "edge computing lambda",
  "filters": {
    "service": "Lambda",
    "type": "guide"
  }
}
```
**Returns**: Relevant AWS guides for edge computing with Lambda

## 🔧 Troubleshooting & Validation

### Validate Terraform Configuration
```json
{
  "type": "terraform",
  "template": "resource \"aws_s3_bucket\" \"test\" {\n  bucket = \"my-bucket\"\n}"
}
```
**Returns**: Validation results and improvement suggestions

### Debug Edge Issues
```json
{
  "query": "why is piiv2 degraded",
  "services": ["edge", "knowledge"]
}
```
**Returns**: Possible causes and troubleshooting steps

## 🚀 Real-World Scenarios

### 1. **Morning Health Check**
```json
{
  "query": "show me edge cluster health and any overnight issues",
  "services": ["edge", "core"]
}
```

### 2. **Deploy New Edge Service**
```json
{
  "query": "generate terraform for edge monitoring with cloudwatch alarms",
  "services": ["terraform", "edge", "knowledge"]
}
```

### 3. **Cost Alert Response**
```json
{
  "query": "my AWS bill increased, analyze edge vs cloud usage",
  "services": ["edge", "knowledge", "documentation"]
}
```

### 4. **Infrastructure Documentation**
```json
{
  "service": "terraform",
  "query": "explain my current edge infrastructure setup"
}
```

### 5. **Disaster Recovery Planning**
```json
{
  "query": "create backup and recovery plan for edge devices",
  "services": ["edge", "terraform", "documentation"]
}
```

## 🎪 Advanced Use Cases

### Multi-Service Architecture Query
```json
{
  "query": "design high-availability edge architecture with AWS integration",
  "services": ["edge", "terraform", "cloudformation", "knowledge"],
  "options": {
    "format": "markdown",
    "maxResults": 10
  }
}
```

### Compliance & Security Audit
```json
{
  "query": "security best practices for edge devices storing sensitive data",
  "services": ["documentation", "knowledge", "edge"]
}
```

### Performance Optimization
```json
{
  "query": "optimize data sync between edge devices and S3",
  "services": ["edge", "knowledge", "terraform"],
  "options": {
    "deviceIds": ["pifive0", "piiv"],
    "timeRange": "7d"
  }
}
```

## 🤖 Integration with Claude Desktop

Once configured in Claude Desktop, you can use natural language:

- "Check my Pi cluster status"
- "Generate Terraform for edge backup system"
- "Why is my edge device offline?"
- "Optimize my AWS costs"
- "Create CloudWatch alarms for high CPU on edge devices"

## 📊 Batch Operations

### Weekly Infrastructure Review
```json
{
  "query": "weekly infrastructure review",
  "services": ["edge", "terraform", "knowledge"],
  "options": {
    "format": "markdown",
    "timeRange": "7d"
  }
}
```

### Migration Planning
```json
{
  "query": "plan migration from bash scripts to terraform",
  "services": ["terraform", "core", "documentation"]
}
```

## 💡 Tips

1. **Combine Services**: Use unified queries for comprehensive answers
2. **Use Options**: Leverage deviceIds, timeRange, format for precise results
3. **Chain Queries**: Use output from one query as input for another
4. **Natural Language**: The MCP server understands context and intent
5. **Mock to Real**: Replace mock edge data with real DynamoDB queries later