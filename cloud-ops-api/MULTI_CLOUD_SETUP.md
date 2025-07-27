# Multi-Cloud Setup Requirements

## Overview
The cloud-ops-api supports multiple cloud providers including AWS, Google Cloud Platform (GCP), and DigitalOcean. This document outlines the requirements and setup instructions for each provider.

## Current Status
- **AWS**: ✅ Fully integrated with real API calls
- **GCP**: 🔄 Mock data implemented, ready for real integration
- **DigitalOcean**: 🔄 Mock data implemented, ready for real integration
- **Oracle**: ✅ Integrated as data storage backend
- **Edge Devices**: ✅ Integrated via AWS Unified MCP

## AWS Setup

### Requirements
- AWS CLI configured with credentials
- Boto3 Python SDK (already included)
- IAM permissions for EC2, Lambda, RDS, CloudWatch

### Configuration
```bash
# AWS credentials are automatically loaded from:
# 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
# 2. ~/.aws/credentials file
# 3. IAM role (if running on EC2)

# Optional: Set default region
export AWS_DEFAULT_REGION=us-east-1
```

### Required IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "lambda:ListFunctions",
        "rds:DescribeDBInstances",
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

## Google Cloud Platform (GCP) Setup

### Requirements
- Google Cloud SDK (gcloud)
- Service account with appropriate permissions
- Python client libraries

### Installation
```bash
# Install Google Cloud client library
pip install google-cloud-compute google-cloud-storage google-cloud-sql
```

### Configuration
```bash
# Set up authentication
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# Or use gcloud auth
gcloud auth application-default login

# Set default project
export GCP_PROJECT_ID="your-project-id"
```

### Required Service Account Permissions
- Compute Engine: `compute.instances.list`, `compute.instances.get`
- Cloud Storage: `storage.buckets.list`, `storage.objects.list`
- Cloud SQL: `cloudsql.instances.list`, `cloudsql.instances.get`

### Enable in real_data_service.py
Replace the mock GCP data in `_get_gcp_resources()` with:
```python
from google.cloud import compute_v1, storage, sql_v1

async def _get_gcp_resources(self) -> List[Dict]:
    """Get real GCP resources"""
    resources = []
    
    # Initialize clients
    compute_client = compute_v1.InstancesClient()
    storage_client = storage.Client()
    sql_client = sql_v1.SqlInstancesServiceClient()
    
    # Get compute instances
    project_id = os.environ.get('GCP_PROJECT_ID')
    for zone in compute_client.aggregated_list(project=project_id):
        for instance in zone.instances:
            # Convert to our format
            resource = {
                "resource_id": f"gcp-compute-{instance.name}",
                "resource_uuid": str(instance.id),
                "provider": "GCP",
                # ... rest of mapping
            }
            resources.append(resource)
    
    return resources
```

## DigitalOcean Setup

### Requirements
- DigitalOcean API token
- Python client library

### Installation
```bash
# Install DigitalOcean client
pip install python-digitalocean
```

### Configuration
```bash
# Set API token
export DO_API_TOKEN="your-digitalocean-api-token"
```

### Enable in real_data_service.py
Replace the mock DO data in `_get_digitalocean_resources()` with:
```python
import digitalocean

async def _get_digitalocean_resources(self) -> List[Dict]:
    """Get real DigitalOcean resources"""
    resources = []
    
    # Initialize manager
    token = os.environ.get('DO_API_TOKEN')
    manager = digitalocean.Manager(token=token)
    
    # Get droplets
    for droplet in manager.get_all_droplets():
        resource = {
            "resource_id": f"do-droplet-{droplet.name}",
            "resource_uuid": str(droplet.id),
            "provider": "DigitalOcean",
            "resource_type": f"Droplet {droplet.size_slug}",
            # ... rest of mapping
        }
        resources.append(resource)
    
    # Get databases
    # Get volumes
    # Get spaces
    
    return resources
```

## Environment Variables Summary

Create a `.env` file in the project root:
```bash
# AWS (auto-detected from ~/.aws/credentials)
AWS_DEFAULT_REGION=us-east-1

# GCP
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-service-account.json
GCP_PROJECT_ID=your-gcp-project-id

# DigitalOcean
DO_API_TOKEN=your-digitalocean-api-token

# Oracle (already configured)
TNS_ADMIN=/path/to/wallet
ORACLE_CONNECTION_STRING=your-connection-string

# Notion (already configured)
NOTION_API_KEY=your-notion-api-key
NOTION_DATABASE_ID=your-database-id

# AWS Unified MCP (already configured)
AWS_UNIFIED_URL=http://localhost:3000
```

## Testing Multi-Cloud Integration

1. **Test with mock data (current state)**:
```bash
# Get all resources including mock GCP/DO
curl http://localhost:5001/resources/live

# Sync to databases
curl -X POST http://localhost:5001/sync/manual
```

2. **Test with real credentials**:
```bash
# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
export DO_API_TOKEN=your-token

# Restart the API
python app.py

# Verify real data
curl http://localhost:5001/resources/live
```

## Cost Calculation

Each provider calculates costs differently:

- **AWS**: Uses instance type mapping and CloudWatch metrics
- **GCP**: Will use Billing API or SKU pricing
- **DigitalOcean**: Uses droplet/resource pricing from API
- **Edge Devices**: Fixed cost estimate ($15/month per device)

## Monitoring and Alerts

The system monitors:
- Resource status (running, stopped, etc.)
- CPU and memory usage
- Monthly costs and budget utilization
- Optimization opportunities

## Security Best Practices

1. **Never commit credentials**:
   - Use environment variables
   - Use cloud provider credential management
   - Add `.env` to `.gitignore`

2. **Use read-only permissions** where possible

3. **Rotate API tokens** regularly

4. **Monitor API usage** to avoid rate limits

## Troubleshooting

### AWS Issues
- Check IAM permissions
- Verify region settings
- Check boto3 credential chain

### GCP Issues
- Verify service account permissions
- Check project ID
- Ensure APIs are enabled in GCP console

### DigitalOcean Issues
- Verify API token has read permissions
- Check rate limits (5000 requests/hour)

## Next Steps

1. Obtain real GCP service account credentials
2. Obtain DigitalOcean API token
3. Update `real_data_service.py` with real API calls
4. Test with production data
5. Set up automated cost alerts