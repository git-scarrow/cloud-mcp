#!/usr/bin/env python3
"""
Test AWS Unified MCP Integration
Tests the new MCP endpoints and services
"""

import requests
import json
from datetime import datetime

# API base URL
BASE_URL = "http://localhost:5001"

def test_mcp_search():
    """Test MCP search functionality"""
    print("\n1. Testing MCP Search...")
    
    payload = {
        "searchTerm": "EC2 cost optimization",
        "filters": {
            "type": "best-practices"
        }
    }
    
    response = requests.post(f"{BASE_URL}/mcp/search", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Search successful: Found results for '{payload['searchTerm']}'")
        print(f"   Results: {json.dumps(data.get('results', {}), indent=2)[:200]}...")
    else:
        print(f"❌ Search failed: {response.status_code} - {response.text}")

def test_mcp_edge_devices():
    """Test MCP edge device listing"""
    print("\n2. Testing MCP Edge Devices...")
    
    response = requests.get(f"{BASE_URL}/mcp/edge/devices")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Edge devices retrieved: {data['count']} devices found")
        for device in data.get('devices', []):
            print(f"   - {device.get('deviceId', 'Unknown')}: {device.get('status', 'Unknown')}")
    else:
        print(f"❌ Edge devices failed: {response.status_code} - {response.text}")

def test_mcp_cost_analysis():
    """Test MCP cost analysis"""
    print("\n3. Testing MCP Cost Analysis...")
    
    response = requests.get(f"{BASE_URL}/mcp/cost-analysis")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Cost analysis retrieved")
        cost_data = data.get('cost_analysis', {})
        if 'edge_costs' in cost_data:
            print(f"   Edge costs: {json.dumps(cost_data['edge_costs'], indent=2)[:200]}...")
        if 'free_tier_status' in cost_data:
            print(f"   Free tier status: Available")
    else:
        print(f"❌ Cost analysis failed: {response.status_code} - {response.text}")

def test_mcp_query_service():
    """Test MCP service query"""
    print("\n4. Testing MCP Service Query...")
    
    payload = {
        "service": "edge",
        "query": "device status",
        "options": {"format": "json"}
    }
    
    response = requests.post(f"{BASE_URL}/mcp/query", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Service query successful")
        print(f"   Service: {data['service']}")
        print(f"   Query: {data['query']}")
        if data.get('result'):
            print(f"   Result type: {type(data['result'])}")
    else:
        print(f"❌ Service query failed: {response.status_code} - {response.text}")

def test_mcp_unified_query():
    """Test MCP unified query"""
    print("\n5. Testing MCP Unified Query...")
    
    payload = {
        "query": "AWS free tier usage and optimization",
        "services": ["knowledge", "edge"]
    }
    
    response = requests.post(f"{BASE_URL}/mcp/unified-query", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Unified query successful")
        print(f"   Query: {data['query']}")
        print(f"   Services: {data['services']}")
        results = data.get('results', {})
        print(f"   Results from {len(results)} services")
    else:
        print(f"❌ Unified query failed: {response.status_code} - {response.text}")

def test_mcp_generate_template():
    """Test MCP template generation"""
    print("\n6. Testing MCP Template Generation...")
    
    payload = {
        "type": "terraform",
        "resource": "EC2 instance",
        "options": {
            "instance_type": "t3.micro",
            "region": "us-east-1"
        }
    }
    
    response = requests.post(f"{BASE_URL}/mcp/templates/generate", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Template generation successful")
        print(f"   Type: {data['type']}")
        print(f"   Resource: {data['resource']}")
        if data.get('template'):
            print(f"   Template generated: {len(str(data['template']))} characters")
    else:
        print(f"❌ Template generation failed: {response.status_code} - {response.text}")

def test_mcp_best_practices():
    """Test MCP best practices retrieval"""
    print("\n7. Testing MCP Best Practices...")
    
    topic = "cost-optimization"
    response = requests.get(f"{BASE_URL}/mcp/best-practices/{topic}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Best practices retrieved for topic: {topic}")
        best_practices = data.get('best_practices', {})
        print(f"   Found {len(str(best_practices))} characters of best practices")
    else:
        print(f"❌ Best practices failed: {response.status_code} - {response.text}")

def test_live_resources_with_mcp():
    """Test live resources endpoint (should now include MCP data)"""
    print("\n8. Testing Live Resources with MCP Integration...")
    
    response = requests.get(f"{BASE_URL}/resources/live")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Live resources retrieved: {data['count']} resources")
        
        # Check for edge devices
        edge_resources = [r for r in data['resources'] if r.get('provider') == 'Edge']
        print(f"   Edge devices: {len(edge_resources)}")
        
        # Check for AWS resources
        aws_resources = [r for r in data['resources'] if r.get('provider') == 'AWS']
        print(f"   AWS resources: {len(aws_resources)}")
        
        # Show sample resource
        if data['resources']:
            sample = data['resources'][0]
            print(f"   Sample: {sample['resource_id']} ({sample['provider']}) - ${sample.get('cost_monthly', 0)}/month")
    else:
        print(f"❌ Live resources failed: {response.status_code} - {response.text}")

def test_recommendations_with_mcp():
    """Test recommendations endpoint (should now include MCP recommendations)"""
    print("\n9. Testing Recommendations with MCP Integration...")
    
    response = requests.get(f"{BASE_URL}/recommendations/live")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Recommendations retrieved: {data['count']} recommendations")
        print(f"   Total potential savings: ${data['total_potential_savings']}")
        
        # Check for MCP-sourced recommendations
        mcp_recs = [r for r in data['recommendations'] if r.get('source') == 'AWS Unified MCP']
        print(f"   MCP-sourced recommendations: {len(mcp_recs)}")
        
        # Show sample recommendation
        if data['recommendations']:
            sample = data['recommendations'][0]
            print(f"   Sample: {sample.get('recommendation', 'No description')[:100]}...")
            print(f"           Source: {sample.get('source', 'Unknown')}")
    else:
        print(f"❌ Recommendations failed: {response.status_code} - {response.text}")

def main():
    """Run all MCP integration tests"""
    print("=" * 60)
    print("AWS Unified MCP Integration Tests")
    print(f"API URL: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    
    # Check if API is running
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code != 200:
            print("❌ API is not responding to health check")
            return
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Make sure it's running on port 5001")
        return
    
    # Run tests
    test_mcp_search()
    test_mcp_edge_devices()
    test_mcp_cost_analysis()
    test_mcp_query_service()
    test_mcp_unified_query()
    test_mcp_generate_template()
    test_mcp_best_practices()
    test_live_resources_with_mcp()
    test_recommendations_with_mcp()
    
    print("\n" + "=" * 60)
    print("✅ AWS Unified MCP Integration Tests Complete")
    print("=" * 60)

if __name__ == "__main__":
    main()