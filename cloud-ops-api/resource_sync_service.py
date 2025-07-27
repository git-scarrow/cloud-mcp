#!/usr/bin/env python3
"""
Resource Sync Service
Periodically fetches real cloud resource data and updates Oracle database
"""

import asyncio
import logging
from datetime import datetime
from typing import List, Dict
from real_data_service import real_data_service
from config import config
import os
import oracledb

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Oracle connection class for sync service
class SyncOracleConnection:
    def __init__(self):
        self.connection = None
        # Set TNS_ADMIN for wallet location
        if config.ORACLE_WALLET_LOCATION:
            os.environ['TNS_ADMIN'] = config.ORACLE_WALLET_LOCATION
    
    def connect(self):
        if not self.connection:
            if config.ORACLE_WALLET_LOCATION:
                self.connection = oracledb.connect(
                    user=config.ORACLE_USER,
                    password=config.ORACLE_PASSWORD,
                    dsn=config.ORACLE_SERVICE,
                    config_dir=config.ORACLE_WALLET_LOCATION,
                    wallet_location=config.ORACLE_WALLET_LOCATION,
                    wallet_password=config.ORACLE_WALLET_PASSWORD
                )
            else:
                self.connection = oracledb.connect(
                    user=config.ORACLE_USER,
                    password=config.ORACLE_PASSWORD, 
                    dsn=config.ORACLE_SERVICE
                )
        return self.connection
    
    def execute_query(self, query: str, params: Dict = None):
        connection = self.connect()
        cursor = connection.cursor()
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            if query.strip().upper().startswith('SELECT'):
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            else:
                connection.commit()
                return {"rows_affected": cursor.rowcount}
        finally:
            cursor.close()

# Create Oracle connection instance
sync_oracle_db = SyncOracleConnection()

class ResourceSyncService:
    """Service to sync real cloud resource data to Oracle database"""
    
    def __init__(self):
        self.sync_interval = config.SYNC_INTERVAL_HOURS * 3600  # Convert to seconds
        self.running = False
        
    async def start_sync_loop(self):
        """Start the continuous sync loop"""
        self.running = True
        logger.info("Starting resource sync service...")
        
        while self.running:
            try:
                await self.sync_resources()
                logger.info(f"Next sync in {config.SYNC_INTERVAL_HOURS} hours")
                await asyncio.sleep(self.sync_interval)
            except Exception as e:
                logger.error(f"Sync loop error: {e}")
                await asyncio.sleep(300)  # Wait 5 minutes on error
    
    def stop_sync_loop(self):
        """Stop the sync loop"""
        self.running = False
        logger.info("Stopping resource sync service...")
    
    async def sync_resources(self):
        """Perform a full resource sync"""
        try:
            logger.info("Starting resource sync...")
            start_time = datetime.utcnow()
            
            # Get real cloud resource data
            resources = await real_data_service.get_cloud_resources()
            logger.info(f"Retrieved {len(resources)} resources from cloud providers")
            
            # Sync resources to Oracle
            synced_count = await self._sync_resources_to_oracle(resources)
            
            # Get and sync cost data
            cost_data = await real_data_service.get_cost_data()
            await self._update_cost_metrics(cost_data)
            
            # Get and sync optimization recommendations
            recommendations = await real_data_service.get_optimization_recommendations()
            await self._sync_recommendations_to_oracle(recommendations)
            
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            logger.info(f"Sync completed: {synced_count} resources synced in {duration:.2f}s")
            
            # Update sync statistics
            await self._update_sync_stats(synced_count, duration, True)
            
        except Exception as e:
            logger.error(f"Resource sync failed: {e}")
            await self._update_sync_stats(0, 0, False, str(e))
            raise
    
    async def _sync_resources_to_oracle(self, resources: List[Dict]) -> int:
        """Sync resources to Oracle database"""
        synced_count = 0
        
        for resource in resources:
            try:
                # Upsert resource
                upsert_query = """
                MERGE INTO cloud_resources cr
                USING (SELECT :resource_id as resource_id FROM dual) src
                ON (cr.resource_id = src.resource_id)
                WHEN MATCHED THEN
                    UPDATE SET 
                        resource_uuid = :resource_uuid,
                        provider = :provider,
                        resource_type = :resource_type,
                        project_id = :project_id,
                        owner = :owner,
                        status = :status,
                        last_updated = CURRENT_TIMESTAMP,
                        tags = :tags
                WHEN NOT MATCHED THEN
                    INSERT (resource_id, resource_uuid, provider, resource_type, 
                           project_id, owner, status, tags)
                    VALUES (:resource_id, :resource_uuid, :provider, :resource_type,
                           :project_id, :owner, :status, :tags)
                """
                
                sync_oracle_db.execute_query(upsert_query, {
                    'resource_id': resource.get('resource_id'),
                    'resource_uuid': resource.get('resource_uuid', ''),
                    'provider': resource.get('provider'),
                    'resource_type': resource.get('resource_type'),
                    'project_id': resource.get('project_id', config.DEFAULT_PROJECT_ID),
                    'owner': resource.get('owner', 'unknown'),
                    'status': resource.get('status', 'Unknown'),
                    'tags': resource.get('tags', '')
                })
                
                # Insert metrics
                metrics_query = """
                INSERT INTO cloud_metrics 
                (resource_id, cpu_usage_percent, memory_usage_percent, 
                 cost_monthly, anomaly_score, metric_time)
                VALUES (:resource_id, :cpu_usage_percent, :memory_usage_percent,
                        :cost_monthly, :anomaly_score, CURRENT_TIMESTAMP)
                """
                
                # Calculate anomaly score based on usage patterns
                cpu_usage = resource.get('cpu_usage', 0)
                cost_monthly = resource.get('cost_monthly', 0)
                anomaly_score = self._calculate_anomaly_score(cpu_usage, cost_monthly)
                
                sync_oracle_db.execute_query(metrics_query, {
                    'resource_id': resource.get('resource_id'),
                    'cpu_usage_percent': cpu_usage,
                    'memory_usage_percent': resource.get('memory_usage', 0),
                    'cost_monthly': cost_monthly,
                    'anomaly_score': anomaly_score
                })
                
                synced_count += 1
                
            except Exception as e:
                logger.warning(f"Failed to sync resource {resource.get('resource_id', 'unknown')}: {e}")
                
        return synced_count
    
    def _calculate_anomaly_score(self, cpu_usage: float, cost_monthly: float) -> float:
        """Calculate anomaly score based on usage and cost patterns"""
        score = 0.0
        
        # High cost, low usage = anomaly
        if cost_monthly > 50 and cpu_usage < 20:
            score += 0.6
        
        # Very high cost
        if cost_monthly > (config.MONTHLY_BUDGET * 0.5):
            score += 0.4
        
        # Very low usage
        if cpu_usage < 5:
            score += 0.3
        
        # Very high usage (potential performance issue)
        if cpu_usage > 95:
            score += 0.5
        
        return min(score, 1.0)  # Cap at 1.0
    
    async def _update_cost_metrics(self, cost_data: Dict):
        """Update aggregated cost metrics"""
        try:
            # Update project with current cost data
            update_project_query = """
            UPDATE projects 
            SET current_monthly_cost = :current_cost,
                budget_utilization = :utilization,
                last_updated = CURRENT_TIMESTAMP
            WHERE project_id = :project_id
            """
            
            sync_oracle_db.execute_query(update_project_query, {
                'current_cost': cost_data.get('total_monthly_cost', 0),
                'utilization': cost_data.get('budget_utilization_percent', 0),
                'project_id': config.DEFAULT_PROJECT_ID
            })
            
            logger.info(f"Updated cost metrics: ${cost_data.get('total_monthly_cost', 0):.2f}/month")
            
        except Exception as e:
            logger.warning(f"Failed to update cost metrics: {e}")
    
    async def _sync_recommendations_to_oracle(self, recommendations: List[Dict]):
        """Sync optimization recommendations to Oracle"""
        try:
            # Clear old recommendations
            sync_oracle_db.execute_query(
                "DELETE FROM cost_optimizations WHERE created_date < SYSDATE - 7"
            )
            
            # Insert new recommendations
            for rec in recommendations:
                insert_query = """
                INSERT INTO cost_optimizations 
                (resource_id, optimization_type, recommendation, potential_savings, 
                 severity, status, created_date)
                VALUES (:resource_id, :optimization_type, :recommendation, 
                        :potential_savings, :severity, 'Open', CURRENT_TIMESTAMP)
                """
                
                sync_oracle_db.execute_query(insert_query, {
                    'resource_id': rec.get('resource_id'),
                    'optimization_type': rec.get('type', 'General'),
                    'recommendation': rec.get('recommendation', ''),
                    'potential_savings': rec.get('potential_savings', 0),
                    'severity': rec.get('severity', 'Medium')
                })
            
            logger.info(f"Synced {len(recommendations)} optimization recommendations")
            
        except Exception as e:
            logger.warning(f"Failed to sync recommendations: {e}")
    
    async def _update_sync_stats(self, resource_count: int, duration: float, 
                                success: bool, error_message: str = None):
        """Update sync statistics in Oracle"""
        try:
            # Insert sync log entry
            log_query = """
            INSERT INTO sync_logs 
            (sync_time, resource_count, duration_seconds, success, error_message)
            VALUES (CURRENT_TIMESTAMP, :resource_count, :duration, :success, :error_message)
            """
            
            sync_oracle_db.execute_query(log_query, {
                'resource_count': resource_count,
                'duration': duration,
                'success': 'Y' if success else 'N',
                'error_message': error_message
            })
            
        except Exception as e:
            logger.warning(f"Failed to update sync stats: {e}")
    
    async def manual_sync(self) -> Dict:
        """Perform a manual sync and return results"""
        try:
            start_time = datetime.utcnow()
            
            # Perform sync
            await self.sync_resources()
            
            # Get updated statistics
            resources = await real_data_service.get_cloud_resources()
            cost_data = await real_data_service.get_cost_data()
            
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            return {
                "success": True,
                "duration_seconds": duration,
                "resources_synced": len(resources),
                "total_cost": cost_data.get('total_monthly_cost', 0),
                "budget_utilization": cost_data.get('budget_utilization_percent', 0),
                "sync_time": end_time.isoformat(),
                "message": "Manual sync completed successfully"
            }
            
        except Exception as e:
            logger.error(f"Manual sync failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "sync_time": datetime.utcnow().isoformat(),
                "message": "Manual sync failed"
            }

# Create singleton instance
resource_sync_service = ResourceSyncService()

# Background task runner
async def run_background_sync():
    """Run sync service in background"""
    await resource_sync_service.start_sync_loop()

if __name__ == "__main__":
    # Run sync service standalone
    asyncio.run(run_background_sync())