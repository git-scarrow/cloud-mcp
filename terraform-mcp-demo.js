#!/usr/bin/env node

// Demo: Using aws-unified MCP server with Terraform integration
const { spawn } = require('child_process');

console.log('🎯 AWS Unified MCP Server - Terraform Integration Demo');

// Simulate MCP queries that would work with your enhanced server
const terraformQueries = [
  {
    name: 'Generate S3 bucket Terraform',
    query: {
      service: 'terraform',
      query: 'create s3 bucket for edge backups with lifecycle policy',
      options: {
        resource: 's3_bucket',
        format: 'text'
      }
    }
  },
  {
    name: 'Generate DynamoDB table Terraform',
    query: {
      service: 'terraform', 
      query: 'create dynamodb table for edge device state',
      options: {
        resource: 'dynamodb_table',
        format: 'text'
      }
    }
  },
  {
    name: 'Validate existing Terraform',
    query: {
      service: 'terraform',
      query: 'validate terraform configuration',
      options: {
        template: `resource "aws_s3_bucket" "test" {
  bucket = "my-test-bucket"
}`
      }
    }
  },
  {
    name: 'Edge + Terraform unified query',
    query: {
      query: 'show me terraform for my edge infrastructure',
      services: ['terraform', 'edge', 'knowledge']
    }
  }
];

console.log('\n📋 **Terraform Integration Capabilities:**');
console.log('1. Generate Terraform HCL from natural language');
console.log('2. Validate existing Terraform configurations');
console.log('3. Combine edge device data with infrastructure code');
console.log('4. Import existing resources into Terraform');

console.log('\n🎯 **Example MCP Queries:**');
terraformQueries.forEach((example, i) => {
  console.log(`\n${i + 1}. ${example.name}:`);
  console.log('   Query:', JSON.stringify(example.query, null, 2));
});

console.log('\n💡 **Real-world Usage Examples:**');
console.log('- "Generate Terraform for my current AWS setup"');
console.log('- "Create CloudWatch alarms for my Pi devices"');
console.log('- "Show me the cost of my edge infrastructure"');
console.log('- "Validate this Terraform before I apply it"');
console.log('- "Import my existing Lambda function into Terraform"');

console.log('\n🔧 **Integration with your workflow:**');
console.log('1. Use MCP server to generate Terraform');
console.log('2. Save output to .tf files');
console.log('3. Run terraform plan/apply');
console.log('4. Query edge devices + AWS resources together');

console.log('\n📁 **Files created for you:**');
console.log('- /Users/sam/dev/aws/terraform/main.tf - Import existing resources');
console.log('- /Users/sam/dev/aws/terraform/free-tier-equivalent.tf - Script → Terraform');
console.log('- /Users/sam/dev/aws/terraform/import.sh - Import helper script');

console.log('\n🚀 **Next steps:**');
console.log('1. cd /Users/sam/dev/aws/terraform && ./import.sh');
console.log('2. Test MCP server: npm run dev (in mcp server directory)');
console.log('3. Use natural language to generate more Terraform!');

console.log('\n✨ **Your enhanced MCP server now handles:**');
console.log('- AWS knowledge base queries');
console.log('- AWS documentation search');
console.log('- Terraform generation & validation');
console.log('- CloudFormation templates');
console.log('- Edge device monitoring');
console.log('- Unified cross-service queries');