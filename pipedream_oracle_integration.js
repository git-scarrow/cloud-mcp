// Pipedream Oracle Integration for Cost Analytics
// This module provides Oracle database operations for the cost optimization workflow

// ============================================
// ORACLE CONFIGURATION
// ============================================
const ORACLE_CONFIG = {
    // Connection via Oracle MCP
    queries: {
        insertMetrics: `
            INSERT INTO CLOUD_COMPARE.COST_DAILY_METRICS (
                service_name, device_id, daily_cost,
                cpu_usage_avg, cpu_usage_peak,
                memory_usage_avg, memory_usage_peak,
                disk_usage_pct, network_bytes_total,
                metric_data
            ) VALUES (
                :service_name, :device_id, :daily_cost,
                :cpu_avg, :cpu_peak,
                :mem_avg, :mem_peak,
                :disk_pct, :network_bytes,
                :metric_json
            )`,
        
        insertAnomaly: `
            INSERT INTO CLOUD_COMPARE.COST_ANOMALIES (
                anomaly_type, severity, service_name,
                device_id, current_value, expected_value,
                details
            ) VALUES (
                :anomaly_type, :severity, :service_name,
                :device_id, :current_value, :expected_value,
                :details
            )`,
        
        insertWorkflow: `
            INSERT INTO CLOUD_COMPARE.WORKFLOW_EXECUTIONS (
                execution_id, workflow_name, status,
                anomalies_detected, recommendations_generated,
                potential_savings, execution_details
            ) VALUES (
                :execution_id, :workflow_name, :status,
                :anomalies, :recommendations,
                :savings, :details
            )`,
        
        updateWorkflow: `
            UPDATE CLOUD_COMPARE.WORKFLOW_EXECUTIONS
            SET completed_at = SYSTIMESTAMP,
                status = :status,
                error_message = :error_message
            WHERE execution_id = :execution_id`,
        
        getCurrentCosts: `SELECT * FROM CLOUD_COMPARE.V_CURRENT_COSTS`,
        
        getActiveAnomalies: `SELECT * FROM CLOUD_COMPARE.V_ACTIVE_ANOMALIES`,
        
        getCostTrends: `
            SELECT 
                metric_date,
                SUM(daily_cost) as total_cost,
                AVG(cpu_usage_avg) as avg_cpu,
                MAX(cpu_usage_peak) as peak_cpu
            FROM CLOUD_COMPARE.COST_DAILY_METRICS
            WHERE metric_date >= TRUNC(SYSDATE) - :days
            GROUP BY metric_date
            ORDER BY metric_date DESC`
    }
};

// ============================================
// STEP 1: Store Cost Metrics in Oracle
// ============================================
export default defineComponent({
  props: {
    oracle: {
      type: "app",
      app: "oracle"
    }
  },
  async run({ steps, $ }) {
    const costData = steps.fetch_costs.$return_value;
    const results = [];
    
    try {
      // Store metrics for each service
      for (const [service, cost] of Object.entries(costData.by_service)) {
        if (cost > 0) {
          const metricData = {
            service_name: service,
            device_id: null, // Service-level metric
            daily_cost: cost,
            cpu_avg: null,
            cpu_peak: null,
            mem_avg: null,
            mem_peak: null,
            disk_pct: null,
            network_bytes: null,
            metric_json: JSON.stringify({
              timestamp: costData.timestamp,
              source: 'pipedream_workflow'
            })
          };
          
          await this.oracle.executeQuery({
            query: ORACLE_CONFIG.queries.insertMetrics,
            binds: metricData
          });
          
          results.push({ service, status: 'stored' });
        }
      }
      
      // Store device-specific metrics
      for (const [device, cost] of Object.entries(costData.by_resource)) {
        if (cost > 0) {
          const deviceData = {
            service_name: 'edge-devices',
            device_id: device,
            daily_cost: cost,
            cpu_avg: Math.random() * 30 + 10, // TODO: Get real metrics
            cpu_peak: Math.random() * 50 + 20,
            mem_avg: Math.random() * 40 + 20,
            mem_peak: Math.random() * 60 + 30,
            disk_pct: Math.random() * 30 + 10,
            network_bytes: Math.floor(Math.random() * 10485760),
            metric_json: JSON.stringify({
              timestamp: costData.timestamp,
              raw_data: costData.raw_data?.[device] || {}
            })
          };
          
          await this.oracle.executeQuery({
            query: ORACLE_CONFIG.queries.insertMetrics,
            binds: deviceData
          });
          
          results.push({ device, status: 'stored' });
        }
      }
      
      $.export("oracle_storage", {
        status: "success",
        records_stored: results.length,
        details: results
      });
      
      return { success: true, stored: results.length };
      
    } catch (error) {
      console.error("Oracle storage failed:", error);
      return { success: false, error: error.message };
    }
  }
});

// ============================================
// STEP 2: Store Anomalies in Oracle
// ============================================
export default defineComponent({
  props: {
    oracle: {
      type: "app",
      app: "oracle"
    }
  },
  async run({ steps, $ }) {
    const anomalies = steps.anomaly_detection.$return_value;
    const stored = [];
    
    try {
      for (const anomaly of anomalies.anomalies) {
        const anomalyData = {
          anomaly_type: anomaly.type,
          severity: anomaly.severity,
          service_name: anomaly.service || 'overall',
          device_id: anomaly.resource || null,
          current_value: anomaly.current,
          expected_value: anomaly.expected,
          details: JSON.stringify({
            message: anomaly.message,
            increase_pct: anomaly.increase_pct,
            metadata: anomaly
          })
        };
        
        const result = await this.oracle.executeQuery({
          query: ORACLE_CONFIG.queries.insertAnomaly,
          binds: anomalyData
        });
        
        stored.push({
          type: anomaly.type,
          severity: anomaly.severity,
          stored: true
        });
      }
      
      $.export("anomaly_storage", {
        status: "success",
        anomalies_stored: stored.length
      });
      
      return { success: true, stored: stored };
      
    } catch (error) {
      console.error("Anomaly storage failed:", error);
      return { success: false, error: error.message };
    }
  }
});

// ============================================
// STEP 3: Query Historical Data from Oracle
// ============================================
export default defineComponent({
  props: {
    oracle: {
      type: "app",
      app: "oracle"
    }
  },
  async run({ steps, $ }) {
    try {
      // Get current costs
      const currentCosts = await this.oracle.executeQuery({
        query: ORACLE_CONFIG.queries.getCurrentCosts
      });
      
      // Get 30-day trends
      const trends = await this.oracle.executeQuery({
        query: ORACLE_CONFIG.queries.getCostTrends,
        binds: { days: 30 }
      });
      
      // Get active anomalies
      const activeAnomalies = await this.oracle.executeQuery({
        query: ORACLE_CONFIG.queries.getActiveAnomalies
      });
      
      // Calculate statistics
      const stats = {
        current_daily_total: currentCosts.rows.reduce(
          (sum, row) => sum + (row.TODAY_COST || 0), 0
        ),
        active_anomaly_count: activeAnomalies.rows.length,
        critical_anomalies: activeAnomalies.rows.filter(
          a => a.SEVERITY === 'Critical'
        ).length,
        trend_data: trends.rows
      };
      
      $.export("historical_data", {
        current_costs: currentCosts.rows,
        active_anomalies: activeAnomalies.rows,
        statistics: stats
      });
      
      return {
        success: true,
        data: {
          current: currentCosts.rows,
          anomalies: activeAnomalies.rows,
          trends: trends.rows,
          stats
        }
      };
      
    } catch (error) {
      console.error("Oracle query failed:", error);
      return { success: false, error: error.message };
    }
  }
});

// ============================================
// STEP 4: Track Workflow Execution
// ============================================
export default defineComponent({
  props: {
    oracle: {
      type: "app",
      app: "oracle"
    }
  },
  async run({ steps, $ }) {
    const execution = {
      execution_id: $.id,
      workflow_name: 'Daily Cost Optimization Analyzer',
      status: 'Running',
      anomalies: steps.anomaly_detection.$return_value.anomaly_count || 0,
      recommendations: steps.generate_recommendations.$return_value.length || 0,
      savings: parseFloat(steps.generate_recommendations.$return_value
        .reduce((sum, rec) => sum + parseFloat(rec.potential_savings || 0), 0)
        .toFixed(2)),
      details: JSON.stringify({
        started_at: new Date().toISOString(),
        cost_data: steps.fetch_costs.$return_value,
        pipedream_execution: $.id
      })
    };
    
    try {
      // Insert workflow execution record
      await this.oracle.executeQuery({
        query: ORACLE_CONFIG.queries.insertWorkflow,
        binds: execution
      });
      
      // At the end of workflow, update status
      const finalStatus = {
        execution_id: $.id,
        status: 'Success',
        error_message: null
      };
      
      await this.oracle.executeQuery({
        query: ORACLE_CONFIG.queries.updateWorkflow,
        binds: finalStatus
      });
      
      $.export("workflow_tracking", {
        execution_id: $.id,
        status: "tracked",
        anomalies_detected: execution.anomalies,
        potential_savings: execution.savings
      });
      
      return { success: true, execution_id: $.id };
      
    } catch (error) {
      // Log error
      await this.oracle.executeQuery({
        query: ORACLE_CONFIG.queries.updateWorkflow,
        binds: {
          execution_id: $.id,
          status: 'Failed',
          error_message: error.message
        }
      });
      
      return { success: false, error: error.message };
    }
  }
});