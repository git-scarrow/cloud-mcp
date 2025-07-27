#!/bin/bash

# Import existing AWS resources into Terraform state
set -e

echo "🔄 Importing existing AWS resources into Terraform..."

# Initialize Terraform
terraform init

# Create the Lambda zip file first (needed for import)
cd /Users/sam/dev/aws
if [ -f edge-processor-simple.zip ]; then
    cp edge-processor-simple.zip terraform/edge-processor.zip
else
    echo "⚠️  Creating placeholder zip file for Lambda import..."
    echo 'exports.handler = async () => ({ statusCode: 200 });' > /tmp/temp.js
    cd /tmp && zip -q terraform/edge-processor.zip temp.js
    cd /Users/sam/dev/aws/terraform
fi

# Import resources
echo "📦 Importing S3 bucket..."
terraform import aws_s3_bucket.edge_backup edge-backup-picluster-free

echo "📊 Importing DynamoDB table..."
terraform import aws_dynamodb_table.edge_device_state edge-device-state

echo "👤 Importing IAM role..."
terraform import aws_iam_role.lambda_edge_processor_role lambda-edge-processor-role

echo "⚡ Importing Lambda function..."
terraform import aws_lambda_function.edge_processor edge-data-processor

echo "📝 Importing CloudWatch log group..."
terraform import aws_cloudwatch_log_group.edge_processor_logs /aws/lambda/edge-data-processor

echo "✅ Import complete! Running terraform plan to verify..."
terraform plan

echo ""
echo "🎯 Next steps:"
echo "1. Review the plan output above"
echo "2. Run 'terraform apply' to sync state"
echo "3. Your infrastructure is now managed by Terraform!"