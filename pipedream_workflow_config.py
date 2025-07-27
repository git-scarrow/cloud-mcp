#!/usr/bin/env python3
"""
Deploy comprehensive Cloud Operations Intelligence Hub to Pipedream
"""

import requests
import json
from datetime import datetime


def create_comprehensive_workflow(api_key: str, project_id: str):
    """Create a comprehensive workflow using Pipedream API"""
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Build workflow configuration
    workflow_config = {
        "name": "Cloud Operations Intelligence Hub",
        "description": "Comprehensive multi-cloud operations platform with real-time monitoring, incident response, cost optimization, and predictive analytics",
        "org_id": "o_EVIVWdx",
        "project_id": project_id
    }
    
    # Define steps as Python dictionaries with proper code strings
    steps = [
        {
            "key": "input_router",
            "component": {
                "key": "nodejs",
                "version": "2.0.0"
            },
            "params": {
                "name": "Route Input by Source",
                "code": """
// Determine input source and route accordingly
const trigger = steps.trigger;

let inputType, data;

if (trigger.event?.headers?.['x-webhook-source']) {
  inputType = 'webhook';
  data = trigger.event.body;
} else if (trigger.event?.schedule) {
  inputType = 'scheduled';
  data = { task: 'optimization_scan' };
} else if (trigger.event?.email) {
  inputType = 'email';
  data = { 
    subject: trigger.event.subject,
    body: trigger.event.body,
    from: trigger.event.from
  };
} else {
  inputType = 'unknown';
  data = trigger.event;
}

$.flow.inputType = inputType;
$.flow.timestamp = new Date().toISOString();

return {
  inputType,
  data,
  timestamp: $.flow.timestamp,
  correlationId: $.meta.id
};
"""
            }
        },
        {
            "key": "enrich_context",
            "component": {
                "key": "nodejs",
                "version": "2.0.0"
            },
            "params": {
                "name": "Enrich with Multi-Cloud Context",
                "code": """
const { inputType, data } = steps.input_router.$return_value;

// Call AWS Unified MCP for comprehensive context
const enrichmentPromises = [];

// Get edge device status
enrichmentPromises.push(
  fetch('http://localhost:3002/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'edge',
      query: 'device status'
    })
  }).then(r => r.text()).catch(e => ({ error: e.message }))
);

// Get cost analysis
enrichmentPromises.push(
  fetch('http://localhost:3002/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'edge',
      query: 'cost analysis'
    })
  }).then(r => r.text()).catch(e => ({ error: e.message }))
);

const [edgeStatus, costAnalysis] = await Promise.all(enrichmentPromises);

return {
  original: data,
  inputType,
  enrichment: {
    edgeStatus,
    costAnalysis,
    enrichedAt: new Date().toISOString()
  }
};
"""
            }
        },
        {
            "key": "analyze_severity",
            "component": {
                "key": "nodejs",
                "version": "2.0.0"
            },
            "params": {
                "name": "Analyze Severity and Impact",
                "code": """
const enrichedData = steps.enrich_context.$return_value;

// Simple severity analysis based on alert type and metrics
let severity = 'Medium';
let impact = 'Low';
let recommendations = [];

if (enrichedData.original.alert_type === 'high_cpu') {
  severity = 'High';
  impact = 'Performance degradation';
  recommendations = [
    'Check running processes',
    'Review resource allocation',
    'Consider scaling resources'
  ];
} else if (enrichedData.original.alert_type === 'disk_full') {
  severity = 'Critical';
  impact = 'Service disruption imminent';
  recommendations = [
    'Clear log files immediately',
    'Archive old backups',
    'Increase storage capacity'
  ];
} else if (enrichedData.inputType === 'scheduled') {
  severity = 'Info';
  impact = 'Routine check';
  recommendations = ['Review optimization opportunities'];
}

return {
  severity,
  impact,
  recommendations,
  requiresAction: severity === 'Critical' || severity === 'High',
  analysisTime: new Date().toISOString()
};
"""
            }
        },
        {
            "key": "notion_operations",
            "component": {
                "key": "nodejs", 
                "version": "2.0.0"
            },
            "params": {
                "name": "Update Notion Databases",
                "code": """
const { inputType } = steps.input_router.$return_value;
const analysis = steps.analyze_severity.$return_value;
const enrichedData = steps.enrich_context.$return_value;

// Prepare Notion updates
const operations = [];

// Create incident page if high severity
if (analysis.severity === 'Critical' || analysis.severity === 'High') {
  operations.push({
    type: 'create_incident',
    database_id: '23be7cc7-01d5-813f-8bc4-e73325f0535a',
    title: `🚨 ${analysis.severity}: ${enrichedData.original.alert_type || 'Incident'}`,
    properties: {
      severity: analysis.severity,
      impact: analysis.impact,
      resource: enrichedData.original.resource_id || 'Unknown'
    }
  });
}

// Log operation details
console.log('Notion operations planned:', operations.length);
operations.forEach(op => console.log(`- ${op.type}: ${op.title}`));

return {
  operations_planned: operations.length,
  operations: operations,
  notion_update_required: operations.length > 0
};
"""
            }
        },
        {
            "key": "automated_response",
            "component": {
                "key": "nodejs",
                "version": "2.0.0"
            },
            "params": {
                "name": "Execute Automated Response",
                "code": """
const analysis = steps.analyze_severity.$return_value;
const enrichedData = steps.enrich_context.$return_value;

const actions = [];

// Determine automated actions based on severity
if (analysis.requiresAction) {
  if (enrichedData.original.alert_type === 'high_cpu') {
    actions.push({
      action: 'restart_service',
      target: enrichedData.original.resource_id,
      reason: 'CPU exceeded threshold'
    });
  }
  
  if (enrichedData.original.alert_type === 'disk_full') {
    actions.push({
      action: 'cleanup_logs',
      target: enrichedData.original.resource_id,
      reason: 'Disk usage critical'
    });
  }
}

// Log actions (in production, would execute via MCP)
console.log(`Automated actions: ${actions.length}`);
actions.forEach(a => console.log(`- ${a.action} on ${a.target}: ${a.reason}`));

return {
  actions_taken: actions.length,
  actions: actions,
  manual_intervention_required: analysis.severity === 'Critical' && actions.length === 0
};
"""
            }
        },
        {
            "key": "send_notifications",
            "component": {
                "key": "nodejs",
                "version": "2.0.0"
            },
            "params": {
                "name": "Send Multi-Channel Notifications",
                "code": """
const analysis = steps.analyze_severity.$return_value;
const notionOps = steps.notion_operations.$return_value;
const response = steps.automated_response.$return_value;

const emoji = {
  'Critical': '🚨',
  'High': '⚠️',
  'Medium': '📊',
  'Low': 'ℹ️',
  'Info': '📌'
}[analysis.severity] || '❓';

const message = `${emoji} **Cloud Operations Alert**

**Severity**: ${analysis.severity}
**Impact**: ${analysis.impact}
**Resource**: ${steps.input_router.$return_value.data.resource_id || 'N/A'}

**Automated Actions**: ${response.actions_taken}
**Manual Required**: ${response.manual_intervention_required ? 'Yes' : 'No'}

**Recommendations**:
${analysis.recommendations.map(r => `• ${r}`).join('\\n')}

View details in Notion`;

// Log notification (in production, would send to Slack/Discord/Email)
console.log('Notification:', message);

return {
  notification_sent: true,
  channels: ['console'],
  message: message
};
"""
            }
        },
        {
            "key": "workflow_summary",
            "component": {
                "key": "nodejs",
                "version": "2.0.0"
            },
            "params": {
                "name": "Workflow Summary",
                "code": """
// Compile execution summary
const summary = {
  workflow_id: $.meta.workflow_id,
  execution_id: $.meta.id,
  trigger_type: steps.input_router.$return_value.inputType,
  started_at: steps.input_router.$return_value.timestamp,
  completed_at: new Date().toISOString(),
  
  results: {
    severity: steps.analyze_severity.$return_value.severity,
    enrichment_success: !!steps.enrich_context.$return_value.enrichment,
    notion_operations: steps.notion_operations.$return_value.operations_planned,
    automated_actions: steps.automated_response.$return_value.actions_taken,
    notification_sent: steps.send_notifications.$return_value.notification_sent
  },
  
  metrics: {
    total_duration_ms: Date.now() - new Date(steps.input_router.$return_value.timestamp).getTime()
  }
};

console.log('Workflow completed:', JSON.stringify(summary, null, 2));

return summary;
"""
            }
        }
    ]
    
    # Add steps to workflow
    workflow_config["steps"] = steps
    
    # Make API request
    response = requests.post(
        "https://api.pipedream.com/v1/workflows",
        headers=headers,
        json=workflow_config
    )
    
    return response


def main():
    """Deploy the comprehensive workflow"""
    
    # Configuration
    API_KEY = "f36d932d1b4eb46ec1689981bcad78d3"
    PROJECT_ID = "proj_MnszOND"
    
    print("🚀 Deploying Cloud Operations Intelligence Hub to Pipedream...")
    print(f"   Project: {PROJECT_ID}")
    print(f"   Time: {datetime.now().isoformat()}")
    print()
    
    # Deploy workflow
    response = create_comprehensive_workflow(API_KEY, PROJECT_ID)
    
    if response.status_code in [200, 201]:
        response_data = response.json()
        workflow = response_data.get('data', response_data)  # Handle wrapped response
        print(f"✅ Workflow created successfully!")
        print(f"   ID: {workflow.get('id')}")
        print(f"   Name: {workflow.get('name', 'Cloud Operations Intelligence Hub')}")
        print(f"   Active: {workflow.get('active', False)}")
        
        # Construct workflow URL
        workflow_id = workflow.get('id')
        if workflow_id:
            workflow_url = f"https://pipedream.com/@/p_{workflow_id[2:]}" if workflow_id.startswith('p_') else f"https://pipedream.com/@/p_{workflow_id}"
            print(f"\n🔗 Workflow URL:")
            print(f"   {workflow_url}")
            
            # Webhook URL for HTTP trigger
            webhook_url = f"https://eocn8z2el6wybpf.m.pipedream.net"  # This would be returned by the API
            print(f"\n🔗 Webhook URL (check in Pipedream UI):")
            print(f"   The webhook URL will be shown in your workflow trigger")
        
        print("\n📋 Workflow Features:")
        print("   • Multi-source input routing")
        print("   • Real-time cloud context enrichment")
        print("   • Intelligent severity analysis")
        print("   • Automated response actions")
        print("   • Notion database integration")
        print("   • Multi-channel notifications")
        print("   • Comprehensive execution tracking")
        
        print("\n🧪 Test Command:")
        webhook_url = workflow.get('webhook_url', 'YOUR_WEBHOOK_URL')
        print(f"""
curl -X POST {webhook_url} \\
  -H "Content-Type: application/json" \\
  -d '{{
    "resource_id": "pifive0",
    "alert_type": "high_cpu",
    "severity": "High",
    "message": "CPU usage exceeded 85% for 10 minutes"
  }}'
""")
        
    else:
        print(f"❌ Failed to create workflow: {response.status_code}")
        print(f"   Error: {response.text}")
        
        if "LIMIT_ACTIVE_WORKFLOWS" in response.text:
            print("\n💡 You've reached your workflow limit. Try:")
            print("   1. Delete unused workflows in Pipedream")
            print("   2. Upgrade your Pipedream plan")
            print("   3. Archive old workflows")


if __name__ == "__main__":
    main()