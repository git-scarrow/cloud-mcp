#!/usr/bin/env python3
"""
Enhanced Notion Sync Service
Provides comprehensive syncing between Oracle database and Notion
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from notion_client import Client
from config import config
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NotionSyncService:
    """Service to sync cloud resources data with Notion databases"""
    
    def __init__(self, oracle_db):
        self.notion = Client(auth=config.NOTION_TOKEN) if config.NOTION_TOKEN else None
        self.oracle_db = oracle_db
        
    def is_configured(self) -> bool:
        """Check if Notion is properly configured"""
        return bool(self.notion and config.NOTION_RESOURCES_DB_ID)
    
    async def sync_resources_to_notion(self) -> Dict:
        """Sync cloud resources from Oracle to Notion"""
        if not self.is_configured():
            return {
                "success": False,
                "error": "Notion not configured",
                "message": "Please configure NOTION_TOKEN and database IDs"
            }
        
        try:
            # Get resources from Oracle
            resources = self._get_resources_from_oracle()
            logger.info(f"Found {len(resources)} resources to sync")
            
            # Sync each resource to Notion
            created = 0
            updated = 0
            errors = []
            
            for resource in resources:
                try:
                    if resource.get('NOTION_PAGE_ID'):
                        # Update existing page
                        self._update_notion_page(resource)
                        updated += 1
                    else:
                        # Create new page
                        page_id = self._create_notion_page(resource)
                        if page_id:
                            # Update Oracle with Notion page ID
                            self._update_oracle_page_id(resource['RESOURCE_ID'], page_id)
                            created += 1
                except Exception as e:
                    errors.append({
                        "resource_id": resource.get('RESOURCE_ID', 'unknown'),
                        "error": str(e)
                    })
                    logger.error(f"Failed to sync resource {resource.get('RESOURCE_ID')}: {e}")
            
            # Sync project summaries
            await self._sync_projects_to_notion()
            
            return {
                "success": True,
                "resources_synced": len(resources),
                "created": created,
                "updated": updated,
                "errors": errors,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Sync failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to sync resources to Notion"
            }
    
    def _get_resources_from_oracle(self) -> List[Dict]:
        """Get all resources from Oracle for syncing"""
        query = """
        SELECT 
            cr.resource_id,
            cr.resource_uuid,
            cr.provider,
            cr.resource_type,
            cr.project_id,
            cr.owner,
            cr.status,
            cr.notion_page_id,
            cr.tags,
            cm.cpu_usage_percent,
            cm.memory_usage_percent,
            cm.cost_monthly,
            cm.anomaly_score,
            cm.metric_time,
            p.project_name
        FROM cloud_resources cr
        LEFT JOIN (
            SELECT resource_id, cpu_usage_percent, memory_usage_percent,
                   cost_monthly, anomaly_score, metric_time,
                   ROW_NUMBER() OVER (PARTITION BY resource_id ORDER BY metric_time DESC) as rn
            FROM cloud_metrics
        ) cm ON cr.resource_id = cm.resource_id AND cm.rn = 1
        LEFT JOIN projects p ON cr.project_id = p.project_id
        ORDER BY cr.last_updated DESC
        """
        
        return self.oracle_db.execute_query(query)
    
    def _create_notion_page(self, resource: Dict) -> Optional[str]:
        """Create a new page in Notion for a resource"""
        try:
            # Determine optimization status
            optimization_status = self._get_optimization_status(resource)
            
            # Create properties based on database schema
            properties = {
                "Resource ID": {"title": [{"text": {"content": resource.get('RESOURCE_ID', 'Unknown')}}]},
                "Provider": {"select": {"name": resource.get('PROVIDER', 'Unknown')}},
                "Resource Type": {"rich_text": [{"text": {"content": resource.get('RESOURCE_TYPE', '')}}]},
                "Status": {"select": {"name": resource.get('STATUS', 'Unknown')}},
                "Owner": {"rich_text": [{"text": {"content": resource.get('OWNER', 'unknown')}}]},
                "Cost Monthly": {"number": float(resource.get('COST_MONTHLY', 0))},
                "CPU Usage": {"number": float(resource.get('CPU_USAGE_PERCENT', 0))},
                "Memory Usage": {"number": float(resource.get('MEMORY_USAGE_PERCENT', 0))},
                "Optimization Flag": {"select": {"name": optimization_status}},
                "Last Updated": {"date": {"start": datetime.utcnow().isoformat()}}
            }
            
            # Add project if configured
            if resource.get('PROJECT_NAME'):
                properties["Project"] = {"rich_text": [{"text": {"content": resource['PROJECT_NAME']}}]}
            
            # Create the page
            response = self.notion.pages.create(
                parent={"database_id": config.NOTION_RESOURCES_DB_ID},
                properties=properties
            )
            
            logger.info(f"Created Notion page for resource {resource['RESOURCE_ID']}")
            return response['id']
            
        except Exception as e:
            logger.error(f"Failed to create Notion page: {e}")
            return None
    
    def _update_notion_page(self, resource: Dict):
        """Update existing Notion page with latest resource data"""
        try:
            optimization_status = self._get_optimization_status(resource)
            
            properties = {
                "Status": {"select": {"name": resource.get('STATUS', 'Unknown')}},
                "Cost Monthly": {"number": float(resource.get('COST_MONTHLY', 0))},
                "CPU Usage": {"number": float(resource.get('CPU_USAGE_PERCENT', 0))},
                "Memory Usage": {"number": float(resource.get('MEMORY_USAGE_PERCENT', 0))},
                "Optimization Flag": {"select": {"name": optimization_status}},
                "Last Updated": {"date": {"start": datetime.utcnow().isoformat()}}
            }
            
            self.notion.pages.update(
                page_id=resource['NOTION_PAGE_ID'],
                properties=properties
            )
            
            logger.info(f"Updated Notion page for resource {resource['RESOURCE_ID']}")
            
        except Exception as e:
            logger.error(f"Failed to update Notion page {resource['NOTION_PAGE_ID']}: {e}")
            raise
    
    def _get_optimization_status(self, resource: Dict) -> str:
        """Determine optimization status for a resource"""
        cpu = float(resource.get('CPU_USAGE_PERCENT', 0))
        cost = float(resource.get('COST_MONTHLY', 0))
        anomaly = float(resource.get('ANOMALY_SCORE', 0))
        
        if cpu < 20:
            return "Underutilized"
        elif anomaly > 0.8:
            return "Cost Anomaly"
        elif cost > 100:
            return "Right-size Candidate"
        else:
            return "Normal"
    
    def _update_oracle_page_id(self, resource_id: str, page_id: str):
        """Update Oracle with Notion page ID"""
        query = """
        UPDATE cloud_resources 
        SET notion_page_id = :page_id,
            last_updated = CURRENT_TIMESTAMP
        WHERE resource_id = :resource_id
        """
        
        self.oracle_db.execute_query(query, {
            'page_id': page_id,
            'resource_id': resource_id
        })
    
    async def _sync_projects_to_notion(self):
        """Sync project summaries to Notion"""
        if not config.NOTION_PROJECTS_DB_ID:
            return
        
        try:
            # Get project data from Oracle
            query = """
            SELECT 
                p.project_id,
                p.project_name,
                p.budget_monthly,
                p.status,
                COUNT(cr.resource_id) as resource_count,
                COALESCE(SUM(cm.cost_monthly), 0) as current_cost
            FROM projects p
            LEFT JOIN cloud_resources cr ON p.project_id = cr.project_id
            LEFT JOIN (
                SELECT resource_id, cost_monthly,
                       ROW_NUMBER() OVER (PARTITION BY resource_id ORDER BY metric_time DESC) as rn
                FROM cloud_metrics
            ) cm ON cr.resource_id = cm.resource_id AND cm.rn = 1
            GROUP BY p.project_id, p.project_name, p.budget_monthly, p.status
            """
            
            projects = self.oracle_db.execute_query(query)
            
            for project in projects:
                try:
                    # Check if project exists in Notion
                    existing = self._find_notion_project(project['PROJECT_ID'])
                    
                    budget_status = self._get_budget_status(
                        float(project['CURRENT_COST']), 
                        float(project['BUDGET_MONTHLY'])
                    )
                    
                    properties = {
                        "Project Name": {"title": [{"text": {"content": project['PROJECT_NAME']}}]},
                        "Project ID": {"rich_text": [{"text": {"content": project['PROJECT_ID']}}]},
                        "Budget Monthly": {"number": float(project['BUDGET_MONTHLY'])},
                        "Current Cost": {"number": float(project['CURRENT_COST'])},
                        "Budget Status": {"select": {"name": budget_status}},
                        "Resource Count": {"number": int(project['RESOURCE_COUNT'])},
                        "Status": {"select": {"name": project['STATUS']}}
                    }
                    
                    if existing:
                        # Update existing
                        self.notion.pages.update(
                            page_id=existing['id'],
                            properties=properties
                        )
                    else:
                        # Create new
                        self.notion.pages.create(
                            parent={"database_id": config.NOTION_PROJECTS_DB_ID},
                            properties=properties
                        )
                    
                except Exception as e:
                    logger.error(f"Failed to sync project {project['PROJECT_ID']}: {e}")
            
        except Exception as e:
            logger.error(f"Failed to sync projects: {e}")
    
    def _find_notion_project(self, project_id: str) -> Optional[Dict]:
        """Find existing project in Notion by project ID"""
        try:
            response = self.notion.databases.query(
                database_id=config.NOTION_PROJECTS_DB_ID,
                filter={
                    "property": "Project ID",
                    "rich_text": {
                        "equals": project_id
                    }
                }
            )
            
            if response['results']:
                return response['results'][0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to find project in Notion: {e}")
            return None
    
    def _get_budget_status(self, current_cost: float, budget: float) -> str:
        """Determine budget status"""
        if budget <= 0:
            return "No Budget"
        
        utilization = current_cost / budget
        
        if utilization > 1.0:
            return "Over Budget"
        elif utilization > 0.9:
            return "Warning"
        else:
            return "On Track"
    
    async def create_optimization_task(self, recommendation: Dict) -> Optional[str]:
        """Create an optimization task in Notion"""
        if not config.NOTION_TASKS_DB_ID:
            return None
        
        try:
            properties = {
                "Task": {"title": [{"text": {"content": recommendation.get('recommendation', 'Optimization needed')}}]},
                "Type": {"select": {"name": "Optimization"}},
                "Status": {"select": {"name": "To Do"}},
                "Due Date": {"date": {"start": (datetime.utcnow().date() + timedelta(days=7)).isoformat()}}
            }
            
            response = self.notion.pages.create(
                parent={"database_id": config.NOTION_TASKS_DB_ID},
                properties=properties
            )
            
            return response['id']
            
        except Exception as e:
            logger.error(f"Failed to create task in Notion: {e}")
            return None