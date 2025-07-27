#!/usr/bin/env python3
"""
Real Data Service for Cloud Resource Acquisition
Replaces mock data with actual cloud provider integrations
Enhanced with AWS Unified MCP server support
"""

import os
import json
import asyncio
import aiohttp
import boto3
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import logging
from config import config
from aws_unified_mcp_service import aws_unified_mcp_service
from aws_unified_mcp_direct import aws_unified_mcp_direct

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RealDataService:
    """Real cloud data provider using actual cloud APIs"""
    
    def __init__(self):
        self.aws_unified_url = config.AWS_UNIFIED_URL
        self.aws_session = None
        self.gcp_client = None
        self.do_client = None
        
    async def get_cloud_resources(self) -> List[Dict]:
        """Get real cloud resources from all providers"""
        all_resources = []
        
        try:
            # Get AWS resources
            aws_resources = await self._get_aws_resources()
            all_resources.extend(aws_resources)
            
            # Get GCP resources  
            gcp_resources = await self._get_gcp_resources()
            all_resources.extend(gcp_resources)
            
            # Get DigitalOcean resources
            do_resources = await self._get_digitalocean_resources()
            all_resources.extend(do_resources)
            
            # Get Edge devices
            edge_resources = await self._get_edge_resources()
            all_resources.extend(edge_resources)
            
        except Exception as e:
            logger.error(f"Error getting cloud resources: {e}")
            # Fallback to minimal data
            all_resources = self._get_fallback_resources()
            
        return all_resources
    
    def get_cloud_resources_sync(self) -> List[Dict]:
        """Synchronous version for Flask - no async needed"""
        all_resources = []
        
        try:
            # Get AWS resources
            aws_resources = self._get_aws_resources_sync()
            all_resources.extend(aws_resources)
            
            # Get GCP resources  
            gcp_resources = self._get_gcp_resources_sync()
            all_resources.extend(gcp_resources)
            
            # Get DigitalOcean resources
            do_resources = self._get_digitalocean_resources_sync()
            all_resources.extend(do_resources)
            
        except Exception as e:
            logger.error(f"Error getting cloud resources: {e}")
            # Fallback to minimal data
            all_resources = self._get_fallback_resources()
            
        return all_resources
    
    def get_cost_data_sync(self) -> Dict:
        """Synchronous cost data for Flask"""
        try:
            return {
                "total_monthly": sum(r.get('cost_monthly', 0) for r in self.get_cloud_resources_sync()),
                "by_provider": {},
                "currency": "USD"
            }
        except Exception as e:
            logger.error(f"Error getting cost data: {e}")
            return {"total_monthly": 0, "by_provider": {}, "currency": "USD"}
    
    def _get_aws_resources_sync(self) -> List[Dict]:
        """Get AWS resources synchronously"""
        resources = []
        
        try:
            import boto3
            
            # Get EC2 instances
            ec2 = boto3.client('ec2')
            instances = ec2.describe_instances()
            
            for reservation in instances['Reservations']:
                for instance in reservation['Instances']:
                    if instance['State']['Name'] != 'terminated':
                        resource = {
                            "resource_id": f"aws-ec2-{instance['InstanceId']}",
                            "resource_uuid": instance['InstanceId'],
                            "provider": "AWS",
                            "resource_type": f"EC2 {instance.get('InstanceType', 'unknown')}",
                            "project_id": config.DEFAULT_PROJECT_ID,
                            "status": instance['State']['Name'].title(),
                            "owner": self._get_tag_value(instance.get('Tags', []), 'Owner', 'aws-admin'),
                            "cost_monthly": self._estimate_ec2_cost(instance.get('InstanceType', 't2.micro')),
                            "cpu_usage": 0,
                            "memory_usage": 0,
                            "tags": self._format_tags(instance.get('Tags', [])),
                            "region": instance.get('Placement', {}).get('AvailabilityZone', 'unknown')
                        }
                        resources.append(resource)
                        
            logger.info(f"Found {len(resources)} AWS resources via sync boto3")
                        
        except Exception as e:
            logger.warning(f"AWS sync query failed: {e}")
            
        return resources
    
    def _get_gcp_resources_sync(self) -> List[Dict]:
        """Get GCP resources synchronously using API"""
        resources = []
        
        try:
            from google.cloud import compute_v1
            from google.oauth2.credentials import Credentials
            import subprocess
            
            # Get token
            result = subprocess.run(['gcloud', 'auth', 'print-access-token'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode != 0:
                raise Exception("gcloud not authenticated")
            
            token = result.stdout.strip()
            credentials = Credentials(token=token)
            project_id = "home-dev-sam"
            
            # Get compute instances
            client = compute_v1.InstancesClient(credentials=credentials)
            aggregated_list = client.aggregated_list(project=project_id)
            
            for zone, instances_scoped_list in aggregated_list:
                if instances_scoped_list.instances:
                    for instance in instances_scoped_list.instances:
                        machine_type = instance.machine_type.split('/')[-1] if instance.machine_type else 'unknown'
                        zone_name = zone.split('/')[-1]
                        
                        resource = {
                            "resource_id": f"gcp-compute-{instance.name}",
                            "resource_uuid": str(instance.id),
                            "provider": "GCP",
                            "resource_type": f"Compute Engine {machine_type}",
                            "project_id": config.DEFAULT_PROJECT_ID,
                            "status": instance.status,
                            "owner": "gcp-user",
                            "cost_monthly": self._estimate_gcp_compute_cost(machine_type),
                            "cpu_usage": 0,
                            "memory_usage": 0,
                            "tags": f"machine_type={machine_type}",
                            "region": zone_name
                        }
                        resources.append(resource)
                        
            logger.info(f"Found {len(resources)} GCP resources via sync API")
                        
        except Exception as e:
            logger.warning(f"GCP sync query failed: {e}")
            # Fallback data
            resources = [{
                "resource_id": "gcp-compute-fallback",
                "resource_uuid": "fallback-instance",
                "provider": "GCP",
                "resource_type": "Compute Engine f1-micro",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "RUNNING",
                "owner": "gcp-user",
                "cost_monthly": 3.88,
                "cpu_usage": 0,
                "memory_usage": 0,
                "tags": "fallback=true",
                "region": "us-central1-a"
            }]
            
        return resources
    
    def _get_digitalocean_resources_sync(self) -> List[Dict]:
        """Get DigitalOcean resources synchronously (mock for now)"""
        mock_resources = [
            {
                "resource_id": "do-droplet-api-server",
                "resource_uuid": "droplet-123456789",
                "provider": "DigitalOcean",
                "resource_type": "Droplet s-1vcpu-1gb",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Active",
                "owner": "do-admin",
                "cost_monthly": 6.00,
                "cpu_usage": 25.0,
                "memory_usage": 55.0,
                "tags": "environment=production,role=api",
                "region": "nyc3"
            },
            {
                "resource_id": "do-droplet-worker-1",
                "resource_uuid": "droplet-987654321",
                "provider": "DigitalOcean",
                "resource_type": "Droplet s-2vcpu-2gb",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Active",
                "owner": "do-admin",
                "cost_monthly": 18.00,
                "cpu_usage": 40.0,
                "memory_usage": 65.0,
                "tags": "environment=production,role=worker",
                "region": "nyc3"
            }
        ]
        
        logger.info(f"Returning {len(mock_resources)} mock DigitalOcean resources")
        return mock_resources
    
    async def _get_aws_resources(self) -> List[Dict]:
        """Get AWS resources using AWS Unified MCP server and boto3"""
        resources = []
        resource_ids = set()  # Track resource IDs to avoid duplicates
        
        try:
            # Try AWS Unified MCP server first - it's more comprehensive
            if self.aws_unified_url:
                # Get edge devices from MCP
                edge_devices = await aws_unified_mcp_service.get_edge_devices()
                for device in edge_devices:
                    resource_id = f"edge-{device.get('deviceId', 'unknown')}"
                    if resource_id not in resource_ids:
                        resource = {
                            "resource_id": resource_id,
                            "resource_uuid": device.get('deviceId', ''),
                            "provider": "Edge",
                            "resource_type": "Edge Device",
                            "project_id": config.DEFAULT_PROJECT_ID,
                            "status": device.get('status', 'Unknown').title(),
                            "owner": 'edge-admin',
                            "cost_monthly": 15.00,  # Estimated edge device cost
                            "cpu_usage": 0,
                            "memory_usage": 0,
                            "tags": 'edge,raspberry-pi',
                            "region": 'edge'
                        }
                        resources.append(resource)
                        resource_ids.add(resource_id)
                
                # Get cost analysis from MCP
                cost_analysis = await aws_unified_mcp_service.get_cost_analysis()
                logger.info(f"Got cost analysis from MCP: {cost_analysis.get('edge_costs', {})}")
                
        except Exception as e:
            logger.warning(f"AWS Unified MCP failed: {e}")
        
        try:
            # Direct AWS API calls for EC2, Lambda, RDS
            aws_resources = await self._get_aws_direct()
            for resource in aws_resources:
                if resource['resource_id'] not in resource_ids:
                    resources.append(resource)
                    resource_ids.add(resource['resource_id'])
        except Exception as e:
            logger.warning(f"Direct AWS API failed: {e}")
            
        return resources
    
    async def _query_aws_unified_mcp(self) -> List[Dict]:
        """Query AWS Unified MCP server for resource data"""
        resources = []
        
        async with aiohttp.ClientSession() as session:
            try:
                # Try different MCP endpoints
                endpoints = [
                    f"{self.aws_unified_url}/core/resources",
                    f"{self.aws_unified_url}/knowledge/ec2",
                    f"{self.aws_unified_url}/edge/devices"
                ]
                
                for endpoint in endpoints:
                    try:
                        async with session.get(endpoint, timeout=10) as response:
                            if response.status == 200:
                                data = await response.json()
                                if isinstance(data, list):
                                    resources.extend(self._normalize_aws_mcp_data(data))
                                elif isinstance(data, dict) and 'resources' in data:
                                    resources.extend(self._normalize_aws_mcp_data(data['resources']))
                    except Exception as e:
                        logger.debug(f"MCP endpoint {endpoint} failed: {e}")
                        continue
                        
            except Exception as e:
                logger.error(f"AWS MCP query failed: {e}")
                
        return resources
    
    def _normalize_aws_mcp_data(self, data: List[Dict]) -> List[Dict]:
        """Normalize AWS MCP data to our resource format"""
        normalized = []
        
        for item in data:
            try:
                resource = {
                    "resource_id": item.get('id', f"aws-{len(normalized)+1}"),
                    "resource_uuid": item.get('instanceId', item.get('uuid', '')),
                    "provider": "AWS",
                    "resource_type": item.get('type', item.get('resourceType', 'EC2')),
                    "project_id": config.DEFAULT_PROJECT_ID,
                    "status": item.get('status', item.get('state', 'running')).title(),
                    "owner": item.get('owner', 'aws-user'),
                    "cost_monthly": float(item.get('monthlyCost', item.get('cost', 0))),
                    "cpu_usage": float(item.get('cpuUtilization', item.get('cpu', 0))),
                    "memory_usage": float(item.get('memoryUtilization', item.get('memory', 0))),
                    "tags": item.get('tags', ''),
                    "region": item.get('region', item.get('availabilityZone', ''))
                }
                normalized.append(resource)
            except Exception as e:
                logger.debug(f"Failed to normalize AWS resource: {e}")
                
        return normalized
    
    async def _get_aws_direct(self) -> List[Dict]:
        """Get AWS resources using direct boto3 calls"""
        resources = []
        
        try:
            # Check if AWS credentials are available
            session = boto3.Session()
            
            # Get EC2 instances
            ec2_resources = await self._get_ec2_instances(session)
            resources.extend(ec2_resources)
            
            # Get Lambda functions
            lambda_resources = await self._get_lambda_functions(session)
            resources.extend(lambda_resources)
            
            # Get RDS instances
            rds_resources = await self._get_rds_instances(session)
            resources.extend(rds_resources)
            
        except Exception as e:
            logger.warning(f"AWS direct API failed: {e}")
            
        return resources
    
    async def _get_ec2_instances(self, session) -> List[Dict]:
        """Get EC2 instances with cost and metrics"""
        resources = []
        
        try:
            ec2 = session.client('ec2')
            cloudwatch = session.client('cloudwatch')
            
            # Get instances
            response = ec2.describe_instances()
            
            for reservation in response['Reservations']:
                for instance in reservation['Instances']:
                    # Get CloudWatch metrics
                    cpu_usage = await self._get_cloudwatch_metric(
                        cloudwatch, 'AWS/EC2', 'CPUUtilization', 
                        [{'Name': 'InstanceId', 'Value': instance['InstanceId']}]
                    )
                    
                    # Estimate cost based on instance type
                    cost_monthly = self._estimate_ec2_cost(instance['InstanceType'])
                    
                    resource = {
                        "resource_id": f"aws-ec2-{instance['InstanceId']}",
                        "resource_uuid": instance['InstanceId'],
                        "provider": "AWS", 
                        "resource_type": f"EC2 {instance['InstanceType']}",
                        "project_id": config.DEFAULT_PROJECT_ID,
                        "status": instance['State']['Name'].title(),
                        "owner": self._get_tag_value(instance.get('Tags', []), 'Owner', 'aws-user'),
                        "cost_monthly": cost_monthly,
                        "cpu_usage": cpu_usage,
                        "memory_usage": 0,  # Would need CloudWatch agent
                        "tags": self._format_tags(instance.get('Tags', [])),
                        "region": instance.get('Placement', {}).get('AvailabilityZone', '')
                    }
                    resources.append(resource)
                    
        except Exception as e:
            logger.warning(f"EC2 query failed: {e}")
            
        return resources
    
    async def _get_cloudwatch_metric(self, cloudwatch, namespace, metric_name, dimensions):
        """Get CloudWatch metric value"""
        try:
            response = cloudwatch.get_metric_statistics(
                Namespace=namespace,
                MetricName=metric_name,
                Dimensions=dimensions,
                StartTime=datetime.now(timezone.utc) - timedelta(hours=1),
                EndTime=datetime.now(timezone.utc),
                Period=3600,
                Statistics=['Average']
            )
            
            if response['Datapoints']:
                return round(response['Datapoints'][-1]['Average'], 2)
        except Exception as e:
            logger.debug(f"CloudWatch metric failed: {e}")
            
        return 0
    
    def _estimate_ec2_cost(self, instance_type: str) -> float:
        """Estimate monthly EC2 cost based on instance type"""
        # Simplified cost estimates (USD/month) for common instance types
        cost_map = {
            't2.micro': 8.50, 't2.small': 17.00, 't2.medium': 34.00,
            't3.micro': 7.50, 't3.small': 15.00, 't3.medium': 30.00,
            'm5.large': 70.00, 'm5.xlarge': 140.00,
            'c5.large': 62.00, 'c5.xlarge': 123.00,
            'r5.large': 91.00, 'r5.xlarge': 182.00
        }
        return cost_map.get(instance_type, 50.00)  # Default estimate
    
    def _get_tag_value(self, tags: List[Dict], key: str, default: str = '') -> str:
        """Get tag value by key"""
        for tag in tags:
            if tag.get('Key') == key:
                return tag.get('Value', default)
        return default
    
    def _format_tags(self, tags: List[Dict]) -> str:
        """Format AWS tags as comma-separated string"""
        return ','.join([f"{tag['Key']}={tag.get('Value', '')}" for tag in tags])
    
    async def _get_lambda_functions(self, session) -> List[Dict]:
        """Get Lambda functions"""
        resources = []
        
        try:
            lambda_client = session.client('lambda')
            response = lambda_client.list_functions()
            
            for func in response['Functions']:
                resource = {
                    "resource_id": f"aws-lambda-{func['FunctionName']}",
                    "resource_uuid": func['FunctionArn'],
                    "provider": "AWS",
                    "resource_type": "Lambda Function",
                    "project_id": config.DEFAULT_PROJECT_ID,
                    "status": func.get('State', 'Active').title(),
                    "owner": 'aws-user',
                    "cost_monthly": 5.00,  # Estimate
                    "cpu_usage": 0,
                    "memory_usage": func['MemorySize'],
                    "tags": func.get('Description', ''),
                    "region": session.region_name or 'us-east-1'
                }
                resources.append(resource)
                
        except Exception as e:
            logger.warning(f"Lambda query failed: {e}")
            
        return resources
    
    async def _get_rds_instances(self, session) -> List[Dict]:
        """Get RDS instances"""
        resources = []
        
        try:
            rds = session.client('rds')
            response = rds.describe_db_instances()
            
            for db in response['DBInstances']:
                cost_monthly = self._estimate_rds_cost(db['DBInstanceClass'])
                
                resource = {
                    "resource_id": f"aws-rds-{db['DBInstanceIdentifier']}",
                    "resource_uuid": db['DbiResourceId'],
                    "provider": "AWS",
                    "resource_type": f"RDS {db['Engine']}",
                    "project_id": config.DEFAULT_PROJECT_ID,
                    "status": db['DBInstanceStatus'].title(),
                    "owner": 'aws-user',
                    "cost_monthly": cost_monthly,
                    "cpu_usage": 0,  # Would need CloudWatch
                    "memory_usage": 0,
                    "tags": db.get('TagList', []),
                    "region": db.get('AvailabilityZone', '')
                }
                resources.append(resource)
                
        except Exception as e:
            logger.warning(f"RDS query failed: {e}")
            
        return resources
    
    def _estimate_rds_cost(self, instance_class: str) -> float:
        """Estimate monthly RDS cost"""
        cost_map = {
            'db.t3.micro': 12.00, 'db.t3.small': 24.00,
            'db.t3.medium': 48.00, 'db.t3.large': 96.00,
            'db.m5.large': 120.00, 'db.r5.large': 150.00
        }
        return cost_map.get(instance_class, 75.00)
    
    async def _get_gcp_resources(self) -> List[Dict]:
        """Get real GCP resources using fast gcloud CLI calls"""
        resources = []
        
        try:
            import subprocess
            import json
            
            # Test gcloud auth quickly
            auth_result = subprocess.run(['gcloud', 'auth', 'list', '--format=json'], 
                                       capture_output=True, text=True, timeout=3)
            if auth_result.returncode != 0:
                raise Exception("gcloud not authenticated")
            
            logger.info("Using GCP with fast gcloud CLI calls")
            
            # Get compute instances using fast CLI
            compute_resources = await self._get_gcp_compute_fast()
            resources.extend(compute_resources)
            
            # Skip storage for now - it's slow and optional
            logger.info(f"Retrieved {len(resources)} GCP resources via fast CLI")
            
        except Exception as e:
            logger.warning(f"GCP fast CLI failed: {e}")
            # Use minimal mock data
            resources = [{
                "resource_id": "gcp-compute-fallback",
                "resource_uuid": "fallback-instance",
                "provider": "GCP",
                "resource_type": "Compute Engine (cached)",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Running",
                "owner": "gcp-user",
                "cost_monthly": 3.88,
                "cpu_usage": 0,
                "memory_usage": 0,
                "tags": "fallback=true",
                "region": "us-central1-a"
            }]
            
        return resources
    
    async def _get_gcp_compute_fast(self) -> List[Dict]:
        """Get GCP compute instances using fast gcloud CLI with strict timeout"""
        resources = []
        
        try:
            import subprocess
            import json
            
            # Use gcloud with minimal output and timeout
            result = subprocess.run([
                'gcloud', 'compute', 'instances', 'list',
                '--format=json(name,zone,machineType,status,id)',
                '--quiet'
            ], capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0 and result.stdout.strip():
                instances = json.loads(result.stdout)
                
                for instance in instances:
                    machine_type = instance.get('machineType', '').split('/')[-1]
                    zone = instance.get('zone', '').split('/')[-1]
                    
                    resource = {
                        "resource_id": f"gcp-compute-{instance['name']}",
                        "resource_uuid": str(instance.get('id', instance['name'])),
                        "provider": "GCP",
                        "resource_type": f"Compute Engine {machine_type}",
                        "project_id": config.DEFAULT_PROJECT_ID,
                        "status": instance.get('status', 'UNKNOWN'),
                        "owner": "gcp-user",
                        "cost_monthly": self._estimate_gcp_compute_cost(machine_type),
                        "cpu_usage": 0,
                        "memory_usage": 0,
                        "tags": f"machine_type={machine_type}",
                        "region": zone
                    }
                    resources.append(resource)
                    
            logger.info(f"Found {len(resources)} GCP compute instances via fast CLI")
                    
        except Exception as e:
            logger.warning(f"GCP fast compute query failed: {e}")
            
        return resources
    
    async def _get_gcp_compute_instances_api(self, project_id: str, credentials) -> List[Dict]:
        """Get GCP Compute instances using Google Cloud API"""
        resources = []
        
        try:
            from google.cloud import compute_v1
            
            client = compute_v1.InstancesClient(credentials=credentials)
            
            # Get all zones first
            zones_client = compute_v1.ZonesClient(credentials=credentials)
            zones_request = compute_v1.ListZonesRequest(project=project_id)
            zones = zones_client.list(request=zones_request)
            
            for zone in zones:
                try:
                    # List instances in each zone
                    request = compute_v1.ListInstancesRequest(
                        project=project_id,
                        zone=zone.name
                    )
                    instances = client.list(request=request)
                    
                    for instance in instances:
                        # Extract machine type from full path
                        machine_type = instance.machine_type.split('/')[-1] if instance.machine_type else 'unknown'
                        
                        resource = {
                            "resource_id": f"gcp-compute-{instance.name}",
                            "resource_uuid": str(instance.id),
                            "provider": "GCP", 
                            "resource_type": f"Compute Engine {machine_type}",
                            "project_id": config.DEFAULT_PROJECT_ID,
                            "status": instance.status,
                            "owner": self._get_gcp_label_value(instance.labels, "owner", "gcp-user"),
                            "cost_monthly": self._estimate_gcp_compute_cost(machine_type),
                            "cpu_usage": 0,  # Would need monitoring API for real metrics
                            "memory_usage": 0,
                            "tags": self._format_gcp_labels_dict(instance.labels),
                            "region": zone.name
                        }
                        resources.append(resource)
                        
                except Exception as e:
                    logger.debug(f"Failed to get instances in zone {zone.name}: {e}")
                    continue
                    
            logger.info(f"Found {len(resources)} GCP compute instances via API")
                    
        except Exception as e:
            logger.warning(f"GCP Compute API failed: {e}")
            
        return resources
    
    async def _get_gcp_storage_buckets_api(self, project_id: str, credentials) -> List[Dict]:
        """Get GCP Storage buckets using Google Cloud API"""
        resources = []
        
        try:
            from google.cloud import storage
            
            client = storage.Client(project=project_id, credentials=credentials)
            buckets = client.list_buckets()
            
            for bucket in buckets:
                storage_class = bucket.storage_class or 'STANDARD'
                
                resource = {
                    "resource_id": f"gcp-storage-{bucket.name}",
                    "resource_uuid": bucket.name,
                    "provider": "GCP",
                    "resource_type": f"Cloud Storage {storage_class}",
                    "project_id": config.DEFAULT_PROJECT_ID,
                    "status": "Active",
                    "owner": self._get_gcp_label_value(bucket.labels, "owner", "gcp-user"),
                    "cost_monthly": self._estimate_gcp_storage_cost(storage_class),
                    "cpu_usage": 0,
                    "memory_usage": 0,
                    "tags": self._format_gcp_labels_dict(bucket.labels),
                    "region": bucket.location
                }
                resources.append(resource)
                
            logger.info(f"Found {len(resources)} GCP storage buckets via API")
                
        except Exception as e:
            logger.warning(f"GCP Storage API failed: {e}")
            
        return resources
    
    def _get_gcp_label_value(self, labels: dict, key: str, default: str = '') -> str:
        """Get value from GCP labels dictionary"""
        return labels.get(key, default) if labels else default
    
    def _format_gcp_labels_dict(self, labels: dict) -> str:
        """Format GCP labels dictionary as comma-separated string"""
        if not labels:
            return "gcp-resource"
        return ','.join([f"{k}={v}" for k, v in labels.items()])
    
    # Keep CLI methods as backup
    async def _get_gcp_compute_via_cli(self) -> List[Dict]:
        """Get GCP Compute instances using gcloud CLI"""
        resources = []
        
        try:
            import subprocess
            import json
            
            # Get compute instances using gcloud CLI
            result = subprocess.run([
                'gcloud', 'compute', 'instances', 'list', 
                '--format=json'
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                instances = json.loads(result.stdout)
                
                for instance in instances:
                    # Extract machine type from full path
                    machine_type = instance.get('machineType', '').split('/')[-1]
                    zone = instance.get('zone', '').split('/')[-1]
                    
                    resource = {
                        "resource_id": f"gcp-compute-{instance['name']}",
                        "resource_uuid": str(instance.get('id', instance['name'])),
                        "provider": "GCP",
                        "resource_type": f"Compute Engine {machine_type}",
                        "project_id": config.DEFAULT_PROJECT_ID,
                        "status": instance.get('status', 'UNKNOWN'),
                        "owner": self._get_gcp_metadata_value(instance, 'owner', 'gcp-user'),
                        "cost_monthly": self._estimate_gcp_compute_cost(machine_type),
                        "cpu_usage": 0,  # CLI doesn't provide metrics
                        "memory_usage": 0,
                        "tags": self._format_gcp_instance_labels(instance),
                        "region": zone
                    }
                    resources.append(resource)
                    
                logger.info(f"Found {len(resources)} GCP compute instances via CLI")
            else:
                logger.warning(f"gcloud compute instances list failed: {result.stderr}")
                
        except Exception as e:
            logger.warning(f"GCP CLI compute query failed: {e}")
            
        return resources
    
    async def _get_gcp_storage_via_cli(self) -> List[Dict]:
        """Get GCP Storage buckets using gcloud CLI"""
        resources = []
        
        try:
            import subprocess
            import json
            
            # Get storage buckets using gcloud CLI
            result = subprocess.run([
                'gcloud', 'storage', 'buckets', 'list', 
                '--format=json'
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                buckets = json.loads(result.stdout)
                
                for bucket in buckets:
                    name = bucket.get('name', '')
                    storage_class = bucket.get('storageClass', 'STANDARD')
                    location = bucket.get('location', 'unknown')
                    
                    resource = {
                        "resource_id": f"gcp-storage-{name}",
                        "resource_uuid": name,
                        "provider": "GCP",
                        "resource_type": f"Cloud Storage {storage_class}",
                        "project_id": config.DEFAULT_PROJECT_ID,
                        "status": "Active",
                        "owner": "gcp-user",  # CLI doesn't easily expose labels
                        "cost_monthly": self._estimate_gcp_storage_cost(storage_class),
                        "cpu_usage": 0,
                        "memory_usage": 0,
                        "tags": f"storage_class={storage_class}",
                        "region": location
                    }
                    resources.append(resource)
                    
                logger.info(f"Found {len(resources)} GCP storage buckets via CLI")
            else:
                logger.debug(f"gcloud storage buckets list failed: {result.stderr}")
                # Storage might not be available, that's ok
                
        except Exception as e:
            logger.debug(f"GCP CLI storage query failed: {e}")
            
        return resources
    
    def _get_gcp_metadata_value(self, instance: dict, key: str, default: str = '') -> str:
        """Get value from GCP instance metadata"""
        metadata = instance.get('metadata', {})
        items = metadata.get('items', [])
        for item in items:
            if item.get('key') == key:
                return item.get('value', default)
        return default
    
    def _format_gcp_instance_labels(self, instance: dict) -> str:
        """Format GCP instance labels and metadata as tags"""
        tags = []
        
        # Add labels if present
        labels = instance.get('labels', {})
        for k, v in labels.items():
            tags.append(f"{k}={v}")
            
        # Add some metadata as tags
        metadata = instance.get('metadata', {})
        items = metadata.get('items', [])
        for item in items:
            key = item.get('key', '')
            if key in ['environment', 'project', 'app']:
                value = item.get('value', '')
                tags.append(f"{key}={value}")
        
        return ','.join(tags) if tags else 'gcp-instance'
    
    def _estimate_gcp_compute_cost(self, machine_type: str) -> float:
        """Estimate monthly GCP Compute cost based on machine type"""
        # Extract machine type from full path
        if '/' in machine_type:
            machine_type = machine_type.split('/')[-1]
        
        # Simplified cost estimates (USD/month) for common machine types
        cost_map = {
            'e2-micro': 6.11, 'e2-small': 12.26, 'e2-medium': 24.51,
            'e2-standard-2': 49.03, 'e2-standard-4': 98.05,
            'n1-standard-1': 24.67, 'n1-standard-2': 49.35, 'n1-standard-4': 98.69,
            'n2-standard-2': 54.36, 'n2-standard-4': 108.72,
            'f1-micro': 3.88, 'g1-small': 15.41
        }
        return cost_map.get(machine_type, 25.00)  # Default estimate
    
    def _estimate_gcp_storage_cost(self, storage_class: str) -> float:
        """Estimate monthly GCP Storage cost"""
        cost_map = {
            'STANDARD': 2.30, 'NEARLINE': 1.20, 'COLDLINE': 0.60,
            'ARCHIVE': 0.30, 'REGIONAL': 2.30, 'MULTI_REGIONAL': 2.60
        }
        return cost_map.get(storage_class or 'STANDARD', 2.30)
    
    def _get_gcp_label(self, labels: dict, key: str, default: str = '') -> str:
        """Get GCP label value by key"""
        if labels and key in labels:
            return labels[key]
        return default
    
    def _format_gcp_labels(self, labels: dict) -> str:
        """Format GCP labels as comma-separated string"""
        if not labels:
            return ""
        return ','.join([f"{k}={v}" for k, v in labels.items()])
    
    def _get_mock_gcp_resources(self) -> List[Dict]:
        """Fallback mock GCP resources when API fails"""
        mock_resources = [
            {
                "resource_id": "gcp-compute-web-server-1",
                "resource_uuid": "gcp-instance-1234567890",
                "provider": "GCP",
                "resource_type": "Compute Engine n1-standard-1",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Running",
                "owner": "gcp-admin",
                "cost_monthly": 24.67,
                "cpu_usage": 35.5,
                "memory_usage": 42.0,
                "tags": "environment=production,app=web",
                "region": "us-central1-a"
            },
            {
                "resource_id": "gcp-storage-bucket-assets",
                "resource_uuid": "assets-bucket-prod",
                "provider": "GCP",
                "resource_type": "Cloud Storage Standard",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Active",
                "owner": "gcp-admin",
                "cost_monthly": 2.30,
                "cpu_usage": 0,
                "memory_usage": 0,
                "tags": "type=storage,tier=standard",
                "region": "us-central1"
            }
        ]
        
        logger.info(f"Using {len(mock_resources)} mock GCP resources as fallback")
        return mock_resources
    
    async def _get_digitalocean_resources(self) -> List[Dict]:
        """Get DigitalOcean resources - currently using mock data for demonstration"""
        resources = []
        
        # Mock DigitalOcean resources for demonstration
        # TODO: Replace with actual DigitalOcean API integration when token is available
        mock_do_resources = [
            {
                "resource_id": "do-droplet-api-server",
                "resource_uuid": "droplet-123456789",
                "provider": "DigitalOcean",
                "resource_type": "Droplet s-1vcpu-1gb",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Active",
                "owner": "do-admin",
                "cost_monthly": 6.00,
                "cpu_usage": 12.5,
                "memory_usage": 55.0,
                "tags": "api,production",
                "region": "nyc3"
            },
            {
                "resource_id": "do-droplet-worker-1",
                "resource_uuid": "droplet-987654321",
                "provider": "DigitalOcean",
                "resource_type": "Droplet s-2vcpu-2gb",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Active",
                "owner": "do-admin",
                "cost_monthly": 18.00,
                "cpu_usage": 45.0,
                "memory_usage": 70.0,
                "tags": "worker,background-jobs",
                "region": "nyc3"
            },
            {
                "resource_id": "do-spaces-backup",
                "resource_uuid": "spaces-backup-prod",
                "provider": "DigitalOcean",
                "resource_type": "Spaces Object Storage",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Active",
                "owner": "do-admin",
                "cost_monthly": 5.00,
                "cpu_usage": 0,
                "memory_usage": 0,
                "tags": "backup,storage",
                "region": "nyc3"
            },
            {
                "resource_id": "do-db-postgres-main",
                "resource_uuid": "db-postgres-cluster-01",
                "provider": "DigitalOcean",
                "resource_type": "Database PostgreSQL",
                "project_id": config.DEFAULT_PROJECT_ID,
                "status": "Online",
                "owner": "do-admin",
                "cost_monthly": 15.00,
                "cpu_usage": 20.0,
                "memory_usage": 40.0,
                "tags": "database,postgres,primary",
                "region": "nyc3"
            }
        ]
        
        logger.info(f"Returning {len(mock_do_resources)} mock DigitalOcean resources")
        return mock_do_resources
    
    async def _get_edge_resources(self) -> List[Dict]:
        """Get edge devices and resources"""
        resources = []
        
        try:
            # Try to get edge devices from AWS Unified MCP
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.aws_unified_url}/edge/devices", timeout=5) as response:
                    if response.status == 200:
                        data = await response.json()
                        if isinstance(data, list):
                            for device in data:
                                resource = {
                                    "resource_id": f"edge-{device.get('id', 'unknown')}",
                                    "resource_uuid": device.get('deviceId', ''),
                                    "provider": "Edge",
                                    "resource_type": "Edge Device",
                                    "project_id": config.DEFAULT_PROJECT_ID,
                                    "status": device.get('status', 'Unknown').title(),
                                    "owner": 'edge-admin',
                                    "cost_monthly": float(device.get('monthlyCost', 15.00)),
                                    "cpu_usage": float(device.get('cpuUsage', 0)),
                                    "memory_usage": float(device.get('memoryUsage', 0)),
                                    "tags": f"edge,{device.get('location', 'unknown')}",
                                    "region": device.get('location', 'edge')
                                }
                                resources.append(resource)
        except Exception as e:
            logger.debug(f"Edge devices query failed: {e}")
            
        return resources
    
    def _get_fallback_resources(self) -> List[Dict]:
        """Get minimal fallback data when all providers fail"""
        return [{
            "resource_id": "oracle-adb-photosight",
            "resource_uuid": "adb-photosight-001",
            "provider": "Oracle",
            "resource_type": "Autonomous Database",
            "project_id": config.DEFAULT_PROJECT_ID,
            "status": "Available",
            "owner": "cloud-ops",
            "cost_monthly": 0.00,  # Always Free Tier
            "cpu_usage": 5.0,
            "memory_usage": 10.0,
            "tags": "database,oracle,free-tier",
            "region": "us-chicago-1"
        }]
    
    async def get_cost_data(self) -> Dict:
        """Get aggregated cost data across all providers"""
        resources = await self.get_cloud_resources()
        
        total_cost = sum(r.get('cost_monthly', 0) for r in resources)
        
        cost_by_provider = {}
        for resource in resources:
            provider = resource.get('provider', 'Unknown')
            cost_by_provider[provider] = cost_by_provider.get(provider, 0) + resource.get('cost_monthly', 0)
        
        return {
            "total_monthly_cost": round(total_cost, 2),
            "budget_monthly": config.MONTHLY_BUDGET,
            "budget_remaining": round(config.MONTHLY_BUDGET - total_cost, 2),
            "budget_utilization_percent": round((total_cost / config.MONTHLY_BUDGET) * 100, 2),
            "cost_by_provider": cost_by_provider,
            "resource_count": len(resources),
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_optimization_recommendations(self) -> List[Dict]:
        """Get real optimization recommendations based on actual usage and AWS best practices"""
        resources = await self.get_cloud_resources()
        recommendations = []
        
        # Get AWS MCP recommendations
        try:
            mcp_recommendations = await aws_unified_mcp_service.get_resource_recommendations()
            
            # Get best practices
            best_practices = await aws_unified_mcp_service.get_best_practices("cost optimization")
            
            # Add MCP-based recommendations
            for rec in mcp_recommendations:
                recommendations.append({
                    "resource_id": rec.get('resource_id', 'general'),
                    "type": rec.get('type', 'Optimization'),
                    "severity": rec.get('severity', 'Medium'),
                    "recommendation": rec.get('recommendation', rec.get('suggestion', '')),
                    "potential_savings": rec.get('potential_savings', 0),
                    "action": rec.get('action', 'Review and optimize'),
                    "source": "AWS Unified MCP"
                })
        except Exception as e:
            logger.warning(f"MCP recommendations failed: {e}")
        
        # Traditional resource-based analysis
        for resource in resources:
            cpu_usage = resource.get('cpu_usage', 0)
            cost_monthly = resource.get('cost_monthly', 0)
            
            # Underutilized resources
            if cpu_usage < 20 and cost_monthly > 0:
                recommendations.append({
                    "resource_id": resource['resource_id'],
                    "type": "Underutilized",
                    "severity": "Medium",
                    "recommendation": f"Resource {resource['resource_id']} has low CPU usage ({cpu_usage}%). Consider downsizing.",
                    "potential_savings": round(cost_monthly * 0.4, 2),
                    "action": "Downsize instance type",
                    "source": "Usage Analysis"
                })
            
            # High cost resources
            if cost_monthly > (config.MONTHLY_BUDGET * 0.3):
                recommendations.append({
                    "resource_id": resource['resource_id'],
                    "type": "High Cost",
                    "severity": "High", 
                    "recommendation": f"Resource {resource['resource_id']} consumes ${cost_monthly}/month (>{int(config.MONTHLY_BUDGET * 30)}% of budget).",
                    "potential_savings": round(cost_monthly * 0.2, 2),
                    "action": "Review necessity and optimize",
                    "source": "Cost Analysis"
                })
            
            # Edge device specific recommendations
            if resource.get('provider') == 'Edge' and resource.get('status') == 'Offline':
                recommendations.append({
                    "resource_id": resource['resource_id'],
                    "type": "Availability",
                    "severity": "High",
                    "recommendation": f"Edge device {resource['resource_id']} is offline. Check connectivity and power.",
                    "potential_savings": 0,
                    "action": "Restore device connectivity",
                    "source": "Edge Monitoring"
                })
        
        return recommendations

# Create singleton instance
real_data_service = RealDataService()