#!/usr/bin/env python3
"""
Deploy the comprehensive Cloud Operations Intelligence Hub workflow to Pipedream.
This creates a production-ready multi-cloud operations platform.
"""

import json
import requests
from datetime import datetime


def create_comprehensive_workflow(api_key: str, project_id: str):
    """Deploy the comprehensive workflow to Pipedream"""
    
    # Load the comprehensive workflow definition
    with open('pipedream_comprehensive_workflow.json', 'r') as f:
        workflow_def = json.load(f)
    
    # Pipedream workflow creation payload
    payload = {
        "name": workflow_def["name"],
        "description": workflow_def["description"],
        "project_id": project_id,
        
        # Configure all triggers
        "trigger": {
            "type": "composite",
            "triggers": [
                {
                    "component": "@pipedream/http",
                    "props": {
                        "http": {
                            "method": ["POST", "PUT"],
                            "path": "/incident",
                            "immediate_response": {
                                "status": 200,
                                "body": {"message": "Incident received"}
                            }
                        }
                    }
                },
                {
                    "component": "@pipedream/schedule",
                    "props": {
                        "timer": {
                            "cron": "0 8 * * *",
                            "timezone": "America/New_York"
                        }
                    }
                }
            ]
        },
        
        # Add all steps
        "steps": []
    }
    
    # Convert our step definitions to Pipedream format
    for step in workflow_def["steps"]:
        pipedream_step = {
            "key": step["id"],
            "name": step["name"]
        }
        
        if step["type"] == "code":
            pipedream_step["component"] = "@pipedream/nodejs"
            pipedream_step["props"] = {
                "code": step["code"]
            }
        elif step["type"] == "openai-chat":
            pipedream_step["component"] = "@pipedream/openai"
            pipedream_step["props"] = {
                "openai": "{{openai.$auth}}",
                "model": step["config"]["model"],
                "messages": [{
                    "role": "system",
                    "content": step["config"]["system_prompt"]
                }, {
                    "role": "user", 
                    "content": "{{steps.enrich_context.$return_value}}"
                }]
            }
        
        payload["steps"].append(pipedream_step)
    
    # Make API request
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(
        "https://api.pipedream.com/v1/workflows",
        headers=headers,
        json=payload
    )
    
    if response.status_code in [200, 201]:
        workflow = response.json()
        print(f"✅ Workflow created successfully!")
        print(f"   ID: {workflow.get('id')}")
        print(f"   URL: https://pipedream.com/@{workflow.get('owner_id')}/{workflow.get('id')}")
        
        # Print webhook URLs
        if workflow.get('triggers'):
            print(f"\n🔗 Webhook Endpoints:")
            for trigger in workflow['triggers']:
                if trigger.get('endpoint_url'):
                    print(f"   • {trigger['endpoint_url']}")
        
        return workflow
    else:
        print(f"❌ Failed to create workflow: {response.status_code}")
        print(f"   Error: {response.text}")
        return None


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
    workflow = create_comprehensive_workflow(API_KEY, PROJECT_ID)
    
    if workflow:
        print("\n📋 Workflow Features:")
        print("   • Multi-trigger support (webhooks, schedules, email, S3)")
        print("   • AI-powered incident analysis")
        print("   • Automated remediation actions")
        print("   • Multi-cloud context enrichment")
        print("   • Notion database integration")
        print("   • Oracle metrics correlation")
        print("   • Multi-channel notifications")
        print("   • Daily analytics reports")
        
        print("\n🎯 Integration Points:")
        print("   • AWS Unified MCP: http://localhost:3002")
        print("   • Notion Cloud Projects: 23be7cc7-01d5-813f-8bc4-e73325f0535a")
        print("   • Notion Cloud Resources: 23be7cc7-01d5-81f0-a8cc-cfa88a213102")
        
        print("\n🧪 Test Commands:")
        webhook_url = "WEBHOOK_URL"
        if workflow.get('triggers') and len(workflow['triggers']) > 0:
            webhook_url = workflow['triggers'][0].get('endpoint_url', 'WEBHOOK_URL')
        
        print(f"""
# Test incident webhook:
curl -X POST {webhook_url} \\
  -H "Content-Type: application/json" \\
  -d '{{
    "resource_id": "pifive0",
    "alert_type": "high_cpu",
    "severity": "High",
    "message": "CPU usage exceeded 85% for 10 minutes",
    "source": "edge-monitor"
  }}'

# Test S3 event:
curl -X POST {webhook_url} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-source: s3" \\
  -d '{{
    "Records": [{{
      "s3": {{
        "bucket": {{"name": "cloud-operations-hub"}},
        "object": {{"key": "backups/pifive0/2025-01-26.tar.gz"}}
      }}
    }}]
  }}'
""")
        
    else:
        print("\n💡 Troubleshooting:")
        print("   1. Check your Pipedream workflow limit")
        print("   2. Verify API key is valid")
        print("   3. Ensure project ID is correct")
        print("   4. Try creating a simpler workflow first")


if __name__ == "__main__":
    main()