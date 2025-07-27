#!/usr/bin/env python3
"""
Cloud Operations API
Batch-capable API for syncing between Notion and Oracle
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Optional
import oracledb
from notion_client import Client
from config import config
from real_data_service import real_data_service
from resource_sync_service import resource_sync_service
from recommendation_engine import recommendation_engine
from aws_unified_mcp_service import aws_unified_mcp_service

app = Flask(__name__)
CORS(app)

# Configuration from centralized config
NOTION_TOKEN = config.NOTION_TOKEN
ORACLE_DSN = config.ORACLE_DSN
ORACLE_USER = config.ORACLE_USER
ORACLE_PASSWORD = config.ORACLE_PASSWORD

# Initialize clients
notion = Client(auth=NOTION_TOKEN) if NOTION_TOKEN else None

class OracleConnection:
    def __init__(self):
        self.connection = None
        # Set TNS_ADMIN for wallet location
        if config.ORACLE_WALLET_LOCATION:
            os.environ['TNS_ADMIN'] = config.ORACLE_WALLET_LOCATION
        
    def connect(self):
        if not self.connection:
            if config.ORACLE_WALLET_LOCATION:
                # Use thin mode with wallet for ADB
                self.connection = oracledb.connect(
                    user=ORACLE_USER,
                    password=ORACLE_PASSWORD,
                    dsn=ORACLE_DSN,
                    config_dir=config.ORACLE_WALLET_LOCATION,
                    wallet_location=config.ORACLE_WALLET_LOCATION,
                    wallet_password=config.ORACLE_WALLET_PASSWORD
                )
            else:
                # Standard connection without wallet
                self.connection = oracledb.connect(
                    user=ORACLE_USER,
                    password=ORACLE_PASSWORD, 
                    dsn=ORACLE_DSN
                )
        return self.connection
    
    def execute_query(self, query: str, params: Dict = None):
        conn = self.connect()
        cursor = conn.cursor()
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
                conn.commit()
                return {"rowcount": cursor.rowcount}
        finally:
            cursor.close()

oracle_db = OracleConnection()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    oracle_connected = False
    try:
        # Test Oracle connection
        test_query = "SELECT USER FROM DUAL"
        result = oracle_db.execute_query(test_query)
        oracle_connected = bool(result)
    except Exception as e:
        print(f"Oracle health check failed: {e}")
    
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notion_connected": notion is not None,
        "oracle_connected": oracle_connected
    })

@app.route('/resources/batch', methods=['GET'])
def get_resources_batch():
    """Get all resources with latest metrics in a single query"""
    try:
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
            cm.cpu_usage_percent,
            cm.memory_usage_percent,
            cm.cost_monthly,
            cm.anomaly_score,
            CASE 
                WHEN cm.cpu_usage_percent < 20 THEN 'Underutilized'
                WHEN cm.anomaly_score > 0.8 THEN 'Cost Anomaly'
                WHEN cm.cost_monthly > 100 THEN 'Right-size Candidate'
                ELSE 'Normal'
            END as optimization_flag,
            CASE 
                WHEN cm.anomaly_score > 0.8 THEN 'Warning'
                WHEN cm.cpu_usage_percent > 90 THEN 'Critical'
                ELSE 'Healthy'
            END as health_status,
            cm.metric_time as last_metric_time
        FROM cloud_resources cr
        LEFT JOIN (
            SELECT resource_id, cpu_usage_percent, memory_usage_percent, 
                   cost_monthly, anomaly_score, metric_time,
                   ROW_NUMBER() OVER (PARTITION BY resource_id ORDER BY metric_time DESC) as rn
            FROM cloud_metrics
        ) cm ON cr.resource_id = cm.resource_id AND cm.rn = 1
        ORDER BY cm.metric_time DESC NULLS LAST
        """
        
        results = oracle_db.execute_query(query)
        
        return jsonify({
            "success": True,
            "count": len(results),
            "resources": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/resources/batch', methods=['POST'])
def update_resources_batch():
    """Batch update multiple resources"""
    try:
        data = request.json
        resource_updates = data.get('resources', [])
        
        if not resource_updates:
            return jsonify({"success": False, "error": "No resources provided"}), 400
        
        # Prepare batch insert/update
        for resource in resource_updates:
            # Upsert resource
            upsert_resource_query = """
            MERGE INTO ANALYTICS.cloud_resources cr
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
                    notion_page_id = :notion_page_id,
                    last_updated = CURRENT_TIMESTAMP,
                    tags = :tags
            WHEN NOT MATCHED THEN
                INSERT (resource_id, resource_uuid, provider, resource_type, 
                       project_id, owner, status, notion_page_id, tags)
                VALUES (:resource_id, :resource_uuid, :provider, :resource_type,
                       :project_id, :owner, :status, :notion_page_id, :tags)
            """
            
            oracle_db.execute_query(upsert_resource_query, {
                'resource_id': resource.get('resource_id'),
                'resource_uuid': resource.get('resource_uuid'),
                'provider': resource.get('provider'),
                'resource_type': resource.get('resource_type'),
                'project_id': resource.get('project_id'),
                'owner': resource.get('owner'),
                'status': resource.get('status', 'Active'),
                'notion_page_id': resource.get('notion_page_id'),
                'tags': resource.get('tags', '')
            })
            
            # Insert metrics if provided
            if 'metrics' in resource:
                metrics = resource['metrics']
                insert_metrics_query = """
                INSERT INTO ANALYTICS.cloud_metrics 
                (resource_id, cpu_usage_percent, memory_usage_percent, 
                 cost_daily, cost_monthly, anomaly_score)
                VALUES (:resource_id, :cpu_usage_percent, :memory_usage_percent,
                        :cost_daily, :cost_monthly, :anomaly_score)
                """
                
                oracle_db.execute_query(insert_metrics_query, {
                    'resource_id': resource.get('resource_id'),
                    'cpu_usage_percent': metrics.get('cpu_usage_percent'),
                    'memory_usage_percent': metrics.get('memory_usage_percent'),
                    'cost_daily': metrics.get('cost_daily'),
                    'cost_monthly': metrics.get('cost_monthly'),
                    'anomaly_score': metrics.get('anomaly_score', 0)
                })
        
        # Refresh materialized view
        oracle_db.execute_query("BEGIN DBMS_MVIEW.REFRESH('ANALYTICS.RESOURCE_ANALYTICS_MV'); END;")
        
        return jsonify({
            "success": True,
            "updated_count": len(resource_updates),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/projects/analytics', methods=['GET'])
def get_project_analytics():
    """Get project analytics with cost rollups"""
    try:
        query = """
        SELECT 
            p.project_id,
            p.project_name,
            p.budget_monthly,
            p.status,
            COUNT(cr.resource_id) as total_resources,
            COUNT(CASE WHEN cr.status = 'Active' THEN 1 END) as active_resources,
            COALESCE(SUM(cm.cost_monthly), 0) as current_monthly_cost,
            p.budget_monthly - COALESCE(SUM(cm.cost_monthly), 0) as budget_remaining,
            CASE 
                WHEN COALESCE(SUM(cm.cost_monthly), 0) > p.budget_monthly THEN 'Over Budget'
                WHEN COALESCE(SUM(cm.cost_monthly), 0) > p.budget_monthly * 0.9 THEN 'Warning'
                ELSE 'On Track'
            END as budget_status,
            COUNT(CASE WHEN cr.provider = 'AWS' THEN 1 END) as aws_resources,
            COUNT(CASE WHEN cr.provider = 'GCP' THEN 1 END) as gcp_resources,
            COUNT(CASE WHEN cr.provider = 'DigitalOcean' THEN 1 END) as do_resources,
            COUNT(CASE WHEN cr.provider = 'Edge' THEN 1 END) as edge_resources
        FROM projects p
        LEFT JOIN cloud_resources cr ON p.project_id = cr.project_id
        LEFT JOIN (
            SELECT resource_id, cost_monthly,
                   ROW_NUMBER() OVER (PARTITION BY resource_id ORDER BY metric_time DESC) as rn
            FROM cloud_metrics
        ) cm ON cr.resource_id = cm.resource_id AND cm.rn = 1
        GROUP BY p.project_id, p.project_name, p.budget_monthly, p.status
        ORDER BY current_monthly_cost DESC
        """
        
        results = oracle_db.execute_query(query)
        
        return jsonify({
            "success": True,
            "count": len(results),
            "projects": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/optimize/recommendations', methods=['GET'])
def get_optimization_recommendations():
    """Get optimization recommendations"""
    try:
        query = """
        SELECT 
            resource_id,
            resource_uuid,
            provider,
            resource_type,
            optimization_flag,
            cost_monthly,
            cpu_usage_percent,
            CASE optimization_flag
                WHEN 'Underutilized' THEN cost_monthly * 0.5
                WHEN 'Right-size Candidate' THEN cost_monthly * 0.7
                WHEN 'Cost Anomaly' THEN cost_monthly * 0.8
                ELSE cost_monthly
            END as potential_savings
        FROM ANALYTICS.resource_analytics_mv
        WHERE optimization_flag != 'Normal'
        ORDER BY potential_savings DESC
        """
        
        results = oracle_db.execute_query(query)
        
        total_potential_savings = sum(
            float(r.get('COST_MONTHLY', 0)) - float(r.get('POTENTIAL_SAVINGS', 0)) 
            for r in results
        )
        
        return jsonify({
            "success": True,
            "count": len(results),
            "total_potential_savings": total_potential_savings,
            "recommendations": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/notion/sync', methods=['POST'])
def sync_with_notion():
    """Sync data with Notion databases"""
    if not notion:
        return jsonify({"success": False, "error": "Notion client not configured"}), 500
    
    try:
        data = request.json
        database_id = data.get('database_id')
        sync_type = data.get('sync_type', 'resources')
        
        if sync_type == 'resources':
            # Get resources from Oracle
            # Use the same query as resources/batch endpoint
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
                cm.cpu_usage_percent,
                cm.memory_usage_percent,
                cm.cost_monthly,
                cm.anomaly_score,
                CASE 
                    WHEN cm.cpu_usage_percent < 20 THEN 'Underutilized'
                    WHEN cm.anomaly_score > 0.8 THEN 'Cost Anomaly'
                    WHEN cm.cost_monthly > 100 THEN 'Right-size Candidate'
                    ELSE 'Normal'
                END as optimization_flag,
                CASE 
                    WHEN cm.anomaly_score > 0.8 THEN 'Warning'
                    WHEN cm.cpu_usage_percent > 90 THEN 'Critical'
                    ELSE 'Healthy'
                END as health_status,
                cm.metric_time as last_metric_time
            FROM cloud_resources cr
            LEFT JOIN (
                SELECT resource_id, cpu_usage_percent, memory_usage_percent,
                       cost_monthly, anomaly_score, metric_time,
                       ROW_NUMBER() OVER (PARTITION BY resource_id ORDER BY metric_time DESC) as rn
                FROM cloud_metrics
            ) cm ON cr.resource_id = cm.resource_id AND cm.rn = 1
            ORDER BY cm.metric_time DESC NULLS LAST
            """
            
            resources = oracle_db.execute_query(query)
            
            # Update Notion pages
            updated_count = 0
            created_count = 0
            
            for resource in resources:
                if resource.get('NOTION_PAGE_ID'):
                    try:
                        notion.pages.update(
                            page_id=resource['NOTION_PAGE_ID'],
                            properties={
                                "Status": {
                                    "select": {"name": resource.get('HEALTH_STATUS', 'Unknown')}
                                },
                                "Monthly Cost": {
                                    "number": float(resource.get('COST_MONTHLY', 0))
                                },
                                "CPU Usage %": {
                                    "number": float(resource.get('CPU_USAGE_PERCENT', 0)) / 100
                                },
                                "Optimization Flag": {
                                    "select": {"name": resource.get('OPTIMIZATION_FLAG', 'Normal')}
                                },
                                "Last Updated": {
                                    "date": {"start": datetime.now(timezone.utc).isoformat()}
                                }
                            }
                        )
                        updated_count += 1
                    except Exception as e:
                        print(f"Failed to update page {resource['NOTION_PAGE_ID']}: {e}")
                else:
                    # Create new page for resource
                    try:
                        # Map provider to Notion format
                        provider_map = {
                            'AWS': 'AWS',
                            'GCP': 'GCP',
                            'DigitalOcean': 'DigitalOcean',
                            'Edge': 'Edge Device'
                        }
                        
                        # Map status
                        status_map = {
                            'Active': '🟢 Active',
                            'Running': '🟢 Active',
                            'Warning': '🟡 Warning',
                            'Critical': '🔴 Critical',
                            'Terminated': '⚫ Terminated',
                            'Stopped': '⚫ Terminated'
                        }
                        
                        new_page = notion.pages.create(
                            parent={"database_id": config.NOTION_RESOURCES_DB_ID},
                            properties={
                                "Name": {
                                    "title": [{"text": {"content": resource.get('RESOURCE_ID', 'Unknown')}}]
                                },
                                "Provider": {
                                    "select": {"name": provider_map.get(resource.get('PROVIDER', 'Unknown'), 'AWS')}
                                },
                                "Resource Type": {
                                    "select": {"name": "Compute"}  # Default to Compute for EC2
                                },
                                "Status": {
                                    "select": {"name": status_map.get(resource.get('STATUS', 'Active'), '🟢 Active')}
                                },
                                "Owner": {
                                    "rich_text": [{"text": {"content": resource.get('OWNER', 'unknown')}}]
                                },
                                "Monthly Cost": {
                                    "number": float(resource.get('COST_MONTHLY', 0))
                                },
                                "CPU Usage %": {
                                    "number": float(resource.get('CPU_USAGE_PERCENT', 0))
                                },
                                "Optimization Flag": {
                                    "select": {"name": resource.get('OPTIMIZATION_FLAG', 'Normal')}
                                },
                                "Resource UUID": {
                                    "rich_text": [{"text": {"content": resource.get('RESOURCE_UUID', '')}}]
                                },
                                "Project": {
                                    "rich_text": [{"text": {"content": resource.get('PROJECT_ID', '')}}]
                                },
                                "Last Updated": {
                                    "date": {"start": datetime.now(timezone.utc).isoformat()}
                                }
                            }
                        )
                        
                        # Update Oracle with the new Notion page ID
                        update_query = """
                        UPDATE cloud_resources 
                        SET notion_page_id = :page_id
                        WHERE resource_id = :resource_id
                        """
                        oracle_db.execute_query(update_query, {
                            'page_id': new_page['id'],
                            'resource_id': resource['RESOURCE_ID']
                        })
                        
                        created_count += 1
                        print(f"Created Notion page for resource {resource['RESOURCE_ID']}")
                        
                    except Exception as e:
                        print(f"Failed to create page for resource {resource['RESOURCE_ID']}: {e}")
            
            return jsonify({
                "success": True,
                "created_count": created_count,
                "updated_count": updated_count,
                "total_resources": len(resources)
            })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/sync/manual', methods=['POST'])
def manual_sync():
    """Trigger manual resource sync"""
    try:
        # Run async sync in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(resource_sync_service.manual_sync())
        loop.close()
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Manual sync failed"
        }), 500

@app.route('/sync/status', methods=['GET'])
def sync_status():
    """Get sync service status and recent sync history"""
    try:
        # Get recent sync logs
        query = """
        SELECT sync_time, resource_count, duration_seconds, success, error_message
        FROM sync_logs 
        ORDER BY sync_time DESC
        FETCH FIRST 10 ROWS ONLY
        """
        
        recent_syncs = oracle_db.execute_query(query)
        
        # Get sync service status
        status = {
            "service_running": resource_sync_service.running,
            "sync_interval_hours": config.SYNC_INTERVAL_HOURS,
            "recent_syncs": recent_syncs,
            "last_sync": recent_syncs[0] if recent_syncs else None
        }
        
        return jsonify({
            "success": True,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/resources/live', methods=['GET'])
def get_live_resources():
    """Get live resources directly from cloud providers (bypasses database)"""
    try:
        # Get fresh data from cloud providers - synchronous
        resources = real_data_service.get_cloud_resources_sync()
        cost_data = real_data_service.get_cost_data_sync()
        
        return jsonify({
            "success": True,
            "count": len(resources),
            "resources": resources,
            "cost_summary": cost_data,
            "data_source": "live_cloud_apis",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "data_source": "live_cloud_apis"
        }), 500

@app.route('/recommendations/live', methods=['GET'])
def get_live_recommendations():
    """Get live optimization recommendations"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        recommendations = loop.run_until_complete(real_data_service.get_optimization_recommendations())
        loop.close()
        
        total_savings = sum(r.get('potential_savings', 0) for r in recommendations)
        
        return jsonify({
            "success": True,
            "count": len(recommendations),
            "total_potential_savings": round(total_savings, 2),
            "recommendations": recommendations,
            "data_source": "live_analysis",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/cost/live', methods=['GET'])
def get_live_cost_data():
    """Get live cost data across all cloud providers"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        cost_data = loop.run_until_complete(real_data_service.get_cost_data())
        loop.close()
        
        return jsonify({
            "success": True,
            "cost_data": cost_data,
            "data_source": "live_cloud_apis",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/recommendations/execute', methods=['POST'])
def execute_recommendation():
    """Execute a single recommendation with safety checks"""
    try:
        data = request.get_json()
        recommendation = data.get('recommendation', {})
        dry_run = data.get('dry_run', True)  # Default to dry run for safety
        
        if not recommendation:
            return jsonify({
                "success": False,
                "error": "No recommendation provided"
            }), 400
        
        # Execute recommendation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        execution = loop.run_until_complete(
            recommendation_engine.execute_recommendation(recommendation, dry_run)
        )
        loop.close()
        
        # Convert execution to dict for JSON response
        result = {
            "success": execution.status.value == "completed",
            "execution_id": execution.recommendation_id,
            "resource_id": execution.resource_id,
            "recommendation_type": execution.recommendation_type.value,
            "status": execution.status.value,
            "potential_savings": execution.potential_savings,
            "risk_level": execution.risk_level,
            "safety_checks": execution.safety_checks,
            "dry_run": dry_run,
            "execution_time": execution.execution_time.isoformat() if execution.execution_time else None,
            "completion_time": execution.completion_time.isoformat() if execution.completion_time else None,
            "error_message": execution.error_message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Recommendation execution failed"
        }), 500

@app.route('/recommendations/execute/batch', methods=['POST'])
def execute_recommendations_batch():
    """Execute multiple recommendations with coordination"""
    try:
        data = request.get_json()
        recommendations = data.get('recommendations', [])
        dry_run = data.get('dry_run', True)
        
        if not recommendations:
            return jsonify({
                "success": False,
                "error": "No recommendations provided"
            }), 400
        
        # Execute batch
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        executions = loop.run_until_complete(
            recommendation_engine.batch_execute_recommendations(recommendations, dry_run)
        )
        loop.close()
        
        # Convert executions to response format
        results = []
        total_savings = 0
        successful_count = 0
        
        for execution in executions:
            if execution.status.value == "completed":
                successful_count += 1
                total_savings += execution.potential_savings
            
            results.append({
                "execution_id": execution.recommendation_id,
                "resource_id": execution.resource_id,
                "status": execution.status.value,
                "potential_savings": execution.potential_savings,
                "safety_checks_passed": len([c for c in execution.safety_checks if c.startswith("✅")]),
                "error_message": execution.error_message
            })
        
        return jsonify({
            "success": True,
            "total_executions": len(executions),
            "successful_executions": successful_count,
            "total_potential_savings": round(total_savings, 2),
            "dry_run": dry_run,
            "executions": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Batch execution failed"
        }), 500

@app.route('/recommendations/executions', methods=['GET'])
def list_executions():
    """List all recommendation executions"""
    try:
        executions = recommendation_engine.list_executions()
        
        results = []
        for execution in executions:
            results.append({
                "execution_id": execution.recommendation_id,
                "resource_id": execution.resource_id,
                "recommendation_type": execution.recommendation_type.value,
                "status": execution.status.value,
                "potential_savings": execution.potential_savings,
                "risk_level": execution.risk_level,
                "execution_time": execution.execution_time.isoformat() if execution.execution_time else None,
                "completion_time": execution.completion_time.isoformat() if execution.completion_time else None,
                "safety_checks_count": len(execution.safety_checks),
                "error_message": execution.error_message
            })
        
        return jsonify({
            "success": True,
            "count": len(results),
            "executions": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/recommendations/executions/<execution_id>', methods=['GET'])
def get_execution_status(execution_id):
    """Get detailed status of a specific execution"""
    try:
        execution = recommendation_engine.get_execution_status(execution_id)
        
        if not execution:
            return jsonify({
                "success": False,
                "error": "Execution not found"
            }), 404
        
        result = {
            "success": True,
            "execution_id": execution.recommendation_id,
            "resource_id": execution.resource_id,
            "recommendation_type": execution.recommendation_type.value,
            "status": execution.status.value,
            "potential_savings": execution.potential_savings,
            "risk_level": execution.risk_level,
            "safety_checks": execution.safety_checks,
            "original_config": execution.original_config,
            "target_config": execution.target_config,
            "execution_time": execution.execution_time.isoformat() if execution.execution_time else None,
            "completion_time": execution.completion_time.isoformat() if execution.completion_time else None,
            "error_message": execution.error_message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/recommendations/executions/<execution_id>/rollback', methods=['POST'])
def rollback_execution(execution_id):
    """Rollback a previously executed recommendation"""
    try:
        # Execute rollback
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        success = loop.run_until_complete(
            recommendation_engine.rollback_execution(execution_id)
        )
        loop.close()
        
        if success:
            return jsonify({
                "success": True,
                "execution_id": execution_id,
                "message": "Rollback completed successfully",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        else:
            return jsonify({
                "success": False,
                "execution_id": execution_id,
                "error": "Rollback failed",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Rollback operation failed"
        }), 500

@app.route('/mcp/search', methods=['POST'])
def mcp_search_aws():
    """Search AWS documentation and knowledge bases via MCP"""
    try:
        data = request.get_json()
        search_term = data.get('searchTerm', '')
        filters = data.get('filters', {})
        
        if not search_term:
            return jsonify({
                "success": False,
                "error": "Search term is required"
            }), 400
        
        # Execute search
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        results = loop.run_until_complete(
            aws_unified_mcp_service.search_aws(search_term, filters)
        )
        loop.close()
        
        return jsonify({
            "success": True,
            "search_term": search_term,
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/mcp/query', methods=['POST'])
def mcp_query_service():
    """Query specific AWS services via MCP"""
    try:
        data = request.get_json()
        service = data.get('service', '')
        query = data.get('query', '')
        options = data.get('options', {})
        
        if not service or not query:
            return jsonify({
                "success": False,
                "error": "Service and query are required"
            }), 400
        
        # Execute query
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            aws_unified_mcp_service.query_service(service, query, options)
        )
        loop.close()
        
        return jsonify({
            "success": True,
            "service": service,
            "query": query,
            "result": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/mcp/unified-query', methods=['POST'])
def mcp_unified_query():
    """Unified query across multiple AWS services"""
    try:
        data = request.get_json()
        query = data.get('query', '')
        services = data.get('services', None)
        
        if not query:
            return jsonify({
                "success": False,
                "error": "Query is required"
            }), 400
        
        # Execute unified query
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        results = loop.run_until_complete(
            aws_unified_mcp_service.unified_query(query, services)
        )
        loop.close()
        
        return jsonify({
            "success": True,
            "query": query,
            "services": services or "all",
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/mcp/edge/devices', methods=['GET'])
def mcp_get_edge_devices():
    """Get edge device information from MCP"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        devices = loop.run_until_complete(
            aws_unified_mcp_service.get_edge_devices()
        )
        loop.close()
        
        return jsonify({
            "success": True,
            "count": len(devices),
            "devices": devices,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/mcp/cost-analysis', methods=['GET'])
def mcp_get_cost_analysis():
    """Get comprehensive cost analysis from MCP"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        cost_data = loop.run_until_complete(
            aws_unified_mcp_service.get_cost_analysis()
        )
        loop.close()
        
        return jsonify({
            "success": True,
            "cost_analysis": cost_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/mcp/templates/generate', methods=['POST'])
def mcp_generate_template():
    """Generate infrastructure as code templates"""
    try:
        data = request.get_json()
        template_type = data.get('type', '')
        resource = data.get('resource', '')
        options = data.get('options', {})
        
        if not template_type or not resource:
            return jsonify({
                "success": False,
                "error": "Template type and resource are required"
            }), 400
        
        # Generate template
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        template = loop.run_until_complete(
            aws_unified_mcp_service.generate_template(template_type, resource, options)
        )
        loop.close()
        
        return jsonify({
            "success": True,
            "type": template_type,
            "resource": resource,
            "template": template,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/mcp/templates/validate', methods=['POST'])
def mcp_validate_template():
    """Validate infrastructure as code templates"""
    try:
        data = request.get_json()
        template_type = data.get('type', '')
        template = data.get('template', '')
        
        if not template_type or not template:
            return jsonify({
                "success": False,
                "error": "Template type and template content are required"
            }), 400
        
        # Validate template
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        validation = loop.run_until_complete(
            aws_unified_mcp_service.validate_template(template_type, template)
        )
        loop.close()
        
        return jsonify({
            "success": True,
            "type": template_type,
            "validation": validation,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/mcp/best-practices/<topic>', methods=['GET'])
def mcp_get_best_practices(topic):
    """Get AWS best practices for specific topics"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        best_practices = loop.run_until_complete(
            aws_unified_mcp_service.get_best_practices(topic)
        )
        loop.close()
        
        return jsonify({
            "success": True,
            "topic": topic,
            "best_practices": best_practices,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host=config.API_HOST, port=config.API_PORT, debug=config.DEBUG)