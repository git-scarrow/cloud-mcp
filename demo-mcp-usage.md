# AWS Unified MCP Server - Live Demo

## 1. Edge Device Monitoring

### Check Current Status
```
Query: "Show me the status of my edge devices"
```

**Live Response:**
- **pifive0** 🟡 Degraded - Last backup 3 hours ago
- **piiv** 🟡 Degraded - Last backup 3 hours ago  
- **piiv2** 🟢 Online - Last backup 31 minutes ago

### View Real-Time Metrics
```
Query: "Show me CPU and memory usage for my Pi devices"
```

**Live CloudWatch Data:**
- pifive0: CPU 0.0%, Memory 41.8%
- piiv: CPU 33.3%, Memory 17.7%
- piiv2: CPU 10.0%, Memory 26.8%

## 2. Infrastructure as Code Generation

### Create S3 Bucket
```
Query: "Generate Terraform for an S3 bucket with versioning"
```

**Generated:**
```hcl
resource "aws_s3_bucket" "example" {
  bucket = "my-bucket-name"
}

resource "aws_s3_bucket_versioning" "example" {
  bucket = aws_s3_bucket.example.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

### Validate Terraform
```
Query: "Validate this Terraform configuration"
```

**Real HCL Parser Results:**
- ✅ Valid syntax
- ⚠️ Warning: No tags found - consider adding for resource management
- 💡 Suggestion: Add lifecycle rules for cost optimization

## 3. AWS Documentation Lookup

### Service Documentation
```
Query: "How do I use S3?"
```

**Direct Links Provided:**
- 📚 [User Guide](https://docs.aws.amazon.com/s3/latest/userguide/)
- 🔧 [API Reference](https://docs.aws.amazon.com/s3/latest/API/)
- ✨ [Best Practices](https://docs.aws.amazon.com/s3/latest/userguide/security-best-practices.html)
- 💰 [Pricing](https://aws.amazon.com/s3/pricing/)

### Free Tier Information
```
Query: "What's included in AWS free tier?"
```

**Current Limits:**
- EC2: 750 hours t2.micro/t3.micro per month
- S3: 5GB storage, 20,000 GET requests
- Lambda: 1M requests, 400,000 GB-seconds
- DynamoDB: 25GB storage, 25 RCU/WCU

## 4. Cost Analysis

### Current Usage
```
Query: "Am I within free tier limits?"
```

**Real S3 Analysis:**
- Using 0.9KB of 5GB free (0.0000%)
- Well within all free tier limits
- Estimated monthly cost: $0

## 5. Multi-Service Queries

### Complex Question
```
Query: "How do I set up monitoring for my edge devices with CloudWatch?"
```

**Comprehensive Response:**
1. Metrics are already being pushed every 5 minutes
2. View in CloudWatch console under "EdgeDevices" namespace
3. Create alarms for high CPU/memory usage
4. Set up SNS notifications for alerts

## Real-Time Demo Commands

### 1. Check Edge Health
```bash
# In Claude Desktop
"What's the health of my Pi cluster?"
```

### 2. Generate Infrastructure
```bash
# In Claude Desktop
"Create Terraform for edge backup infrastructure"
```

### 3. Troubleshoot Issues
```bash
# In Claude Desktop
"Why is pifive0 showing as degraded?"
```

### 4. Optimize Costs
```bash
# In Claude Desktop
"How can I reduce my AWS costs?"
```

## Live System Metrics

### Current Edge Infrastructure
- **Devices**: 3 Raspberry Pi units
- **Backups**: Automated to S3 every 6 hours
- **Metrics**: CloudWatch updates every 5 minutes
- **Cost**: $0 (within free tier)

### AWS Resource Usage
- **S3 Objects**: 4 backup files
- **S3 Storage**: 0.9KB total
- **CloudWatch Metrics**: 6 custom metrics
- **Lambda**: Minimal usage

## Integration with Claude Desktop

Once configured, you can ask natural language questions:

1. **Operations**: "Deploy edge monitoring to my cluster"
2. **Troubleshooting**: "Debug high memory usage on piiv"
3. **Planning**: "Design disaster recovery for edge devices"
4. **Learning**: "Explain edge computing best practices"

The MCP server translates these into actual AWS API calls, file operations, and real-time data queries!