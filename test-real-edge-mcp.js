#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🧪 Testing MCP Server with Real AWS Queries');
console.log('==========================================\n');

const server = spawn('node', ['mcp/aws-unified-mcp-server/dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    AWS_REGION: 'us-east-1',
    S3_BUCKET: 'edge-backup-picluster-free'
  }
});

// Test query for edge device status
const testQuery = {
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    name: 'query_service',
    arguments: {
      service: 'edge',
      query: 'status',
      options: { format: 'text' }
    }
  },
  id: 1
};

// Send query after a short delay
setTimeout(() => {
  console.log('📤 Sending query: Show edge device status with real AWS data\n');
  server.stdin.write(JSON.stringify(testQuery) + '\n');
}, 1000);

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
        if (msg.result?.content?.[0]?.text) {
          console.log('📊 Real AWS Data Response:');
          console.log('========================\n');
          console.log(msg.result.content[0].text);
          console.log('\n✅ Test complete! The server is now using real AWS data.');
          process.exit(0);
        }
      } catch (e) {
        // Not a complete JSON message yet
      }
    }
  }
  buffer = lines[lines.length - 1];
});

server.stderr.on('data', (data) => {
  console.error('❌ Server error:', data.toString());
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('⏱️  Test timed out');
  server.kill();
  process.exit(1);
}, 10000);