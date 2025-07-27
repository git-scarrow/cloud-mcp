#!/usr/bin/env python3
"""
Batch Sync Service - Oracle MCP Based
Syncs cloud resource data between AWS-unified MCP and Oracle/Notion
"""

import json
import requests
import time
from datetime import datetime
from typing import Dict, List, Optional
from notion_client import Client
import os
from dotenv import load_dotenv
from config import config

load_dotenv()

class CloudSyncService:
    def __init__(self):
        self.notion = Client(auth=config.NOTION_TOKEN)
        self.aws_unified_url = config.AWS_UNIFIED_URL
        
        # Database IDs from configuration
        self.resources_db_id = config.NOTION_RESOURCES_DB_ID
        self.projects_db_id = config.NOTION_PROJECTS_DB_ID
        
    def fetch_cloud_resources(self) -> List[Dict]:
        """Fetch resources from all cloud providers via AWS-unified MCP"""
        all_resources = []
        
        # AWS Resources via MCP
        try:
            aws_query = "list all EC2 instances with costs"
            aws_response = self._query_aws_unified("core", aws_query)
            all_resources.extend(self._parse_aws_resources(aws_response))
        except Exception as e:
            print(f"AWS query failed: {e}")
        
        # GCP Resources via MCP  
        try:
            gcp_query = "list all compute instances with billing"
            gcp_response = self._query_aws_unified("gcp", gcp_query)
            all_resources.extend(self._parse_gcp_resources(gcp_response))
        except Exception as e:
            print(f"GCP query failed: {e}")
            
        # DigitalOcean Resources via MCP
        try:
            do_query = "list all droplets with pricing"
            do_response = self._query_aws_unified("digitalocean", do_query)
            all_resources.extend(self._parse_do_resources(do_response))
        except Exception as e:
            print(f"DigitalOcean query failed: {e}")
            
        return all_resources
    
    def _query_aws_unified(self, service: str, query: str) -> str:
        """Query the AWS-unified MCP server"""
        # This would use MCP JSON-RPC but for now simulate the call
        # In real implementation, would use MCP client library
        return f"Mock response for {service}: {query}"
    
    def _parse_aws_resources(self, response: str) -> List[Dict]:
        """Parse AWS response into standardized format"""
        # Mock data - in real implementation would parse MCP response
        return [{
            "resource_id": "aws-i-demo123",
            "resource_uuid": "i-demo123", 
            "provider": "AWS",
            "resource_type": "EC2 Instance",
            "project_id": config.DEFAULT_PROJECT_ID,
            "status": "Running",
            "owner": "demo-user",
            "cost_monthly": 150.00,
            "cpu_usage": 45.2,
            "memory_usage": 62.1,
            "tags": "production,web-server"
        }]
    
    def _parse_gcp_resources(self, response: str) -> List[Dict]:
        """Parse GCP response into standardized format"""
        return [{
            "resource_id": "gcp-instance-demo456",
            "resource_uuid": "demo456",
            "provider": "GCP", 
            "resource_type": "Compute Engine",
            "project_id": config.DEFAULT_PROJECT_ID,
            "status": "Running",
            "owner": "demo-user",
            "cost_monthly": 85.00,
            "cpu_usage": 28.5,
            "memory_usage": 41.3,
            "tags": "development,api-server"
        }]
    
    def _parse_do_resources(self, response: str) -> List[Dict]:
        """Parse DigitalOcean response into standardized format"""
        return [{
            "resource_id": "do-droplet-demo789",
            "resource_uuid": "demo789",
            "provider": "DigitalOcean",
            "resource_type": "Droplet", 
            "project_id": "proj-edge-002",
            "status": "Active",
            "owner": "edge-user",
            "cost_monthly": 40.00,
            "cpu_usage": 18.7,
            "memory_usage": 33.2,
            "tags": "edge,monitoring"
        }]
    
    def batch_sync_to_oracle(self, resources: List[Dict]) -> Dict:
        """Sync resources to Oracle using MCP calls"""
        results = {"success": 0, "errors": 0, "details": []}
        
        for resource in resources:
            try:
                # Upsert resource record via Oracle MCP
                self._upsert_oracle_resource(resource)
                
                # Insert metrics record via Oracle MCP  
                self._insert_oracle_metrics(resource)
                
                results["success"] += 1
                results["details"].append(f"✓ {resource['resource_id']}")
                
            except Exception as e:
                results["errors"] += 1
                results["details"].append(f"✗ {resource['resource_id']}: {e}")
        
        # Refresh materialized view
        try:
            self._refresh_oracle_mv()
            results["details"].append("✓ Materialized view refreshed")
        except Exception as e:
            results["details"].append(f"✗ MV refresh failed: {e}")
            
        return results
    
    def _upsert_oracle_resource(self, resource: Dict):
        """Upsert resource via Oracle MCP - would use actual MCP call"""
        # This would be an actual Oracle MCP execute_query call
        print(f"UPSERT resource: {resource['resource_id']}")
    
    def _insert_oracle_metrics(self, resource: Dict):
        """Insert metrics via Oracle MCP - would use actual MCP call"""
        # This would be an actual Oracle MCP execute_query call  
        print(f"INSERT metrics for: {resource['resource_id']}")
    
    def _refresh_oracle_mv(self):
        """Refresh materialized view via Oracle MCP"""
        # This would be: DBMS_MVIEW.REFRESH('ANALYTICS.RESOURCE_ANALYTICS_MV')
        print("REFRESH materialized view")
    
    def batch_sync_to_notion(self, resources: List[Dict]) -> Dict:
        """Sync resources to Notion with rate limiting"""
        results = {"success": 0, "errors": 0, "details": []}
        
        for i, resource in enumerate(resources):
            try:
                # Rate limiting: Notion allows 3 req/sec
                if i > 0 and i % 3 == 0:
                    time.sleep(1)
                
                # Check if page exists
                existing_page = self._find_notion_page(resource['resource_uuid'])
                
                if existing_page:
                    # Update existing page
                    self._update_notion_page(existing_page['id'], resource)
                    results["details"].append(f"✓ Updated {resource['resource_id']}")
                else:
                    # Create new page
                    self._create_notion_page(resource)
                    results["details"].append(f"✓ Created {resource['resource_id']}")
                
                results["success"] += 1
                
            except Exception as e:
                results["errors"] += 1
                results["details"].append(f"✗ {resource['resource_id']}: {e}")
        
        return results
    
    def _find_notion_page(self, resource_uuid: str) -> Optional[Dict]:
        """Find existing Notion page by Resource UUID"""
        try:
            response = self.notion.databases.query(
                database_id=self.resources_db_id,
                filter={
                    "property": "Resource UUID",
                    "rich_text": {
                        "equals": resource_uuid
                    }
                }
            )
            return response["results"][0] if response["results"] else None
        except Exception as e:
            print(f"Error finding page: {e}")
            return None
    
    def _create_notion_page(self, resource: Dict):
        """Create new Notion page"""
        self.notion.pages.create(
            parent={"database_id": self.resources_db_id},
            properties={
                "Name": {
                    "title": [{"text": {"content": f"{resource['provider']} - {resource['resource_type']}"}}]
                },
                "Resource UUID": {
                    "rich_text": [{"text": {"content": resource['resource_uuid']}}]
                },
                "Provider": {
                    "select": {"name": resource['provider']}
                },
                "Resource Type": {
                    "rich_text": [{"text": {"content": resource['resource_type']}}]
                },
                "Status": {
                    "select": {"name": resource['status']}
                },
                "Monthly Cost": {
                    "number": resource['cost_monthly']
                },
                "CPU Usage %": {
                    "number": resource['cpu_usage'] / 100
                },
                "Owner": {
                    "rich_text": [{"text": {"content": resource['owner']}}]
                },
                "Project": {
                    "rich_text": [{"text": {"content": resource['project_id']}}]
                },
                "Last Updated": {
                    "date": {"start": datetime.utcnow().isoformat()}
                }
            }
        )
    
    def _update_notion_page(self, page_id: str, resource: Dict):
        """Update existing Notion page"""
        self.notion.pages.update(
            page_id=page_id,
            properties={
                "Status": {
                    "select": {"name": resource['status']}
                },
                "Monthly Cost": {
                    "number": resource['cost_monthly']
                },
                "CPU Usage %": {
                    "number": resource['cpu_usage'] / 100
                },
                "Last Updated": {
                    "date": {"start": datetime.utcnow().isoformat()}
                }
            }
        )
    
    def full_sync_cycle(self) -> Dict:
        """Execute complete sync cycle"""
        print("=== Starting Full Sync Cycle ===")
        start_time = datetime.utcnow()
        
        # Step 1: Fetch from cloud providers
        print("1. Fetching cloud resources...")
        resources = self.fetch_cloud_resources()
        print(f"   Found {len(resources)} resources")
        
        # Step 2: Sync to Oracle
        print("2. Syncing to Oracle...")
        oracle_results = self.batch_sync_to_oracle(resources)
        print(f"   Oracle: {oracle_results['success']} success, {oracle_results['errors']} errors")
        
        # Step 3: Sync to Notion
        print("3. Syncing to Notion...")
        notion_results = self.batch_sync_to_notion(resources)
        print(f"   Notion: {notion_results['success']} success, {notion_results['errors']} errors")
        
        # Summary
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        summary = {
            "timestamp": end_time.isoformat(),
            "duration_seconds": duration,
            "resources_processed": len(resources),
            "oracle_sync": oracle_results,
            "notion_sync": notion_results
        }
        
        print(f"=== Sync Complete ({duration:.1f}s) ===")
        return summary

if __name__ == "__main__":
    sync_service = CloudSyncService()
    result = sync_service.full_sync_cycle()
    print(json.dumps(result, indent=2))