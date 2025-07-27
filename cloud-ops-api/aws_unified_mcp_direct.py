#!/usr/bin/env python3
"""
AWS Unified MCP Direct Integration
Uses MCP tools directly for AWS Unified server
"""

import logging
from typing import List, Dict, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class AWSUnifiedMCPDirect:
    """Direct integration with AWS Unified MCP tools"""
    
    async def query_service(self, service: str, query: str, options: Dict = None) -> Any:
        """Query a specific AWS unified service using MCP tool"""
        try:
            # Import and use the MCP tool directly
            from mcp__aws_unified__query_service import query_service as mcp_query
            
            result = await mcp_query(
                service=service,
                query=query,
                options=options or {}
            )
            return result
        except Exception as e:
            logger.error(f"MCP direct query error: {e}")
            return None
    
    async def unified_query(self, query: str, services: List[str] = None) -> Dict:
        """Query multiple AWS services simultaneously using MCP tool"""
        try:
            from mcp__aws_unified__unified_query import unified_query as mcp_unified
            
            result = await mcp_unified(
                query=query,
                services=services,
                options={"format": "json", "maxResults": 100}
            )
            return result
        except Exception as e:
            logger.error(f"MCP unified query error: {e}")
            return {}
    
    async def search_aws(self, search_term: str, filters: Dict = None) -> Dict:
        """Search across AWS documentation using MCP tool"""
        try:
            from mcp__aws_unified__search_aws import search_aws as mcp_search
            
            result = await mcp_search(
                searchTerm=search_term,
                filters=filters or {}
            )
            return result
        except Exception as e:
            logger.error(f"MCP search error: {e}")
            return {}
    
    def parse_edge_devices_from_markdown(self, markdown_content: str) -> List[Dict]:
        """Parse edge device information from markdown response"""
        devices = []
        
        if not markdown_content:
            return devices
        
        lines = markdown_content.split('\n')
        in_device_table = False
        
        for line in lines:
            if "Device | Status" in line:
                in_device_table = True
                continue
            elif in_device_table and '|' in line and not line.startswith('|--'):
                parts = [p.strip() for p in line.split('|') if p.strip()]
                if len(parts) >= 3:
                    device = {
                        "deviceId": parts[0],
                        "status": "online" if "🟢" in parts[1] else "offline",
                        "lastSeen": parts[2] if len(parts) > 2 else "unknown",
                        "provider": "Edge",
                        "resourceType": "Edge Device"
                    }
                    devices.append(device)
            elif in_device_table and not line.strip():
                break
        
        return devices
    
    def parse_cost_analysis_from_markdown(self, markdown_content: str) -> Dict:
        """Parse cost analysis from markdown response"""
        cost_data = {
            "edge_devices": 0,
            "monthly_cost": 0,
            "free_tier_usage": {},
            "optimization_status": "unknown"
        }
        
        if not markdown_content:
            return cost_data
        
        lines = markdown_content.split('\n')
        
        for line in lines:
            # Parse S3 usage
            if "**S3**:" in line and "used of" in line:
                try:
                    usage = line.split(':')[1].strip()
                    cost_data["free_tier_usage"]["s3"] = usage
                except:
                    pass
            
            # Parse power costs
            elif "**Power**:" in line and "$" in line:
                try:
                    cost_range = line.split(':')[1].strip()
                    # Extract average from range like "$5-10/month"
                    if "-" in cost_range:
                        low = float(cost_range.split('-')[0].replace('$', ''))
                        high = float(cost_range.split('-')[1].split('/')[0])
                        cost_data["monthly_cost"] = (low + high) / 2
                except:
                    pass
            
            # Parse optimization status
            elif "✅" in line and "optimal" in line.lower():
                cost_data["optimization_status"] = "optimal"
        
        return cost_data

# Create singleton instance
aws_unified_mcp_direct = AWSUnifiedMCPDirect()