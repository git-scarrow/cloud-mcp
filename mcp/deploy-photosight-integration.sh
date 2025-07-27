#!/bin/bash

# Deploy PhotoSight + Cognitive Load Reducer Integration

set -e

echo "🎯 Deploying PhotoSight Intelligence Integration..."

# Variables
LAMBDA_NAME="mcp-cognitive-load-photosight-processor"
REGION="${AWS_REGION:-us-east-1}"
PROFILE="mcp-cognitive-load"

# Use limited IAM user profile
export AWS_PROFILE=$PROFILE

echo "✅ Using IAM user: $(aws sts get-caller-identity --query 'Arn' --output text)"

# Step 1: Create PhotoSight Intelligence Cache Table
echo "📊 Creating PhotoSight intelligence cache table..."

aws dynamodb create-table \
    --table-name mcp-cognitive-load-photosight-intelligence \
    --attribute-definitions \
        AttributeName=cacheKey,AttributeType=S \
    --key-schema \
        AttributeName=cacheKey,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --tags \
        Key=Project,Value=mcp-cognitive-load \
        Key=Component,Value=photosight-intelligence \
    --region $REGION || echo "Table may already exist"

# Step 2: Package and deploy PhotoSight Lambda function
echo "📦 Packaging PhotoSight Lambda function..."

# Create temporary directory for packaging
mkdir -p /tmp/photosight-lambda
cp /Users/sam/dev/aws/mcp/photosight-enhancement-lambda.js /tmp/photosight-lambda/index.js

# Add Oracle client dependencies (if not using thin client)
cd /tmp/photosight-lambda

cat > package.json << EOF
{
  "name": "photosight-intelligence-lambda",
  "version": "1.0.0",
  "description": "PhotoSight Oracle database intelligence processor",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "oracledb": "^6.0.0"
  }
}
EOF

# Install Oracle DB dependencies for Lambda layer approach
echo "📦 Installing Oracle dependencies..."
npm install oracledb

# Create deployment package
zip -r photosight-lambda.zip index.js package.json node_modules/

# Step 3: Create Lambda function
echo "🔧 Creating PhotoSight Lambda function..."

aws lambda create-function \
    --function-name $LAMBDA_NAME \
    --runtime nodejs18.x \
    --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/mcp-cognitive-load-lambda-role \
    --handler index.handler \
    --zip-file fileb://photosight-lambda.zip \
    --memory-size 256 \
    --timeout 300 \
    --environment "Variables={MCP_TABLE_PREFIX=mcp-cognitive-load,ORACLE_USER=placeholder,ORACLE_PASSWORD=placeholder,ORACLE_CONNECT_STRING=placeholder}" \
    --tags Project=mcp-cognitive-load,Component=photosight-processor \
    --region $REGION || {
        echo "Function exists, updating code..."
        aws lambda update-function-code \
            --function-name $LAMBDA_NAME \
            --zip-file fileb://photosight-lambda.zip \
            --region $REGION
    }

# Step 4: Create EventBridge rule for PhotoSight processing
echo "⏰ Creating PhotoSight processing schedule..."

aws events put-rule \
    --name mcp-cognitive-load-photosight-schedule \
    --description "Process PhotoSight intelligence every 15 minutes" \
    --schedule-expression "rate(15 minutes)" \
    --state ENABLED \
    --region $REGION

# Add Lambda target to the rule
aws events put-targets \
    --rule mcp-cognitive-load-photosight-schedule \
    --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$LAMBDA_NAME" \
    --region $REGION

# Add permission for EventBridge to invoke Lambda
aws lambda add-permission \
    --function-name $LAMBDA_NAME \
    --statement-id photosight-eventbridge-invoke \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:$(aws sts get-caller-identity --query Account --output text):rule/mcp-cognitive-load-photosight-schedule" \
    --region $REGION || echo "Permission may already exist"

# Step 5: Test the integration
echo "🧪 Testing PhotoSight integration..."

PAYLOAD=$(echo '{"processingType": "quality_analysis"}' | base64)
TEST_RESPONSE=$(aws lambda invoke \
    --function-name $LAMBDA_NAME \
    --payload "$PAYLOAD" \
    --region $REGION \
    test-response.json && cat test-response.json && rm test-response.json)

echo "Lambda Response: $TEST_RESPONSE"

# Cleanup temporary files
cd - > /dev/null
rm -rf /tmp/photosight-lambda

echo "✅ PhotoSight Intelligence Integration Deployed!"
echo ""
echo "🎯 What's Now Available:"
echo "   • PhotoSight database analysis every 15 minutes"
echo "   • Cached photo quality insights in DynamoDB"
echo "   • Equipment performance analytics"
echo "   • Processing optimization recommendations"
echo "   • Real-time photography intelligence"
echo ""
echo "📊 Benefits:"
echo "   • Instant photo quality insights (no database queries needed)"
echo "   • Equipment performance tracking and recommendations"
echo "   • Proactive processing optimization suggestions"
echo "   • Historical trend analysis for better decision making"
echo ""
echo "🔧 Next Steps:"
echo "1. Set Oracle connection environment variables:"
echo "   export ORACLE_USER='your_oracle_user'"
echo "   export ORACLE_PASSWORD='your_oracle_password'"
echo "   export ORACLE_CONNECT_STRING='your_oracle_connection_string'"
echo ""
echo "2. Update Lambda environment variables:"
echo "   aws lambda update-function-configuration \\"
echo "     --function-name $LAMBDA_NAME \\"
echo "     --environment Variables=\"{AWS_REGION=$REGION,MCP_TABLE_PREFIX=mcp-cognitive-load,ORACLE_USER=\$ORACLE_USER,ORACLE_PASSWORD=\$ORACLE_PASSWORD,ORACLE_CONNECT_STRING=\$ORACLE_CONNECT_STRING}\" \\"
echo "     --region $REGION"
echo ""
echo "3. Test the enhanced MCP tools in Claude Desktop"
echo ""
echo "💰 Additional Cost: ~\$5-10/month for PhotoSight intelligence processing"