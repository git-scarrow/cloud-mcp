#!/usr/bin/env python3
"""
Test script to populate sample data and test API endpoints
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5001"

def test_health():
    """Test health endpoint"""
    response = requests.get(f"{BASE_URL}/health")
    print("Health Check:", response.json())
    return response.json()

def insert_sample_data():
    """Insert sample data directly using Oracle MCP"""
    sample_resources = [
        {
            "resource_id": "aws-i-1234567890abcdef0",
            "resource_uuid": "i-1234567890abcdef0", 
            "provider": "AWS",
            "resource_type": "EC2 Instance",
            "project_id": "proj-demo-001",
            "owner": "demo-user",
            "status": "Running",
            "notion_page_id": None,
            "tags": "production,web-server",
            "metrics": {
                "cpu_usage_percent": 75.5,
                "memory_usage_percent": 68.2,
                "cost_daily": 4.80,
                "cost_monthly": 144.00,
                "anomaly_score": 0.15
            }
        },
        {
            "resource_id": "gcp-instance-2345678901bcdef1",
            "resource_uuid": "2345678901bcdef1",
            "provider": "GCP", 
            "resource_type": "Compute Engine",
            "project_id": "proj-demo-001",
            "owner": "demo-user",
            "status": "Running",
            "notion_page_id": None,
            "tags": "development,api-server",
            "metrics": {
                "cpu_usage_percent": 25.3,
                "memory_usage_percent": 42.1,
                "cost_daily": 2.40,
                "cost_monthly": 72.00,
                "anomaly_score": 0.85
            }
        },
        {
            "resource_id": "do-droplet-3456789012cdef12",
            "resource_uuid": "3456789012cdef12",
            "provider": "DigitalOcean",
            "resource_type": "Droplet",
            "project_id": "proj-edge-002", 
            "owner": "edge-user",
            "status": "Active",
            "notion_page_id": None,
            "tags": "edge,monitoring",
            "metrics": {
                "cpu_usage_percent": 15.8,
                "memory_usage_percent": 35.0,
                "cost_daily": 1.20,
                "cost_monthly": 36.00,
                "anomaly_score": 0.05
            }
        }
    ]
    
    # Test batch update endpoint  
    payload = {"resources": sample_resources}
    response = requests.post(f"{BASE_URL}/resources/batch", json=payload)
    print("Batch Update Response:", response.json())
    return response.json()

def test_all_endpoints():
    """Test all API endpoints"""
    print("=== Testing Flask API Endpoints ===")
    
    # 1. Health check
    print("\n1. Health Check:")
    health = test_health()
    
    if not health.get("notion_connected"):
        print("Warning: Notion not connected")
    
    # 2. Test empty resources endpoint first
    print("\n2. Get Resources (Before Data):")
    response = requests.get(f"{BASE_URL}/resources/batch")
    print("Empty Resources:", response.json())
    
    # 3. Insert sample data
    print("\n3. Insert Sample Data:")
    batch_result = insert_sample_data()
    
    # 4. Test resources endpoint with data
    print("\n4. Get Resources (After Data):")
    response = requests.get(f"{BASE_URL}/resources/batch")
    print("Resources with Data:", response.json())
    
    # 5. Test project analytics
    print("\n5. Project Analytics:")
    response = requests.get(f"{BASE_URL}/projects/analytics")
    print("Project Analytics:", response.json())
    
    # 6. Test optimization recommendations
    print("\n6. Optimization Recommendations:")
    response = requests.get(f"{BASE_URL}/optimize/recommendations")  
    print("Optimization Recommendations:", response.json())
    
    print("\n=== API Testing Complete ===")

if __name__ == "__main__":
    test_all_endpoints()