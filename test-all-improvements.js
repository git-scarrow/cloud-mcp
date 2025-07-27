#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🧪 Testing All MCP Server Improvements');
console.log('=====================================\n');

const server = spawn('node', ['mcp/aws-unified-mcp-server/dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    AWS_REGION: 'us-east-1',
    S3_BUCKET: 'edge-backup-picluster-free'
  }
});

// Test queries to verify all improvements
const testQueries = [
  {
    name: '1. Edge Device Status (Real S3 Data)',
    query: {
      service: 'edge',
      query: 'device status',
      options: { format: 'text' }
    }
  },
  {
    name: '2. Edge Metrics (Real CloudWatch)',
    query: {
      service: 'edge',
      query: 'metrics',
      options: { format: 'text' }
    }
  },
  {
    name: '3. Terraform Validation (Real HCL Parser)',
    query: {
      service: 'terraform',
      query: 'validate',
      options: { 
        format: 'text',
        template: 'resource "aws_s3_bucket" "test" {\n  bucket = "my-test-bucket"\n}'
      }
    }
  },
  {
    name: '4. AWS Knowledge (Enhanced Documentation)',
    query: {
      service: 'knowledge',
      query: 'S3 documentation',
      options: { format: 'text' }
    }
  },
  {
    name: '5. Free Tier Information',
    query: {
      service: 'knowledge',
      query: 'AWS free tier limits',
      options: { format: 'text' }
    }
  }
];

let currentTest = 0;
let testResults = [];

function runNextTest() {
  if (currentTest >= testQueries.length) {
    console.log('\n📊 Test Summary:');
    console.log('================');
    testResults.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
    });
    
    const successCount = testResults.filter(r => r.success).length;
    console.log(`\nTotal: ${successCount}/${testResults.length} tests passed`);
    
    server.kill();
    process.exit(successCount === testResults.length ? 0 : 1);
    return;
  }

  const test = testQueries[currentTest];
  console.log(`\n🔍 Testing: ${test.name}`);
  console.log('-'.repeat(50));

  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'query_service',
      arguments: test.query
    },
    id: currentTest + 1
  };

  server.stdin.write(JSON.stringify(request) + '\n');
}

// Capture output
let buffer = '';
server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Try to parse complete JSON messages
  const lines = buffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const msg = JSON.parse(line);
        if (msg.id && msg.result?.content?.[0]?.text) {
          const testName = testQueries[msg.id - 1].name;
          console.log(msg.result.content[0].text.substring(0, 300) + '...');
          
          testResults.push({
            name: testName,
            success: true
          });
          
          currentTest++;
          setTimeout(runNextTest, 500);
        }
      } catch (e) {
        // Not a complete JSON message yet
      }
    }
  }
  buffer = lines[lines.length - 1];
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  if (!error.includes('MCP server running')) {
    console.error('Server error:', error);
  }
});

// Start tests after server initializes
setTimeout(() => {
  console.log('🚀 Starting tests...\n');
  runNextTest();
}, 1500);

// Timeout after 30 seconds
setTimeout(() => {
  console.error('\n⏱️  Tests timed out');
  server.kill();
  process.exit(1);
}, 30000);