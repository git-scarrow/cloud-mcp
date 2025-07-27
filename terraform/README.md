# Terraform for Edge Infrastructure

This directory contains Terraform configurations to manage your existing AWS edge infrastructure.

## Quick Start

```bash
# Import existing resources
./import.sh

# See what Terraform manages
terraform show

# Plan changes
terraform plan

# Apply changes (be careful!)
terraform apply
```

## Files

- **main.tf** - Core infrastructure (S3, DynamoDB, Lambda, IAM)
- **free-tier-equivalent.tf** - Additional resources from your bash scripts
- **outputs.tf** - Important values to reference
- **terraform.tfvars** - Variable values
- **import.sh** - Script to import existing AWS resources

## What This Manages

### Existing Resources (imported)
- ✅ S3 bucket: `edge-backup-picluster-free`
- ✅ DynamoDB table: `edge-device-state`
- ✅ Lambda function: `edge-data-processor`
- ✅ IAM role: `lambda-edge-processor-role`
- ✅ CloudWatch logs: `/aws/lambda/edge-data-processor`

### New Resources (when applied)
- 🆕 SNS topic for edge alerts
- 🆕 CloudWatch dashboard for monitoring
- 🆕 CloudWatch alarms for high CPU/memory
- 🆕 Corrected DynamoDB table with proper schema
- 🆕 Updated Lambda function with environment variables

## Integration with MCP Server

Your aws-unified MCP server can now:

```bash
# Generate Terraform
curl -X POST http://localhost:3000 -d '{
  "service": "terraform",
  "query": "create s3 bucket with versioning"
}'

# Validate Terraform
curl -X POST http://localhost:3000 -d '{
  "service": "terraform", 
  "query": "validate my terraform configuration"
}'

# Combined edge + infrastructure queries
curl -X POST http://localhost:3000 -d '{
  "services": ["edge", "terraform"],
  "query": "show infrastructure for my edge devices"
}'
```

## Safety Notes

⚠️ **Before running terraform apply:**
1. Review `terraform plan` output carefully
2. Ensure you want to create new resources
3. Consider costs (should stay within free tier)

✅ **Safe operations:**
- `terraform show` - see current state
- `terraform plan` - preview changes
- `terraform validate` - check syntax

## Free Tier Optimization

All resources are configured to stay within AWS free tier:
- S3: Lifecycle rules delete old files after 7 days
- Lambda: 128MB memory, minimal invocations
- DynamoDB: Pay-per-request billing
- CloudWatch: Limited to essential metrics only

## Troubleshooting

**Import fails?**
- Check AWS credentials: `aws sts get-caller-identity`
- Verify resource names match exactly
- Run `terraform init` first

**Plan shows unexpected changes?**
- Compare Terraform config with actual AWS console
- Some attributes may need adjustment
- Use `terraform refresh` to sync state