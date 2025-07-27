# Pipedream Workflow Setup Guide

## Overview
This guide walks through setting up the two Pipedream workflows created for your cloud operations:
1. **Cloud Operations Intelligence Hub** - Real-time alert processing
2. **Daily Cost Optimization Analyzer** - Scheduled cost analysis

## Prerequisites

### ✅ Already Configured
- Pipedream Account (org: o_EVIVWdx, project: proj_MnszOND)
- Alert Webhook URL: https://eoiswpghbw14ljk.m.pipedream.net
- Edge device monitoring scripts deployed to all Raspberry Pis
- Notion databases configured with correct IDs
- AWS Unified MCP server running on port 3002

### 🔧 Needs Configuration
1. **Slack Channel**: Create `#cloud-costs` channel (or use existing `#cloud-alerts`)
2. **Email Recipients**: Update from `ops-team@company.com` to your actual email
3. **App Connections**: Connect Notion and Slack apps in Pipedream

## Workflow 1: Cloud Operations Intelligence Hub

### Purpose
Processes real-time alerts from edge devices and cloud services

### Trigger
- **Type**: Webhook
- **URL**: https://eoiswpghbw14ljk.m.pipedream.net
- **Status**: ✅ Already receiving alerts from edge devices

### Required App Connections
1. **Notion** 
   - Database IDs (already in code):
     - Incidents: `23be7cc7-01d5-813f-8bc4-e73325f0535a`
     - Resources: `23be7cc7-01d5-81f0-a8cc-cfa88a213102`
   
2. **Slack**
   - Channels to configure:
     - `#cloud-alerts-critical` (for P0 alerts)
     - `#cloud-alerts` (for P1/P2 alerts)

3. **Email** (optional)
   - For critical notifications

### Values to Update in Code

```javascript
// In Step 6: Smart Notification Router
// Line 477: Email recipient
to: "sscarrow@gmail.com",  // ✅ Already updated

// Line 443: Slack channel for critical alerts
channel: "#cloud-alerts-critical",  // Create this channel

// Line 490: Slack channel for normal alerts  
channel: "#cloud-alerts",  // Or use existing channel
```

## Workflow 2: Daily Cost Optimization Analyzer

### Purpose
Daily analysis of cloud costs with anomaly detection and recommendations

### Schedule
- **Cron**: `0 6 * * *` (Daily at 6 AM UTC)
- **Timezone**: UTC

### Configuration Object to Update

```javascript
// At the top of pipedream_cost_optimizer_final.js
const CONFIG = {
    // MCP Service
    MCP_URL: 'http://localhost:3002',  // ✅ Correct
    
    // Notion Databases
    NOTION_INCIDENTS_DB: '23be7cc7-01d5-813f-8bc4-e73325f0535a',  // ✅ Correct
    NOTION_RESOURCES_DB: '23be7cc7-01d5-81f0-a8cc-cfa88a213102',  // ✅ Correct
    
    // Cost Thresholds
    DAILY_BUDGET: 0.50,      // ✅ Updated ($15/month ÷ 30 days)
    MONTHLY_BUDGET: 15.00,   // ✅ Updated to $15/month
    ANOMALY_THRESHOLD_PCT: 20, // ✅ Good default (alert if >20% increase)
    
    // Notification Channels
    SLACK_CHANNEL: '#cloud-alerts',  // ⚠️ Create #cloud-costs or use existing
    EMAIL_RECIPIENTS: ['sscarrow@gmail.com'], // ✅ Updated
    
    // Edge Device Configuration
    EDGE_DEVICES: {  // ✅ Updated to realistic costs for $15/month budget
        'pifive0': { baseCost: 0.10, ssh: 'mcp__ssh-pifive0__exec' },
        'piiv': { baseCost: 0.10, ssh: 'mcp__ssh-piiv__exec' },
        'piiv2': { baseCost: 0.10, ssh: 'mcp__ssh-piiv2__exec' }
    }
};
```

## Step-by-Step Setup

### 1. Create Workflows in Pipedream

1. Go to https://pipedream.com
2. Navigate to your project: proj_MnszOND
3. Click "New Workflow"

### 2. Set Up Alert Processing Workflow

1. **Name**: "Cloud Operations Intelligence Hub"
2. **Trigger**: HTTP/Webhook (use existing URL)
3. **Add Code Steps**: Copy each step from `pipedream_workflow_actions.js`
4. **Connect Apps**:
   - Click on Notion steps → Connect your Notion workspace
   - Click on Slack steps → Connect your Slack workspace
   - Click on Email steps → Connect email service

### 3. Set Up Cost Optimization Workflow

1. **Name**: "Daily Cost Optimization Analyzer"
2. **Trigger**: Schedule → Cron → `0 6 * * *`
3. **Add Code Steps**: Copy each step from `pipedream_cost_optimizer_final.js`
4. **Update CONFIG object** with your values
5. **Connect Apps**: Same as above

### 4. Test the Workflows

#### Test Alert Processing:
```bash
curl -X POST https://eoiswpghbw14ljk.m.pipedream.net \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "test-device",
    "alert_type": "high_cpu",
    "severity": "High",
    "message": "Test alert from setup guide",
    "source": "manual-test",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

#### Test Cost Optimization:
- Click "Test" button in Pipedream UI
- Or wait for next 6 AM UTC run

### 5. Monitor Performance

- **Pipedream Dashboard**: View execution history and logs
- **Notion Pages**: Check created incident and cost analysis pages
- **Slack Channels**: Verify notifications are arriving
- **Cost Dashboard**: Open `cost-optimization-dashboard.html` in browser

## Troubleshooting

### Common Issues:

1. **MCP Connection Failed**
   - Ensure AWS Unified MCP is running: `ps aux | grep aws-unified`
   - Check port 3002 is accessible
   - Restart if needed: `cd /Users/sam/dev/aws/mcp/aws-unified-mcp-server && npm start`

2. **Notion Errors**
   - Verify database IDs exist in your workspace
   - Check API permissions include both databases
   - Ensure proper field names match your database schema

3. **No Slack Notifications**
   - Verify channel names exist
   - Check bot has permission to post in channels
   - Test with public channels first

4. **Cost Data Missing**
   - MCP server must be running
   - Edge devices should be accessible via SSH
   - Check webhook is receiving data from edge monitors

## Next Steps

1. **Fine-tune Thresholds**: Adjust anomaly detection percentages based on your normal variations
2. **Add Custom Metrics**: Extend cost analysis to include your specific services
3. **Create Dashboards**: Use Pipedream's built-in analytics or export to monitoring tools
4. **Set Up Escalation**: Configure PagerDuty or on-call rotation for critical alerts
5. **Implement Remediation**: Add more automated fixes in the remediation engine

## Support Resources

- Pipedream Docs: https://pipedream.com/docs
- Notion API: https://developers.notion.com
- Slack API: https://api.slack.com
- Your webhook URL for testing: https://eoiswpghbw14ljk.m.pipedream.net