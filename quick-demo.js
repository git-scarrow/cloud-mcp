#!/usr/bin/env node

// Quick demo of MCP server capabilities
const { spawn } = require('child_process');

async function runDemo() {
    console.log('🎭 AWS Unified MCP Server - Live Demo\n');
    
    const demos = [
        {
            title: '1️⃣ Edge Device Monitoring',
            query: {
                service: "edge",
                query: "device status"
            },
            description: 'Check your Pi cluster health'
        },
        {
            title: '2️⃣ Generate Terraform for S3',
            query: {
                service: "terraform",
                query: "create s3 bucket for edge backups with lifecycle rules"
            },
            description: 'Infrastructure as Code generation'
        },
        {
            title: '3️⃣ Cost Optimization Analysis',
            query: {
                service: "edge",
                query: "cost optimize"
            },
            description: 'Analyze edge vs cloud costs'
        },
        {
            title: '4️⃣ Unified Multi-Service Query',
            query: {
                query: "how do I monitor my edge devices with cloudwatch",
                services: ["edge", "terraform", "documentation"]
            },
            tool: 'unified_query',
            description: 'Cross-service intelligence'
        },
        {
            title: '5️⃣ Backup Status Check',
            query: {
                service: "edge",
                query: "backup status",
                options: { deviceId: "pifive0" }
            },
            description: 'Device-specific queries'
        }
    ];
    
    console.log('📋 Demo Scenarios:\n');
    demos.forEach((demo, i) => {
        console.log(`${demo.title}: ${demo.description}`);
    });
    
    console.log('\n🚀 Running demos...\n');
    
    // Start MCP server
    const server = spawn('npm', ['start'], {
        cwd: '/Users/sam/dev/aws/mcp/aws-unified-mcp-server',
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let currentDemo = 0;
    
    server.stdout.on('data', (data) => {
        const response = data.toString();
        try {
            const parsed = JSON.parse(response);
            if (parsed.result && parsed.result.content) {
                console.log(`\n${demos[currentDemo - 1].title} Result:`);
                console.log('─'.repeat(50));
                console.log(parsed.result.content[0].text);
                console.log('─'.repeat(50));
            }
        } catch (e) {
            // Initial server output
        }
        
        // Send next demo
        if (currentDemo < demos.length) {
            setTimeout(() => {
                const demo = demos[currentDemo];
                const request = {
                    jsonrpc: "2.0",
                    id: currentDemo + 1,
                    method: "tools/call",
                    params: {
                        name: demo.tool || "query_service",
                        arguments: demo.query
                    }
                };
                
                console.log(`\n🔄 Running: ${demo.title}`);
                server.stdin.write(JSON.stringify(request) + '\n');
                currentDemo++;
                
                if (currentDemo >= demos.length) {
                    setTimeout(() => {
                        console.log('\n✅ Demo complete!');
                        console.log('\n💡 Try these in production:');
                        console.log('- Connect to Claude Desktop for natural language queries');
                        console.log('- Replace mock data with real AWS SDK calls');
                        console.log('- Add more edge devices to monitor');
                        console.log('- Create custom dashboards with the data');
                        server.kill();
                    }, 3000);
                }
            }, 1500);
        }
    });
    
    server.stderr.on('data', (data) => {
        // Server startup message
    });
    
    // Start demos after server is ready
    setTimeout(() => {
        const firstDemo = demos[0];
        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: "query_service",
                arguments: firstDemo.query
            }
        };
        
        console.log(`🔄 Running: ${firstDemo.title}`);
        server.stdin.write(JSON.stringify(request) + '\n');
        currentDemo = 1;
    }, 2000);
}

runDemo().catch(console.error);