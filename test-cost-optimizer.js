#!/usr/bin/env node
// Test cost optimization workflow locally

const fetch = require('node-fetch');

async function testCostOptimizer() {
    console.log("🧪 Testing Cost Optimization Workflow Components\n");
    
    // Test 1: MCP Connection
    console.log("1️⃣ Testing AWS Unified MCP connection...");
    try {
        const response = await fetch('http://localhost:3002/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: 'edge',
                query: 'device status'
            })
        });
        
        if (response.ok) {
            const data = await response.text();
            console.log("✅ MCP Connected successfully");
            console.log("Sample response:", data.substring(0, 200) + "...");
        } else {
            console.log("❌ MCP Connection failed:", response.status);
        }
    } catch (error) {
        console.log("❌ MCP not running:", error.message);
        console.log("   Start with: cd /Users/sam/dev/aws/mcp/aws-unified-mcp-server && npm start");
    }
    
    // Test 2: Edge Device Cost Simulation
    console.log("\n2️⃣ Simulating edge device costs...");
    const edgeDevices = ['pifive0', 'piiv', 'piiv2'];
    const deviceCosts = {};
    
    for (const device of edgeDevices) {
        // Simulate cost based on uptime and CPU usage
        const baseCost = 4.15; // Base daily cost per device
        const cpuMultiplier = 1 + (Math.random() * 0.3); // 0-30% variation
        deviceCosts[device] = (baseCost * cpuMultiplier).toFixed(2);
    }
    
    console.log("Edge device costs:", deviceCosts);
    
    // Test 3: Cost Anomaly Detection
    console.log("\n3️⃣ Testing anomaly detection...");
    const dailyCost = Object.values(deviceCosts).reduce((sum, cost) => sum + parseFloat(cost), 0) + 24.78 + 10.00;
    const historicalAvg = 40.00;
    const increase = ((dailyCost - historicalAvg) / historicalAvg) * 100;
    
    console.log(`Current daily cost: $${dailyCost.toFixed(2)}`);
    console.log(`Historical average: $${historicalAvg.toFixed(2)}`);
    console.log(`Increase: ${increase.toFixed(2)}%`);
    
    if (increase > 20) {
        console.log("⚠️  ANOMALY DETECTED: Daily cost spike!");
    }
    
    // Test 4: Notion Database IDs
    console.log("\n4️⃣ Checking Notion database configurations...");
    const notionDatabases = {
        incidents: "23be7cc7-01d5-813f-8bc4-e73325f0535a",
        resources: "23be7cc7-01d5-81f0-a8cc-cfa88a213102"
    };
    
    console.log("Incident tracking DB:", notionDatabases.incidents);
    console.log("Resource inventory DB:", notionDatabases.resources);
    
    // Test 5: Webhook Configuration
    console.log("\n5️⃣ Webhook endpoints...");
    console.log("Alert webhook: https://eoiswpghbw14ljk.m.pipedream.net");
    console.log("Cost webhook: [TO BE CREATED]");
    
    // Test 6: Required Environment Variables
    console.log("\n6️⃣ Required configurations for production:");
    console.log("- PIPEDREAM_API_KEY: " + (process.env.PIPEDREAM_API_KEY ? "✅ Set" : "❌ Missing"));
    console.log("- AWS_UNIFIED_URL: http://localhost:3002");
    console.log("- NOTION_API_KEY: [Configured in Pipedream]");
    console.log("- SLACK_WEBHOOK_URL: [Configure #cloud-costs channel]");
    
    // Test 7: Generate sample optimization recommendations
    console.log("\n7️⃣ Sample optimization recommendations:");
    const recommendations = [
        {
            resource: "oracle-compute",
            current_cost: 24.78,
            optimized_cost: 17.28,
            savings: 7.50,
            action: "Downsize from 4 vCPU to 2 vCPU based on 45% avg utilization"
        },
        {
            resource: "edge-devices",
            current_cost: parseFloat(Object.values(deviceCosts).reduce((sum, cost) => sum + parseFloat(cost), 0).toFixed(2)),
            optimized_cost: 10.00,
            savings: 2.45,
            action: "Schedule batch processing during 2-6 AM UTC"
        },
        {
            resource: "networking",
            current_cost: 10.00,
            optimized_cost: 8.00,
            savings: 2.00,
            action: "Enable compression for edge-to-cloud transfers"
        }
    ];
    
    console.log("\nPotential optimizations:");
    recommendations.forEach(rec => {
        console.log(`\n- ${rec.resource}:`);
        console.log(`  Current: $${rec.current_cost}/day`);
        console.log(`  Optimized: $${rec.optimized_cost}/day`);
        console.log(`  Savings: $${rec.savings}/day (${((rec.savings/rec.current_cost)*100).toFixed(1)}%)`);
        console.log(`  Action: ${rec.action}`);
    });
    
    const totalSavings = recommendations.reduce((sum, rec) => sum + rec.savings, 0);
    console.log(`\n💰 Total potential savings: $${totalSavings.toFixed(2)}/day ($${(totalSavings * 30).toFixed(2)}/month)`);
    
    // Test 8: Actual values needed
    console.log("\n8️⃣ Values to update in workflow:");
    console.log("- Notion Database IDs: ✅ Already configured");
    console.log("- Slack channel: Create #cloud-costs or use existing");
    console.log("- Email recipients: ops-team@company.com → your email");
    console.log("- Cost thresholds: Adjust based on your budget");
    console.log("- Schedule: 0 6 * * * (6 AM UTC daily)");
}

// Run tests
testCostOptimizer().catch(console.error);