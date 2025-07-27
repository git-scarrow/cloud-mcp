#!/usr/bin/env python3
"""
Optimized Oracle-Notion sync service implementing batch queries to avoid N+1 problem.
Based on technical review recommendations for scalability and API rate limit management.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import pandas as pd
from dataclasses import dataclass
from notion_client import Client as NotionClient
import cx_Oracle


@dataclass
class SyncConfig:
    """Configuration for different sync tiers"""
    health_interval_minutes: int = 5    # Critical health data
    metrics_interval_minutes: int = 15  # CPU, cost metrics
    full_sync_interval_minutes: int = 60 # Complete inventory sync


@dataclass
class ResourceMetrics:
    """Structured metrics from Oracle"""
    resource_id: str
    cost_mtd: float
    cpu_avg_24h: float
    anomaly_score: float
    health_status: str
    last_updated: datetime


class OptimizedSyncService:
    """
    High-performance sync service using batch queries and tiered intervals.
    Addresses N+1 query problem and API rate limits.
    """
    
    def __init__(self, notion_token: str, oracle_dsn: str, config: SyncConfig = None):
        self.notion = NotionClient(auth=notion_token)
        self.oracle_dsn = oracle_dsn
        self.config = config or SyncConfig()
        self.logger = logging.getLogger(__name__)
        
        # Database IDs (from Notion workspace)
        self.resources_db_id = "23be7cc7-01d5-81f0-a8cc-cfa88a213102"
        self.projects_db_id = "23be7cc7-01d5-813f-8bc4-e73325f0535a"
    
    async def get_all_resource_pages(self) -> List[Dict]:
        """Fetch all resource pages from Notion in single query"""
        try:
            response = self.notion.databases.query(
                database_id=self.resources_db_id,
                page_size=100  # Max allowed by Notion API
            )
            
            all_pages = response["results"]
            
            # Handle pagination if needed
            while response.get("has_more"):
                response = self.notion.databases.query(
                    database_id=self.resources_db_id,
                    start_cursor=response["next_cursor"],
                    page_size=100
                )
                all_pages.extend(response["results"])
            
            self.logger.info(f"Retrieved {len(all_pages)} resource pages from Notion")
            return all_pages
            
        except Exception as e:
            self.logger.error(f"Failed to fetch Notion pages: {e}")
            return []
    
    def extract_resource_uuids(self, pages: List[Dict]) -> List[str]:
        """Extract Resource UUIDs from Notion pages"""
        uuids = []
        for page in pages:
            try:
                uuid_prop = page["properties"]["Resource UUID"]["rich_text"]
                if uuid_prop and len(uuid_prop) > 0:
                    uuid = uuid_prop[0]["text"]["content"]
                    if uuid.strip():
                        uuids.append(uuid.strip())
            except (KeyError, IndexError) as e:
                self.logger.warning(f"Missing Resource UUID in page {page.get('id', 'unknown')}: {e}")
        
        self.logger.info(f"Extracted {len(uuids)} valid Resource UUIDs")
        return uuids
    
    def batch_query_oracle_metrics(self, resource_ids: List[str], sync_type: str = "full") -> Dict[str, ResourceMetrics]:
        """
        Single Oracle query for all resource metrics using IN clause.
        This eliminates the N+1 query problem.
        """
        if not resource_ids:
            return {}
        
        # Build parameterized query with IN clause
        placeholders = ",".join([f":id{i}" for i in range(len(resource_ids))])
        
        if sync_type == "health":
            # Fast health-only query for 5-minute intervals
            query = f"""
                SELECT 
                    resource_id,
                    health_status,
                    anomaly_score,
                    last_updated
                FROM resource_health_view
                WHERE resource_id IN ({placeholders})
                AND last_updated >= SYSDATE - INTERVAL '1' HOUR
            """
        else:
            # Full metrics query for 15+ minute intervals
            query = f"""
                SELECT 
                    r.resource_id,
                    NVL(c.cost_mtd, 0) as cost_mtd,
                    NVL(m.cpu_avg_24h, 0) as cpu_avg_24h,
                    NVL(h.anomaly_score, 0) as anomaly_score,
                    NVL(h.health_status, 'Unknown') as health_status,
                    NVL(h.last_updated, SYSDATE) as last_updated
                FROM 
                    (SELECT DISTINCT resource_id FROM resource_inventory WHERE resource_id IN ({placeholders})) r
                LEFT JOIN resource_costs c ON r.resource_id = c.resource_id
                LEFT JOIN resource_metrics m ON r.resource_id = m.resource_id  
                LEFT JOIN resource_health h ON r.resource_id = h.resource_id
                WHERE r.resource_id IN ({placeholders})
            """
        
        try:
            with cx_Oracle.connect(self.oracle_dsn) as connection:
                # Create parameter dictionary
                params = {f"id{i}": resource_id for i, resource_id in enumerate(resource_ids)}
                
                # Execute single batch query
                df = pd.read_sql(query, connection, params=params)
                
                # Convert to ResourceMetrics objects
                metrics_map = {}
                for _, row in df.iterrows():
                    metrics = ResourceMetrics(
                        resource_id=row['RESOURCE_ID'],
                        cost_mtd=float(row.get('COST_MTD', 0)),
                        cpu_avg_24h=float(row.get('CPU_AVG_24H', 0)),
                        anomaly_score=float(row.get('ANOMALY_SCORE', 0)),
                        health_status=row.get('HEALTH_STATUS', 'Unknown'),
                        last_updated=row.get('LAST_UPDATED', datetime.now())
                    )
                    metrics_map[metrics.resource_id] = metrics
                
                self.logger.info(f"Fetched metrics for {len(metrics_map)} resources in single Oracle query")
                return metrics_map
                
        except Exception as e:
            self.logger.error(f"Oracle batch query failed: {e}")
            return {}
    
    async def update_notion_pages_batch(self, pages: List[Dict], metrics_map: Dict[str, ResourceMetrics], sync_type: str):
        """
        Update Notion pages with metrics data.
        Uses rate limiting to respect Notion's ~3 req/sec limit.
        """
        updates_made = 0
        rate_limit_delay = 0.35  # ~2.8 req/sec to stay under 3 req/sec limit
        
        for page in pages:
            try:
                # Extract Resource UUID
                uuid_prop = page["properties"]["Resource UUID"]["rich_text"]
                if not uuid_prop or len(uuid_prop) == 0:
                    continue
                    
                resource_id = uuid_prop[0]["text"]["content"].strip()
                metrics = metrics_map.get(resource_id)
                
                if not metrics:
                    continue
                
                # Build update payload based on sync type
                update_properties = {}
                
                if sync_type == "health":
                    # Fast health updates only
                    update_properties = {
                        "Status": {
                            "select": {"name": f"🟢 Active" if metrics.health_status == "Healthy" else "🔴 Critical"}
                        },
                        "Last Updated": {
                            "date": {"start": metrics.last_updated.isoformat()}
                        }
                    }
                else:
                    # Full metrics update
                    update_properties = {
                        "Status": {
                            "select": {"name": f"🟢 Active" if metrics.health_status == "Healthy" else "🔴 Critical"}
                        },
                        "Monthly Cost": {
                            "number": round(metrics.cost_mtd, 2)
                        },
                        "CPU Usage %": {
                            "number": round(metrics.cpu_avg_24h / 100, 4)  # Convert to percentage
                        },
                        "Optimization Flag": {
                            "select": {
                                "name": "Cost Anomaly" if metrics.anomaly_score > 0.8 
                                       else "Underutilized" if metrics.cpu_avg_24h < 20
                                       else "Normal"
                            }
                        },
                        "Last Updated": {
                            "date": {"start": metrics.last_updated.isoformat()}
                        }
                    }
                
                # Update page
                self.notion.pages.update(
                    page_id=page["id"],
                    properties=update_properties
                )
                
                updates_made += 1
                
                # Rate limiting
                await asyncio.sleep(rate_limit_delay)
                
            except Exception as e:
                self.logger.error(f"Failed to update page {page.get('id', 'unknown')}: {e}")
        
        self.logger.info(f"Updated {updates_made} Notion pages ({sync_type} sync)")
        return updates_made
    
    async def sync_resources(self, sync_type: str = "full"):
        """
        Main sync method implementing optimized batch pattern.
        
        Args:
            sync_type: "health" for fast health checks, "full" for complete metrics
        """
        start_time = datetime.now()
        self.logger.info(f"Starting {sync_type} sync at {start_time}")
        
        try:
            # Step 1: Get all resource pages from Notion (1 query)
            pages = await self.get_all_resource_pages()
            if not pages:
                self.logger.warning("No pages found in Notion database")
                return
            
            # Step 2: Extract Resource UUIDs
            resource_ids = self.extract_resource_uuids(pages)
            if not resource_ids:
                self.logger.warning("No valid Resource UUIDs found")
                return
            
            # Step 3: Batch query Oracle for all metrics (1 query)
            metrics_map = self.batch_query_oracle_metrics(resource_ids, sync_type)
            if not metrics_map:
                self.logger.warning("No metrics retrieved from Oracle")
                return
            
            # Step 4: Update Notion pages with rate limiting
            updates = await self.update_notion_pages_batch(pages, metrics_map, sync_type)
            
            duration = datetime.now() - start_time
            self.logger.info(f"Sync completed: {updates} updates in {duration.total_seconds():.1f}s")
            
        except Exception as e:
            self.logger.error(f"Sync failed: {e}")
            raise


async def main():
    """
    Main scheduler implementing tiered sync intervals per technical review.
    """
    logging.basicConfig(level=logging.INFO)
    
    # Initialize service (credentials would come from environment)
    sync_service = OptimizedSyncService(
        notion_token="your_notion_token",
        oracle_dsn="your_oracle_dsn"
    )
    
    last_health_sync = datetime.min
    last_metrics_sync = datetime.min
    last_full_sync = datetime.min
    
    while True:
        try:
            now = datetime.now()
            
            # Health sync every 5 minutes (critical data)
            if now - last_health_sync >= timedelta(minutes=sync_service.config.health_interval_minutes):
                await sync_service.sync_resources("health")
                last_health_sync = now
            
            # Metrics sync every 15 minutes (CPU, cost)
            elif now - last_metrics_sync >= timedelta(minutes=sync_service.config.metrics_interval_minutes):
                await sync_service.sync_resources("full")
                last_metrics_sync = now
            
            # Full inventory sync every hour
            elif now - last_full_sync >= timedelta(minutes=sync_service.config.full_sync_interval_minutes):
                await sync_service.sync_resources("full")
                last_full_sync = now
            
            # Sleep for 30 seconds between checks
            await asyncio.sleep(30)
            
        except KeyboardInterrupt:
            logging.info("Sync service stopped by user")
            break
        except Exception as e:
            logging.error(f"Sync service error: {e}")
            await asyncio.sleep(60)  # Wait before retrying


if __name__ == "__main__":
    asyncio.run(main())