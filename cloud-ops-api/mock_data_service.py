#!/usr/bin/env python3
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
