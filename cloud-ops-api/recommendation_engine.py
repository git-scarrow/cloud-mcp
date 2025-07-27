#!/usr/bin/env python3
"""
Recommendation Implementation Engine
Executes cost optimization recommendations with safety checks
"""

import asyncio
import logging
import boto3
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import json
import time

from config import config
from real_data_service import real_data_service

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RecommendationStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

class RecommendationType(Enum):
    DOWNSIZE_INSTANCE = "downsize_instance"
    STOP_INSTANCE = "stop_instance"
    TERMINATE_INSTANCE = "terminate_instance"
    SCHEDULE_INSTANCE = "schedule_instance"
    OPTIMIZE_STORAGE = "optimize_storage"
    REVIEW_NECESSITY = "review_necessity"

@dataclass
class RecommendationExecution:
    recommendation_id: str
    resource_id: str
    recommendation_type: RecommendationType
    original_config: Dict
    target_config: Dict
    status: RecommendationStatus
    potential_savings: float
    risk_level: str
    safety_checks: List[str]
    execution_time: Optional[datetime] = None
    completion_time: Optional[datetime] = None
    error_message: Optional[str] = None
    rollback_config: Optional[Dict] = None

class RecommendationEngine:
    """Engine for executing cost optimization recommendations safely"""
    
    def __init__(self):
        self.ec2_client = boto3.client('ec2', region_name=config.AWS_REGION)
        self.executions: Dict[str, RecommendationExecution] = {}
        
        # Instance type mappings for downsizing
        self.downsize_map = {
            't3.large': 't3.medium',
            't3.medium': 't3.small', 
            't3.small': 't3.micro',
            't2.large': 't2.medium',
            't2.medium': 't2.small',
            't2.small': 't2.micro',
            'm5.large': 'm5.medium',
            'm5.medium': 't3.medium',
            'c5.large': 'c5.medium',
            'c5.medium': 't3.medium'
        }
        
    async def execute_recommendation(self, recommendation: Dict, 
                                   dry_run: bool = True) -> RecommendationExecution:
        """Execute a single recommendation with safety checks"""
        
        execution_id = f"exec_{int(time.time())}_{recommendation['resource_id']}"
        execution = None
        
        try:
            # Parse recommendation
            rec_type = self._parse_recommendation_type(recommendation)
            resource_id = recommendation['resource_id']
            
            # Get current resource configuration
            original_config = await self._get_resource_config(resource_id)
            
            # Create execution record
            execution = RecommendationExecution(
                recommendation_id=execution_id,
                resource_id=resource_id,
                recommendation_type=rec_type,
                original_config=original_config,
                target_config={},
                status=RecommendationStatus.PENDING,
                potential_savings=recommendation.get('potential_savings', 0),
                risk_level=recommendation.get('severity', 'Medium'),
                safety_checks=[]
            )
            
            # Store execution
            self.executions[execution_id] = execution
            
            # Perform safety checks
            safety_passed = await self._perform_safety_checks(execution)
            
            if not safety_passed:
                execution.status = RecommendationStatus.FAILED
                execution.error_message = "Safety checks failed"
                return execution
            
            # Execute recommendation
            if rec_type == RecommendationType.DOWNSIZE_INSTANCE:
                result = await self._execute_downsize(execution, dry_run)
            elif rec_type == RecommendationType.STOP_INSTANCE:
                result = await self._execute_stop(execution, dry_run)
            elif rec_type == RecommendationType.SCHEDULE_INSTANCE:
                result = await self._execute_schedule(execution, dry_run)
            else:
                execution.status = RecommendationStatus.FAILED
                execution.error_message = f"Unsupported recommendation type: {rec_type}"
                return execution
            
            if result:
                execution.status = RecommendationStatus.COMPLETED
                execution.completion_time = datetime.utcnow()
                logger.info(f"Successfully executed recommendation {execution_id}")
            else:
                execution.status = RecommendationStatus.FAILED
                
        except Exception as e:
            execution.status = RecommendationStatus.FAILED
            execution.error_message = str(e)
            logger.error(f"Recommendation execution failed: {e}")
            
        return execution
    
    def _parse_recommendation_type(self, recommendation: Dict) -> RecommendationType:
        """Parse recommendation type from recommendation data"""
        rec_type = recommendation.get('type', '').lower()
        action = recommendation.get('action', '').lower()
        
        if 'downsize' in action or 'underutilized' in rec_type:
            return RecommendationType.DOWNSIZE_INSTANCE
        elif 'stop' in action or 'idle' in rec_type:
            return RecommendationType.STOP_INSTANCE
        elif 'schedule' in action:
            return RecommendationType.SCHEDULE_INSTANCE
        elif 'terminate' in action:
            return RecommendationType.TERMINATE_INSTANCE
        else:
            return RecommendationType.REVIEW_NECESSITY
    
    async def _get_resource_config(self, resource_id: str) -> Dict:
        """Get current configuration of AWS resource"""
        try:
            # Extract instance ID from resource_id format: aws-ec2-i-085d529203426acc2
            parts = resource_id.split('-')
            if len(parts) >= 4 and parts[0] == 'aws' and parts[1] == 'ec2':
                instance_id = '-'.join(parts[2:])  # Rejoin i-085d529203426acc2
            else:
                instance_id = resource_id  # Use as-is if format doesn't match
            
            logger.info(f"Parsed instance ID: {instance_id} from resource_id: {resource_id}")
            
            response = self.ec2_client.describe_instances(InstanceIds=[instance_id])
            
            if not response['Reservations']:
                raise ValueError(f"Instance {instance_id} not found")
                
            instance = response['Reservations'][0]['Instances'][0]
            
            return {
                'instance_id': instance_id,
                'instance_type': instance['InstanceType'],
                'state': instance['State']['Name'],
                'availability_zone': instance['Placement']['AvailabilityZone'],
                'security_groups': [sg['GroupId'] for sg in instance['SecurityGroups']],
                'subnet_id': instance.get('SubnetId'),
                'key_name': instance.get('KeyName'),
                'tags': {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}
            }
            
        except Exception as e:
            logger.error(f"Failed to get resource config for {resource_id}: {e}")
            raise
    
    async def _perform_safety_checks(self, execution: RecommendationExecution) -> bool:
        """Perform comprehensive safety checks before execution"""
        checks_passed = []
        
        try:
            # Check 1: Resource exists and is accessible
            config = execution.original_config
            instance_id = config['instance_id']
            
            if not instance_id:
                execution.safety_checks.append("❌ Instance ID not found")
                return False
            checks_passed.append("✅ Instance exists and accessible")
            
            # Check 2: Instance is in running state for modification
            if execution.recommendation_type in [RecommendationType.DOWNSIZE_INSTANCE] and config['state'] != 'running':
                execution.safety_checks.append(f"❌ Instance must be running for resize (current: {config['state']})")
                return False
            checks_passed.append("✅ Instance state appropriate for operation")
            
            # Check 3: Check for critical tags
            tags = config.get('tags', {})
            if tags.get('Environment') == 'production' and execution.risk_level == 'High':
                execution.safety_checks.append("⚠️ Production environment with high risk")
                checks_passed.append("⚠️ Production environment detected - proceed with caution")
            else:
                checks_passed.append("✅ Environment risk assessment passed")
            
            # Check 4: Downsize feasibility
            if execution.recommendation_type == RecommendationType.DOWNSIZE_INSTANCE:
                current_type = config['instance_type']
                if current_type not in self.downsize_map:
                    execution.safety_checks.append(f"❌ No safe downsize option for {current_type}")
                    return False
                
                target_type = self.downsize_map[current_type]
                execution.target_config = {**config, 'instance_type': target_type}
                checks_passed.append(f"✅ Downsize path: {current_type} → {target_type}")
            
            # Check 5: Backup/snapshot check
            if execution.recommendation_type in [RecommendationType.DOWNSIZE_INSTANCE, 
                                               RecommendationType.TERMINATE_INSTANCE]:
                # In a real implementation, you'd check for recent snapshots
                checks_passed.append("✅ Backup verification (simulated)")
            
            # Check 6: Cost impact validation
            if execution.potential_savings <= 0:
                execution.safety_checks.append("⚠️ No projected savings")
                checks_passed.append("⚠️ Cost impact minimal")
            else:
                checks_passed.append(f"✅ Projected savings: ${execution.potential_savings:.2f}/month")
            
            execution.safety_checks = checks_passed
            return True
            
        except Exception as e:
            execution.safety_checks.append(f"❌ Safety check error: {str(e)}")
            return False
    
    async def _execute_downsize(self, execution: RecommendationExecution, dry_run: bool) -> bool:
        """Execute instance downsizing"""
        try:
            execution.status = RecommendationStatus.IN_PROGRESS
            execution.execution_time = datetime.utcnow()
            
            instance_id = execution.original_config['instance_id']
            current_type = execution.original_config['instance_type']
            target_type = execution.target_config['instance_type']
            
            logger.info(f"Downsizing instance {instance_id}: {current_type} → {target_type} (dry_run={dry_run})")
            
            if not dry_run:
                # Step 1: Stop instance
                logger.info(f"Stopping instance {instance_id}")
                self.ec2_client.stop_instances(InstanceIds=[instance_id])
                
                # Wait for instance to stop
                waiter = self.ec2_client.get_waiter('instance_stopped')
                waiter.wait(InstanceIds=[instance_id], WaiterConfig={'Delay': 15, 'MaxAttempts': 20})
                
                # Step 2: Modify instance type
                logger.info(f"Modifying instance type to {target_type}")
                self.ec2_client.modify_instance_attribute(
                    InstanceId=instance_id,
                    InstanceType={'Value': target_type}
                )
                
                # Step 3: Start instance
                logger.info(f"Starting instance {instance_id}")
                self.ec2_client.start_instances(InstanceIds=[instance_id])
                
                # Wait for instance to start
                waiter = self.ec2_client.get_waiter('instance_running')
                waiter.wait(InstanceIds=[instance_id], WaiterConfig={'Delay': 15, 'MaxAttempts': 20})
                
                logger.info(f"Successfully downsized instance {instance_id}")
            else:
                logger.info(f"DRY RUN: Would downsize {instance_id} from {current_type} to {target_type}")
                # Simulate execution time
                await asyncio.sleep(2)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to downsize instance: {e}")
            execution.error_message = str(e)
            return False
    
    async def _execute_stop(self, execution: RecommendationExecution, dry_run: bool) -> bool:
        """Execute instance stop"""
        try:
            execution.status = RecommendationStatus.IN_PROGRESS
            execution.execution_time = datetime.utcnow()
            
            instance_id = execution.original_config['instance_id']
            
            logger.info(f"Stopping instance {instance_id} (dry_run={dry_run})")
            
            if not dry_run:
                self.ec2_client.stop_instances(InstanceIds=[instance_id])
                
                # Wait for instance to stop
                waiter = self.ec2_client.get_waiter('instance_stopped')
                waiter.wait(InstanceIds=[instance_id], WaiterConfig={'Delay': 15, 'MaxAttempts': 20})
                
                logger.info(f"Successfully stopped instance {instance_id}")
            else:
                logger.info(f"DRY RUN: Would stop instance {instance_id}")
                await asyncio.sleep(1)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to stop instance: {e}")
            execution.error_message = str(e)
            return False
    
    async def _execute_schedule(self, execution: RecommendationExecution, dry_run: bool) -> bool:
        """Execute instance scheduling (stop at night, start in morning)"""
        try:
            execution.status = RecommendationStatus.IN_PROGRESS
            execution.execution_time = datetime.utcnow()
            
            instance_id = execution.original_config['instance_id']
            
            logger.info(f"Setting up schedule for instance {instance_id} (dry_run={dry_run})")
            
            if not dry_run:
                # In a real implementation, you'd set up CloudWatch Events or similar
                # For now, we'll tag the instance to indicate it should be scheduled
                self.ec2_client.create_tags(
                    Resources=[instance_id],
                    Tags=[
                        {'Key': 'Schedule', 'Value': 'auto-stop-nights'},
                        {'Key': 'ScheduleSetBy', 'Value': 'cloud-ops-optimization'},
                        {'Key': 'ScheduleSetDate', 'Value': datetime.utcnow().isoformat()}
                    ]
                )
                logger.info(f"Added scheduling tags to instance {instance_id}")
            else:
                logger.info(f"DRY RUN: Would add scheduling to instance {instance_id}")
                await asyncio.sleep(1)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to schedule instance: {e}")
            execution.error_message = str(e)
            return False
    
    async def rollback_execution(self, execution_id: str) -> bool:
        """Rollback a previously executed recommendation"""
        if execution_id not in self.executions:
            logger.error(f"Execution {execution_id} not found")
            return False
        
        execution = self.executions[execution_id]
        
        if execution.status != RecommendationStatus.COMPLETED:
            logger.error(f"Cannot rollback execution {execution_id} - not completed")
            return False
        
        try:
            logger.info(f"Rolling back execution {execution_id}")
            
            if execution.recommendation_type == RecommendationType.DOWNSIZE_INSTANCE:
                # Rollback: restore original instance type
                instance_id = execution.original_config['instance_id']
                original_type = execution.original_config['instance_type']
                
                # Stop, modify, start
                self.ec2_client.stop_instances(InstanceIds=[instance_id])
                waiter = self.ec2_client.get_waiter('instance_stopped')
                waiter.wait(InstanceIds=[instance_id])
                
                self.ec2_client.modify_instance_attribute(
                    InstanceId=instance_id,
                    InstanceType={'Value': original_type}
                )
                
                self.ec2_client.start_instances(InstanceIds=[instance_id])
                waiter = self.ec2_client.get_waiter('instance_running')
                waiter.wait(InstanceIds=[instance_id])
                
            elif execution.recommendation_type == RecommendationType.STOP_INSTANCE:
                # Rollback: start the instance
                instance_id = execution.original_config['instance_id']
                self.ec2_client.start_instances(InstanceIds=[instance_id])
                
            execution.status = RecommendationStatus.ROLLED_BACK
            logger.info(f"Successfully rolled back execution {execution_id}")
            return True
            
        except Exception as e:
            logger.error(f"Rollback failed for execution {execution_id}: {e}")
            return False
    
    def get_execution_status(self, execution_id: str) -> Optional[RecommendationExecution]:
        """Get status of a recommendation execution"""
        return self.executions.get(execution_id)
    
    def list_executions(self) -> List[RecommendationExecution]:
        """List all recommendation executions"""
        return list(self.executions.values())
    
    async def batch_execute_recommendations(self, recommendations: List[Dict], 
                                          dry_run: bool = True) -> List[RecommendationExecution]:
        """Execute multiple recommendations with safety coordination"""
        results = []
        
        # Sort by risk level (execute low risk first)
        risk_order = {'Low': 1, 'Medium': 2, 'High': 3}
        sorted_recs = sorted(recommendations, 
                           key=lambda r: risk_order.get(r.get('severity', 'Medium'), 2))
        
        for rec in sorted_recs:
            try:
                result = await self.execute_recommendation(rec, dry_run)
                results.append(result)
                
                # Add delay between executions for safety
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Batch execution failed for recommendation: {e}")
                continue
        
        return results

# Create singleton instance
recommendation_engine = RecommendationEngine()