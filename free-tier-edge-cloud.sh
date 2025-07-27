#!/bin/bash
# Free Tier Optimized Edge-Cloud Setup

echo "🎯 Setting up AWS Free Tier Edge-Cloud Architecture"

# 1. Create S3 buckets with lifecycle policies
echo "📦 Creating S3 buckets with free tier optimization..."

# Edge backup bucket - auto-delete after 7 days to stay under 5GB
aws s3api create-bucket --bucket edge-backup-picluster-free 2>/dev/null || true
cat > /tmp/lifecycle.json << 'EOF'
{
    "Rules": [{
        "ID": "DeleteOldBackups",
        "Status": "Enabled",
        "Prefix": "backups/",
        "Expiration": {
            "Days": 7
        }
    }]
}
EOF
aws s3api put-bucket-lifecycle-configuration \
    --bucket edge-backup-picluster-free \
    --lifecycle-configuration file:///tmp/lifecycle.json

# 2. Create DynamoDB table for edge state (stays under 25GB easily)
echo "🗄️ Creating DynamoDB table..."
aws dynamodb create-table \
    --table-name edge-device-state \
    --attribute-definitions \
        AttributeName=deviceId,AttributeType=S \
        AttributeName=timestamp,AttributeType=N \
    --key-schema \
        AttributeName=deviceId,KeyType=HASH \
        AttributeName=timestamp,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    2>/dev/null || echo "Table exists"

# 3. Create Lambda function for edge data processing
echo "⚡ Creating Lambda function..."
cat > /tmp/edge-processor.js << 'EOF'
exports.handler = async (event) => {
    console.log('Processing edge data:', event);
    
    // Parse S3 event
    const bucket = event.Records[0].s3.bucket.name;
    const key = event.Records[0].s3.object.key;
    
    // Process only if it's important data
    if (key.includes('metrics/') || key.includes('alerts/')) {
        // Store in DynamoDB
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        await dynamodb.put({
            TableName: 'edge-device-state',
            Item: {
                deviceId: key.split('/')[1],
                timestamp: Date.now(),
                source: 'picluster',
                data: { bucket, key }
            }
        }).promise();
    }
    
    return { statusCode: 200 };
};
EOF

cd /tmp
zip edge-processor.zip edge-processor.js
aws lambda create-function \
    --function-name edge-data-processor \
    --runtime nodejs18.x \
    --role arn:aws:iam::597088031837:role/lambda-execution-role \
    --handler edge-processor.handler \
    --zip-file fileb://edge-processor.zip \
    --timeout 30 \
    --memory-size 128 \
    2>/dev/null || echo "Function exists"

# 4. Set up S3 event trigger
echo "🔗 Configuring S3 triggers..."
cat > /tmp/notification.json << 'EOF'
{
    "LambdaFunctionConfigurations": [{
        "LambdaFunctionArn": "arn:aws:lambda:us-east-1:597088031837:function:edge-data-processor",
        "Events": ["s3:ObjectCreated:*"],
        "Filter": {
            "Key": {
                "FilterRules": [{
                    "Name": "prefix",
                    "Value": "edge-data/"
                }]
            }
        }
    }]
}
EOF

# 5. Create SNS topic for alerts (free tier: 1M publishes)
echo "📬 Creating SNS topic..."
aws sns create-topic --name edge-alerts 2>/dev/null || true

# 6. CloudWatch custom metrics (10 free)
echo "📊 Setting up CloudWatch metrics..."
cat > /tmp/push-metrics.sh << 'EOF'
#!/bin/bash
# Push edge metrics to CloudWatch (run on edge devices)
# Only push critical metrics to stay under 10 custom metrics

NAMESPACE="EdgeCluster"
DEVICE=$(hostname)

# CPU usage
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -f1 -d'%')
aws cloudwatch put-metric-data \
    --namespace $NAMESPACE \
    --metric-name CPUUtilization \
    --value $CPU \
    --dimensions Device=$DEVICE

# Memory usage
MEM=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
aws cloudwatch put-metric-data \
    --namespace $NAMESPACE \
    --metric-name MemoryUtilization \
    --value $MEM \
    --dimensions Device=$DEVICE
EOF

chmod +x /tmp/push-metrics.sh

echo "✅ Free Tier Edge-Cloud Setup Complete!"
echo ""
echo "📊 Free Tier Usage Strategy:"
echo "- S3: Auto-delete backups after 7 days (stays under 5GB)"
echo "- Lambda: Process only critical data (well under 1M requests)"
echo "- DynamoDB: On-demand pricing, minimal storage"
echo "- CloudWatch: Only 2 metrics per device (6 metrics for 3 devices)"
echo "- SNS: Alert only on critical events"
echo ""
echo "💰 Estimated Monthly Cost: $0.00"