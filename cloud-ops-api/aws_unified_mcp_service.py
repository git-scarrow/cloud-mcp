#!/usr/bin/env python3
"""
AWS Unified MCP Service
Enhanced integration with AWS Unified MCP server for cloud resource management
"""

import aiohttp
import asyncio
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
from config import config

logger = logging.getLogger(__name__)

class AWSUnifiedMCPService:
    """Service to interact with AWS Unified MCP server"""
    
    def __init__(self):
        self.base_url = config.AWS_UNIFIED_URL
        self.timeout = config.AWS_UNIFIED_TIMEOUT
        
    async def query_service(self, service: str, query: str, options: Dict = None) -> Any:
        """Query a specific AWS unified service"""
        endpoint = f"{self.base_url}/api/query_service"
        payload = {
            "service": service,
            "query": query,
            "options": options or {}
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(endpoint, json=payload, timeout=self.timeout) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logger.error(f"MCP query failed: {response.status}")
                        return None
            except Exception as e:
                logger.error(f"MCP service query error: {e}")
                return None
    
    async def unified_query(self, query: str, services: List[str] = None) -> Dict:
        """Query multiple AWS services simultaneously"""
        endpoint = f"{self.base_url}/api/unified_query"
        payload = {
            "query": query,
            "services": services or ["knowledge", "documentation", "edge", "terraform", "cloudformation"],
            "options": {
                "format": "json",
                "maxResults": 100
            }
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(endpoint, json=payload, timeout=self.timeout) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logger.error(f"Unified query failed: {response.status}")
                        return {}
            except Exception as e:
                logger.error(f"Unified query error: {e}")
                return {}
    
    async def search_aws(self, search_term: str, filters: Dict = None) -> Dict:
        """Search across AWS documentation and knowledge bases"""
        endpoint = f"{self.base_url}/api/search_aws"
        payload = {
            "searchTerm": search_term,
            "filters": filters or {}
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(endpoint, json=payload, timeout=self.timeout) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logger.error(f"AWS search failed: {response.status}")
                        return {}
            except Exception as e:
                logger.error(f"AWS search error: {e}")
                return {}
    
    async def generate_template(self, template_type: str, resource: str, options: Dict = None) -> Dict:
        """Generate infrastructure as code templates"""
        endpoint = f"{self.base_url}/api/generate_template"
        payload = {
            "type": template_type,
            "resource": resource,
            "options": options or {}
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(endpoint, json=payload, timeout=self.timeout) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logger.error(f"Template generation failed: {response.status}")
                        return {}
            except Exception as e:
                logger.error(f"Template generation error: {e}")
                return {}
    
    async def validate_template(self, template_type: str, template: str) -> Dict:
        """Validate CloudFormation or Terraform templates"""
        endpoint = f"{self.base_url}/api/validate_template"
        payload = {
            "type": template_type,
            "template": template
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(endpoint, json=payload, timeout=self.timeout) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logger.error(f"Template validation failed: {response.status}")
                        return {"valid": False, "errors": ["Validation failed"]}
            except Exception as e:
                logger.error(f"Template validation error: {e}")
                return {"valid": False, "errors": [str(e)]}
    
    async def get_edge_devices(self) -> List[Dict]:
        """Get edge device information with live connectivity checks"""
        # Get the static MCP data first
        result = await self.query_service("edge", "list devices", {"format": "json"})
        
        # Known edge devices from your infrastructure
        known_devices = ["pifive0", "piiv", "piiv2"]
        devices = []
        
        # Perform live connectivity checks for each device
        for device_id in known_devices:
            try:
                # Test SSH connectivity
                status = await self._check_device_connectivity(device_id)
                device = {
                    "deviceId": device_id,
                    "status": status["status"],
                    "lastSeen": status["last_check"],
                    "uptime": status.get("uptime", "unknown"),
                    "load_average": status.get("load_average", "unknown"),
                    "provider": "Edge",
                    "resourceType": "Edge Device"
                }
                devices.append(device)
            except Exception as e:
                logger.warning(f"Failed to check device {device_id}: {e}")
                device = {
                    "deviceId": device_id,
                    "status": "error",
                    "lastSeen": "check failed",
                    "error": str(e),
                    "provider": "Edge",
                    "resourceType": "Edge Device"
                }
                devices.append(device)
        
        return devices
    
    async def _check_device_connectivity(self, device_id: str) -> Dict:
        """Check live connectivity to an edge device using available MCP SSH tools"""
        try:
            # Try to use the MCP SSH tools for connectivity check
            # Map device names to their MCP tool equivalents
            mcp_tool_map = {
                "pifive0": "mcp__ssh-pifive0__exec",
                "piiv": "mcp__ssh-piiv__exec", 
                "piiv2": "mcp__ssh-piiv2__exec"
            }
            
            if device_id in mcp_tool_map:
                # Since we can't directly call MCP tools from here,
                # we'll use a simpler SSH approach with the correct hostname
                import subprocess
                
                # Use SSH to check if device is responsive
                cmd = [
                    "ssh", "-o", "ConnectTimeout=3", 
                    "-o", "BatchMode=yes",
                    "-o", "StrictHostKeyChecking=no",
                    f"sam@{device_id}",  # Try without .local first
                    "echo 'online' && uptime"
                ]
                
                try:
                    result = subprocess.run(
                        cmd, 
                        capture_output=True, 
                        text=True, 
                        timeout=5
                    )
                    
                    if result.returncode == 0:
                        output = result.stdout.strip()
                        lines = output.split('\n')
                        
                        if len(lines) >= 2 and 'online' in lines[0]:
                            uptime_line = lines[1].strip()
                            # Parse uptime for load average
                            load_avg = "unknown"
                            if "load average:" in uptime_line:
                                load_avg = uptime_line.split("load average:")[-1].strip()
                            
                            return {
                                "status": "online",
                                "last_check": datetime.now(timezone.utc).isoformat(),
                                "uptime": uptime_line,
                                "load_average": load_avg
                            }
                        else:
                            return {
                                "status": "responding",
                                "last_check": datetime.now(timezone.utc).isoformat(),
                                "uptime": output
                            }
                    else:
                        # Try with .local suffix if direct connection failed
                        cmd[4] = f"sam@{device_id}.local"
                        result2 = subprocess.run(
                            cmd, 
                            capture_output=True, 
                            text=True, 
                            timeout=5
                        )
                        
                        if result2.returncode == 0:
                            output = result2.stdout.strip()
                            lines = output.split('\n')
                            
                            if len(lines) >= 2 and 'online' in lines[0]:
                                uptime_line = lines[1].strip()
                                load_avg = "unknown"
                                if "load average:" in uptime_line:
                                    load_avg = uptime_line.split("load average:")[-1].strip()
                                
                                return {
                                    "status": "online",
                                    "last_check": datetime.now(timezone.utc).isoformat(),
                                    "uptime": uptime_line,
                                    "load_average": load_avg
                                }
                        
                        return {
                            "status": "offline",
                            "last_check": datetime.now(timezone.utc).isoformat(),
                            "error": result.stderr.strip() if result.stderr else "SSH connection failed"
                        }
                        
                except subprocess.TimeoutExpired:
                    return {
                        "status": "timeout",
                        "last_check": datetime.now(timezone.utc).isoformat(),
                        "error": "SSH connection timeout"
                    }
            else:
                return {
                    "status": "unknown",
                    "last_check": datetime.now(timezone.utc).isoformat(),
                    "error": f"No MCP tool mapping for device {device_id}"
                }
                
        except Exception as e:
            return {
                "status": "error", 
                "last_check": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }
    
    async def get_cost_analysis(self) -> Dict:
        """Get comprehensive cost analysis from AWS Unified"""
        # Query multiple services for cost data
        cost_queries = await asyncio.gather(
            self.query_service("edge", "cost analysis", {"format": "json"}),
            self.query_service("knowledge", "AWS free tier usage", {"format": "json"}),
            self.unified_query("current AWS costs and optimization opportunities")
        )
        
        # Combine results
        cost_data = {
            "edge_costs": cost_queries[0] if cost_queries[0] else {},
            "free_tier_status": cost_queries[1] if cost_queries[1] else {},
            "optimization_opportunities": cost_queries[2] if cost_queries[2] else {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        return cost_data
    
    async def get_resource_recommendations(self, resource_type: str = None) -> List[Dict]:
        """Get resource optimization recommendations"""
        query = f"optimization recommendations for {resource_type}" if resource_type else "all resource optimization recommendations"
        
        result = await self.unified_query(query, ["knowledge", "documentation"])
        
        recommendations = []
        if result:
            # Parse recommendations from the unified query result
            for service, data in result.items():
                if isinstance(data, dict) and "recommendations" in data:
                    recommendations.extend(data["recommendations"])
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and any(key in item for key in ["recommendation", "optimization", "suggestion"]):
                            recommendations.append(item)
        
        return recommendations
    
    async def get_infrastructure_templates(self, resource_types: List[str]) -> Dict:
        """Get IaC templates for multiple resource types"""
        templates = {}
        
        # Generate both Terraform and CloudFormation templates
        template_tasks = []
        for resource in resource_types:
            template_tasks.extend([
                self.generate_template("terraform", resource),
                self.generate_template("cloudformation", resource)
            ])
        
        results = await asyncio.gather(*template_tasks, return_exceptions=True)
        
        # Organize results
        for i, resource in enumerate(resource_types):
            terraform_result = results[i * 2]
            cloudformation_result = results[i * 2 + 1]
            
            templates[resource] = {
                "terraform": terraform_result if not isinstance(terraform_result, Exception) else None,
                "cloudformation": cloudformation_result if not isinstance(cloudformation_result, Exception) else None
            }
        
        return templates
    
    async def search_documentation(self, topic: str, service: str = None) -> Dict:
        """Search AWS documentation for specific topics"""
        filters = {"service": service} if service else {}
        return await self.search_aws(topic, filters)
    
    async def get_service_limits(self, services: List[str] = None) -> Dict:
        """Get AWS service limits and quotas"""
        query = "AWS service limits and quotas"
        if services:
            query += f" for {', '.join(services)}"
        
        result = await self.unified_query(query, ["knowledge", "documentation"])
        return result
    
    async def get_best_practices(self, topic: str) -> Dict:
        """Get AWS best practices for specific topics"""
        return await self.search_aws(f"best practices {topic}", {"type": "best-practices"})

# Create singleton instance
aws_unified_mcp_service = AWSUnifiedMCPService()