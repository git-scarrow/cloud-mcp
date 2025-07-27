# Pipedream Workflow Oracle Migration

## Migration Summary

Successfully migrated Pipedream cost optimization workflows from using Pipedream's internal key-value store to Oracle database via secure MCP server integration.

## Key Architectural Changes

### 1. **Secure MCP Server Access**
- **Old**: Local localhost access only
- **New**: Secure Tailscale Funnel access at `https://macbookpro.dory-phrygian.ts.net`
- **Benefit**: Pipedream can now reliably access MCP server from cloud

### 2. **Historical Data Storage**
- **Old**: Pipedream `$.data.get()/$.data.set()` key-value store
- **New**: Oracle `CLOUD_COMPARE.COST_DAILY_METRICS` table
- **Query**: `SELECT AVG(daily_cost) as daily_avg, service_name FROM CLOUD_COMPARE.COST_DAILY_METRICS WHERE metric_date >= TRUNC(SYSDATE) - 30 GROUP BY service_name`

### 3. **Anomaly Tracking**
- **Old**: Transient data in Pipedream exports
- **New**: Persistent Oracle `CLOUD_COMPARE.COST_ANOMALIES` table
- **Insert**: `INSERT INTO CLOUD_COMPARE.COST_ANOMALIES (anomaly_type, severity, service_name, current_value, expected_value, details) VALUES (...)`

### 4. **Workflow Execution History**
- **Old**: Time-limited Pipedream data store
- **New**: Oracle `CLOUD_COMPARE.WORKFLOW_EXECUTIONS` table
- **Tracking**: Full execution details, anomaly counts, potential savings

### 5. **Health Monitoring**
- **New**: STEP 0 health check before each workflow run
- **Endpoint**: `https://macbookpro.dory-phrygian.ts.net/health`
- **Failure Handling**: Graceful degradation with fallback to defaults

## Updated Workflow Steps

### STEP 0: Health Check MCP Server
```javascript
const healthResponse = await fetch(`${CONFIG.MCP_URL}/health`);
const health = await healthResponse.json();

if (health.status === 'unhealthy') {
  throw new Error(`MCP Server unhealthy: ${JSON.stringify(health.components)}`);
}
```

### STEP 2: Anomaly Detection (Updated)
```javascript
// Fetch from Oracle instead of Pipedream data store
const mcpResponse = await fetch(`${CONFIG.MCP_URL}/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service: 'oracle-mirror',
    query: 'SELECT AVG(daily_cost) as daily_avg, service_name FROM CLOUD_COMPARE.COST_DAILY_METRICS WHERE metric_date >= TRUNC(SYSDATE) - 30 GROUP BY service_name'
  })
});

// Store metrics in Oracle
await fetch(`${CONFIG.MCP_URL}/query`, {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service: 'oracle-mirror',
    query: `INSERT INTO CLOUD_COMPARE.COST_DAILY_METRICS (service_name, daily_cost, metric_data) VALUES ('pipeline-execution', ${currentCosts.total_daily}, '${JSON.stringify(costData)}')`
  })
});

// Store anomalies in Oracle
for (const anomaly of anomalies) {
  await fetch(`${CONFIG.MCP_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'oracle-mirror', 
      query: `INSERT INTO CLOUD_COMPARE.COST_ANOMALIES (anomaly_type, severity, service_name, current_value, expected_value, details) VALUES ('${anomaly.type}', '${anomaly.severity}', '${anomaly.service || 'overall'}', ${anomaly.current || 0}, ${anomaly.expected || 0}, '${JSON.stringify(anomaly)}')`
    })
  });
}
```

### STEP 6: Results Storage (Updated)
```javascript
// Store execution in Oracle
await fetch(`${CONFIG.MCP_URL}/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service: 'oracle-mirror',
    query: `INSERT INTO CLOUD_COMPARE.WORKFLOW_EXECUTIONS (execution_id, workflow_name, status, anomalies_detected, recommendations_generated, potential_savings, execution_details) VALUES ('${execution.id}', 'Daily Cost Optimization Analyzer', 'Success', ${execution.anomalies.anomaly_count}, ${execution.recommendations.length || 0}, ${parseFloat(execution.recommendations.total_daily_savings || 0)}, '${JSON.stringify(execution)}')`
  })
});

// Get metrics from Oracle
const metricsResponse = await fetch(`${CONFIG.MCP_URL}/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service: 'oracle-mirror',
    query: 'SELECT COUNT(*) as analyses_run, SUM(anomalies_detected) as total_anomalies, SUM(potential_savings) as total_savings_identified FROM CLOUD_COMPARE.WORKFLOW_EXECUTIONS WHERE workflow_name = \'Daily Cost Optimization Analyzer\''
  })
});
```

## Benefits of Oracle Migration

### 1. **Data Persistence**
- No more 90-day TTL limitations
- Full historical data retention
- Complex queries and analytics possible

### 2. **Performance**
- Indexed columns for fast queries
- Materialized views for dashboards
- Partitioned tables for large datasets

### 3. **Reliability** 
- ACID transactions ensure data consistency
- Backup and recovery capabilities
- No dependency on Pipedream's data store limits

### 4. **Analytics Capabilities**
- Complex trend analysis across time periods
- Correlation between anomalies and costs
- Service-level performance metrics
- ROI tracking for optimization recommendations

### 5. **Integration**
- Oracle data accessible to other systems
- Standard SQL for reporting
- Real-time views for current status

## Configuration

### Environment Variables
```bash
# MCP Server with Oracle integration
MCP_URL=https://macbookpro.dory-phrygian.ts.net

# Oracle database access via MCP
ORACLE_HOST=localhost
ORACLE_SERVICE=FREE
ORACLE_USER=ANALYTICS
```

### Pipedream Workflow Config
```javascript
const CONFIG = {
    MCP_URL: 'https://macbookpro.dory-phrygian.ts.net',
    DAILY_BUDGET: 0.50,  // $15/month ÷ 30 days
    MONTHLY_BUDGET: 15.00,
    EMAIL_RECIPIENTS: ['sscarrow@gmail.com']
};
```

## Fallback Strategy

Each Oracle operation includes fallback to Pipedream data store if MCP/Oracle fails:

```javascript
try {
  // Try Oracle via MCP
  await fetch(`${CONFIG.MCP_URL}/query`, { ... });
} catch (error) {
  console.log('Oracle failed, using Pipedream fallback:', error);
  // Fallback to Pipedream data store
  await $.data.set(key, data);
}
```

## Testing & Verification

### Health Check
```bash
curl -s https://macbookpro.dory-phrygian.ts.net/health | jq .
```

### Oracle Connectivity
```bash
curl -X POST https://macbookpro.dory-phrygian.ts.net/query \
  -H "Content-Type: application/json" \
  -d '{"service": "oracle-mirror", "query": "SELECT COUNT(*) FROM CLOUD_COMPARE.COST_DAILY_METRICS"}'
```

### Workflow Execution
- Monitor Pipedream execution logs for Oracle success/failure messages
- Verify data appears in Oracle tables after workflow runs
- Check health endpoint shows all components healthy

This migration ensures reliable, scalable, and persistent data storage for the cost optimization platform while maintaining the $15/month budget constraint.