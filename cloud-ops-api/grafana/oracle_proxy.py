#!/usr/bin/env python3
"""
Oracle Proxy API for Grafana
Provides REST endpoints that Grafana can query for Oracle data
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from datetime import datetime, timedelta
import cx_Oracle
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import config

app = Flask(__name__)
CORS(app)

# Oracle connection from centralized config
ORACLE_DSN = config.ORACLE_DSN
ORACLE_USER = config.ORACLE_USER
ORACLE_PASSWORD = config.ORACLE_PASSWORD

def get_oracle_connection():
    """Get Oracle database connection"""
    return cx_Oracle.connect(
        user=ORACLE_USER,
        password=ORACLE_PASSWORD,
        dsn=ORACLE_DSN
    )

def execute_query(query, params=None):
    """Execute Oracle query and return results"""
    conn = get_oracle_connection()
    cursor = conn.cursor()
    try:
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [dict(zip(columns, row)) for row in rows]
    finally:
        cursor.close()
        conn.close()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check for Grafana data source"""
    try:
        execute_query("SELECT 1 FROM dual")
        return jsonify({"status": "ok", "message": "Oracle connection successful"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/search', methods=['POST'])
def search_metrics():
    """Return available metrics for Grafana"""
    metrics = [
        "cost_monthly_total",
        "cost_monthly_by_provider", 
        "resource_count_by_provider",
        "resource_count_by_status",
        "cpu_usage_avg",
        "memory_usage_avg",
        "budget_utilization",
        "anomaly_score_avg",
        "optimization_opportunities"
    ]
    return jsonify(metrics)

@app.route('/query', methods=['POST'])
def query_metrics():
    """Main query endpoint for Grafana"""
    try:
        data = request.json
        targets = data.get('targets', [])
        time_range = data.get('range', {})
        
        results = []
        
        for target in targets:
            metric = target.get('target')
            if not metric:
                continue
                
            # Route to appropriate query handler
            if metric == 'cost_monthly_total':
                result = get_cost_monthly_total(time_range)
            elif metric == 'cost_monthly_by_provider':
                result = get_cost_by_provider(time_range)
            elif metric == 'resource_count_by_provider':
                result = get_resource_count_by_provider(time_range)
            elif metric == 'resource_count_by_status':
                result = get_resource_count_by_status(time_range)
            elif metric == 'cpu_usage_avg':
                result = get_cpu_usage_avg(time_range)
            elif metric == 'memory_usage_avg':
                result = get_memory_usage_avg(time_range)
            elif metric == 'budget_utilization':
                result = get_budget_utilization(time_range)
            elif metric == 'anomaly_score_avg':
                result = get_anomaly_score_avg(time_range)
            elif metric == 'optimization_opportunities':
                result = get_optimization_opportunities(time_range)
            else:
                result = {"target": metric, "datapoints": []}
            
            results.append(result)
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_cost_monthly_total(time_range):
    """Get total monthly cost over time"""
    query = """
    SELECT 
        TRUNC(metric_time, 'DD') as time_bucket,
        SUM(cost_monthly) as total_cost
    FROM ANALYTICS.cloud_metrics cm
    JOIN ANALYTICS.cloud_resources cr ON cm.resource_id = cr.resource_id
    WHERE cr.status != 'Terminated'
    GROUP BY TRUNC(metric_time, 'DD')
    ORDER BY time_bucket
    """
    
    rows = execute_query(query)
    datapoints = []
    
    for row in rows:
        timestamp = int(row['TIME_BUCKET'].timestamp() * 1000)  # Convert to milliseconds
        value = float(row['TOTAL_COST'])
        datapoints.append([value, timestamp])
    
    return {
        "target": "Total Monthly Cost ($)",
        "datapoints": datapoints
    }

def get_cost_by_provider(time_range):
    """Get cost breakdown by cloud provider"""
    query = """
    SELECT 
        provider,
        SUM(cost_monthly) as provider_cost
    FROM ANALYTICS.resource_analytics_mv
    WHERE cost_monthly > 0
    GROUP BY provider
    ORDER BY provider_cost DESC
    """
    
    rows = execute_query(query)
    
    # Return as table data for Grafana pie chart
    return {
        "target": "Cost by Provider",
        "type": "table",
        "columns": [
            {"text": "Provider", "type": "string"},
            {"text": "Cost", "type": "number"}
        ],
        "rows": [[row['PROVIDER'], float(row['PROVIDER_COST'])] for row in rows]
    }

def get_resource_count_by_provider(time_range):
    """Get resource count by provider"""
    query = """
    SELECT 
        provider,
        COUNT(*) as resource_count
    FROM ANALYTICS.cloud_resources
    WHERE status != 'Terminated'
    GROUP BY provider
    ORDER BY resource_count DESC
    """
    
    rows = execute_query(query)
    
    return {
        "target": "Resources by Provider", 
        "type": "table",
        "columns": [
            {"text": "Provider", "type": "string"},
            {"text": "Count", "type": "number"}
        ],
        "rows": [[row['PROVIDER'], row['RESOURCE_COUNT']] for row in rows]
    }

def get_resource_count_by_status(time_range):
    """Get resource count by status"""
    query = """
    SELECT 
        status,
        COUNT(*) as status_count
    FROM ANALYTICS.cloud_resources
    GROUP BY status
    ORDER BY status_count DESC
    """
    
    rows = execute_query(query)
    
    return {
        "target": "Resources by Status",
        "type": "table", 
        "columns": [
            {"text": "Status", "type": "string"},
            {"text": "Count", "type": "number"}
        ],
        "rows": [[row['STATUS'], row['STATUS_COUNT']] for row in rows]
    }

def get_cpu_usage_avg(time_range):
    """Get average CPU usage over time"""
    query = """
    SELECT 
        TRUNC(metric_time, 'HH24') as time_bucket,
        AVG(cpu_usage_percent) as avg_cpu
    FROM ANALYTICS.cloud_metrics
    WHERE cpu_usage_percent IS NOT NULL
    GROUP BY TRUNC(metric_time, 'HH24')
    ORDER BY time_bucket
    """
    
    rows = execute_query(query)
    datapoints = []
    
    for row in rows:
        timestamp = int(row['TIME_BUCKET'].timestamp() * 1000)
        value = float(row['AVG_CPU'])
        datapoints.append([value, timestamp])
    
    return {
        "target": "Average CPU Usage (%)",
        "datapoints": datapoints
    }

def get_memory_usage_avg(time_range):
    """Get average memory usage over time"""
    query = """
    SELECT 
        TRUNC(metric_time, 'HH24') as time_bucket,
        AVG(memory_usage_percent) as avg_memory
    FROM ANALYTICS.cloud_metrics
    WHERE memory_usage_percent IS NOT NULL
    GROUP BY TRUNC(metric_time, 'HH24')
    ORDER BY time_bucket
    """
    
    rows = execute_query(query)
    datapoints = []
    
    for row in rows:
        timestamp = int(row['TIME_BUCKET'].timestamp() * 1000)
        value = float(row['AVG_MEMORY'])
        datapoints.append([value, timestamp])
    
    return {
        "target": "Average Memory Usage (%)",
        "datapoints": datapoints
    }

def get_budget_utilization(time_range):
    """Get budget utilization percentage"""
    query = """
    SELECT 
        project_id,
        (current_monthly_cost / budget_monthly) * 100 as utilization_percent
    FROM ANALYTICS.project_analytics_v
    WHERE budget_monthly > 0
    """
    
    rows = execute_query(query)
    
    # Return current utilization as single value
    if rows:
        utilization = float(rows[0]['UTILIZATION_PERCENT'])
        # Create datapoint with current timestamp
        timestamp = int(datetime.utcnow().timestamp() * 1000)
        return {
            "target": "Budget Utilization (%)",
            "datapoints": [[utilization, timestamp]]
        }
    
    return {"target": "Budget Utilization (%)", "datapoints": []}

def get_anomaly_score_avg(time_range):
    """Get average anomaly score"""
    query = """
    SELECT AVG(anomaly_score) as avg_anomaly_score
    FROM ANALYTICS.resource_analytics_mv
    WHERE anomaly_score IS NOT NULL
    """
    
    rows = execute_query(query)
    
    if rows and rows[0]['AVG_ANOMALY_SCORE'] is not None:
        score = float(rows[0]['AVG_ANOMALY_SCORE'])
        timestamp = int(datetime.utcnow().timestamp() * 1000)
        return {
            "target": "Average Anomaly Score",
            "datapoints": [[score, timestamp]]
        }
    
    return {"target": "Average Anomaly Score", "datapoints": []}

def get_optimization_opportunities(time_range):
    """Get count of optimization opportunities"""
    query = """
    SELECT 
        optimization_flag,
        COUNT(*) as opportunity_count
    FROM ANALYTICS.resource_analytics_mv
    WHERE optimization_flag != 'Normal'
    GROUP BY optimization_flag
    ORDER BY opportunity_count DESC
    """
    
    rows = execute_query(query)
    
    return {
        "target": "Optimization Opportunities",
        "type": "table",
        "columns": [
            {"text": "Type", "type": "string"},
            {"text": "Count", "type": "number"}
        ], 
        "rows": [[row['OPTIMIZATION_FLAG'], row['OPPORTUNITY_COUNT']] for row in rows]
    }

@app.route('/annotations', methods=['POST'])
def get_annotations():
    """Get annotations for Grafana (events, deployments, etc.)"""
    # This could show sync events, cost changes, resource deployments
    return jsonify([])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)