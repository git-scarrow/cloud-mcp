#!/usr/bin/env python3
"""
Development Environment Setup
Sets up the platform to work without Oracle ADB for initial testing
"""

import os
import json
from pathlib import Path

def create_dev_env():
    """Create development environment configuration"""
    
    env_content = """# Cloud-Ops Platform - Development Configuration
# This configuration works without Oracle ADB

# Environment Settings
CLOUD_OPS_ENV=development

# API Configuration
API_HOST=0.0.0.0
API_PORT=5001

# Oracle Configuration (disabled for dev)
ORACLE_USER=
ORACLE_PASSWORD=
ORACLE_SERVICE=
ORACLE_WALLET_LOCATION=

# AWS Unified MCP Server (already running)
AWS_UNIFIED_URL=http://localhost:3000
AWS_UNIFIED_TIMEOUT=30

# Project Configuration
DEFAULT_PROJECT_ID=cloud-ops-dev
MONTHLY_BUDGET=10.0

# Alert Thresholds
BUDGET_WARNING_THRESHOLD=0.75
BUDGET_CRITICAL_THRESHOLD=0.90
CPU_UNDERUTILIZED_THRESHOLD=20
MEMORY_UNDERUTILIZED_THRESHOLD=30
ANOMALY_WARNING_THRESHOLD=0.6
ANOMALY_CRITICAL_THRESHOLD=0.8

# Sync Service Settings
SYNC_INTERVAL_HOURS=1
FULL_SYNC_HOUR=2
OPTIMIZATION_DAY=sunday

# Grafana Settings
GRAFANA_ORACLE_PROXY_URL=http://oracle-proxy:5002

# Notion Configuration (optional)
NOTION_TOKEN=
NOTION_RESOURCES_DB_ID=
NOTION_PROJECTS_DB_ID=
NOTION_INCIDENTS_DB_ID=
NOTION_TASKS_DB_ID=

# Pipedream Webhooks (optional)
PIPEDREAM_BUDGET_ALERT_URL=
PIPEDREAM_ANOMALY_DETECTION_URL=
PIPEDREAM_COST_OPTIMIZATION_URL=
PIPEDREAM_SYNC_COMPLETION_URL=

# Notification Settings (optional)
SLACK_WEBHOOK_URL=
ALERT_EMAIL=
PAGERDUTY_INTEGRATION_KEY=
"""
    
    # Backup existing .env if it exists
    if Path('.env').exists():
        Path('.env').rename('.env.adb-backup')
        print("✅ Backed up existing .env to .env.adb-backup")
    
    # Write new development environment
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print("✅ Created development .env file")
    
def create_mock_data_service():
    """Create a mock data service for development"""
    
    mock_service = '''#!/usr/bin/env python3
"""
Mock Data Service for Development
Provides sample data when Oracle is not available
"""

import json
from datetime import datetime, timedelta
import random

class MockDataService:
    """Mock data provider for development"""
    
    def get_cloud_resources(self):
        """Return mock cloud resources"""
        resources = []
        
        # AWS resources
        for i in range(3):
            resources.append({
                "resource_id": f"aws-ec2-{i+1}",
                "resource_uuid": f"i-{random.randint(1000,9999)}",
                "provider": "AWS",
                "resource_type": "EC2 Instance",
                "project_id": "cloud-ops-dev",
                "status": "Running",
                "owner": "dev-team",
                "cost_monthly": round(random.uniform(50, 200), 2),
                "cpu_usage": round(random.uniform(10, 80), 1),
                "memory_usage": round(random.uniform(20, 70), 1),
                "tags": "development,web-app"
            })
        
        # GCP resources
        resources.append({
            "resource_id": "gcp-compute-1",
            "resource_uuid": "gcp-instance-001",
            "provider": "GCP",
            "resource_type": "Compute Engine",
            "project_id": "cloud-ops-dev",
            "status": "Running",
            "owner": "dev-team",
            "cost_monthly": 75.00,
            "cpu_usage": 35.5,
            "memory_usage": 42.0,
            "tags": "development,api"
        })
        
        # DigitalOcean resource
        resources.append({
            "resource_id": "do-droplet-1",
            "resource_uuid": "droplet-001",
            "provider": "DigitalOcean",
            "resource_type": "Droplet",
            "project_id": "cloud-ops-dev",
            "status": "Active",
            "owner": "dev-team",
            "cost_monthly": 24.00,
            "cpu_usage": 15.0,
            "memory_usage": 25.0,
            "tags": "edge,monitoring"
        })
        
        return resources
    
    def get_project_analytics(self):
        """Return mock project analytics"""
        total_cost = sum(r['cost_monthly'] for r in self.get_cloud_resources())
        
        return {
            "project_id": "cloud-ops-dev",
            "project_name": "Cloud Operations Development",
            "budget_monthly": 10.00,
            "current_monthly_cost": total_cost,
            "budget_remaining": 10.00 - total_cost,
            "budget_utilization": (total_cost / 10.00) * 100,
            "total_resources": len(self.get_cloud_resources()),
            "active_resources": len([r for r in self.get_cloud_resources() if r['status'] in ['Running', 'Active']]),
            "providers": {
                "AWS": 3,
                "GCP": 1,
                "DigitalOcean": 1
            }
        }
    
    def get_optimization_recommendations(self):
        """Return mock optimization recommendations"""
        recommendations = []
        
        for resource in self.get_cloud_resources():
            if resource['cpu_usage'] < 20:
                recommendations.append({
                    "resource_id": resource['resource_id'],
                    "type": "Underutilized",
                    "recommendation": f"Consider downsizing {resource['resource_id']} - CPU usage only {resource['cpu_usage']}%",
                    "potential_savings": resource['cost_monthly'] * 0.3
                })
        
        return recommendations

# Create instance
mock_service = MockDataService()
'''
    
    with open('mock_data_service.py', 'w') as f:
        f.write(mock_service)
    
    print("✅ Created mock_data_service.py")

def create_simple_api():
    """Create a simplified API that works without Oracle"""
    
    simple_api = '''#!/usr/bin/env python3
"""
Simplified Cloud-Ops API for Development
Works without Oracle database connection
"""

from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime
from mock_data_service import mock_service
import requests
import os

app = Flask(__name__)
CORS(app)

# AWS Unified MCP URL
AWS_UNIFIED_URL = os.getenv('AWS_UNIFIED_URL', 'http://localhost:3000')

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    
    # Check AWS Unified MCP
    aws_unified_healthy = False
    try:
        resp = requests.get(f"{AWS_UNIFIED_URL}/health", timeout=2)
        aws_unified_healthy = resp.status_code == 200
    except:
        pass
    
    return jsonify({
        "status": "healthy",
        "mode": "development (no database)",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "aws_unified_mcp": aws_unified_healthy,
            "oracle": False,
            "notion": False
        }
    })

@app.route('/resources', methods=['GET'])
def get_resources():
    """Get cloud resources from mock service"""
    resources = mock_service.get_cloud_resources()
    
    return jsonify({
        "success": True,
        "count": len(resources),
        "resources": resources,
        "source": "mock_data",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/projects/analytics', methods=['GET'])
def get_project_analytics():
    """Get project analytics"""
    analytics = mock_service.get_project_analytics()
    
    return jsonify({
        "success": True,
        "analytics": analytics,
        "source": "mock_data",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/optimize/recommendations', methods=['GET'])
def get_optimization_recommendations():
    """Get optimization recommendations"""
    recommendations = mock_service.get_optimization_recommendations()
    
    return jsonify({
        "success": True,
        "count": len(recommendations),
        "recommendations": recommendations,
        "total_potential_savings": sum(r['potential_savings'] for r in recommendations),
        "source": "mock_data",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/aws-unified/query', methods=['POST'])
def query_aws_unified():
    """Proxy queries to AWS Unified MCP"""
    try:
        # Forward to AWS Unified MCP
        # In real implementation, this would use the MCP protocol
        return jsonify({
            "success": True,
            "message": "AWS Unified MCP integration ready",
            "url": AWS_UNIFIED_URL
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    print("🚀 Starting Cloud-Ops Development API")
    print("📍 API: http://localhost:5001")
    print("📊 Mode: Development (using mock data)")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5001, debug=True)
'''
    
    with open('app_dev.py', 'w') as f:
        f.write(simple_api)
    
    print("✅ Created app_dev.py (simplified API)")

def main():
    print("🚀 Cloud-Ops Development Environment Setup")
    print("=" * 50)
    
    # Create development environment
    create_dev_env()
    create_mock_data_service()
    create_simple_api()
    
    print("\n✅ Development environment ready!")
    print("\n📋 What's been set up:")
    print("1. .env - Development configuration (no Oracle required)")
    print("2. mock_data_service.py - Provides sample data")
    print("3. app_dev.py - Simplified API that works without database")
    
    print("\n🚀 To start the development API:")
    print("   python app_dev.py")
    
    print("\n📊 Available endpoints:")
    print("   GET  http://localhost:5001/health")
    print("   GET  http://localhost:5001/resources")
    print("   GET  http://localhost:5001/projects/analytics")
    print("   GET  http://localhost:5001/optimize/recommendations")
    
    print("\n💡 Benefits of this setup:")
    print("   - No Oracle database required")
    print("   - Works immediately with mock data")
    print("   - AWS Unified MCP integration ready")
    print("   - Can add Notion/Pipedream later")
    
    print("\n📝 When Oracle ADB is available:")
    print("   1. Restore your ADB config: mv .env.adb-backup .env")
    print("   2. Fix the connection issue")
    print("   3. Run the full app.py instead")

if __name__ == "__main__":
    main()