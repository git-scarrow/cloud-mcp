# AWS Unified MCP Server - Reliability Documentation

## Health Monitoring & Status

The AWS Unified MCP Server now includes comprehensive health monitoring capabilities to ensure reliable operation in production environments.

### Health Check Endpoint

**URL**: `https://macbookpro.dory-phrygian.ts.net/health`

**Response Format**:
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-07-26T23:48:45.148Z",
  "uptime": 127.734884517,
  "components": {
    "edgeDevices": {
      "status": "healthy",
      "latency": 2430,
      "lastCheck": "2025-07-26T23:48:45.128Z",
      "message": "All 3 edge devices responding"
    },
    "oracleDatabase": {
      "status": "healthy", 
      "latency": 10,
      "lastCheck": "2025-07-26T23:48:45.138Z",
      "message": "Oracle database responding normally"
    },
    "dataFreshness": {
      "status": "degraded",
      "lastCheck": "2025-07-26T23:48:45.138Z", 
      "message": "Data is 7 minutes old"
    },
    "apiPerformance": {
      "status": "healthy",
      "latency": 10,
      "lastCheck": "2025-07-26T23:48:45.148Z",
      "message": "API responding quickly"
    }
  },
  "metrics": {
    "memory": {
      "rss": 152186880,
      "heapTotal": 133025792,
      "heapUsed": 130873136,
      "external": 3996789,
      "arrayBuffers": 295314
    },
    "uptime": 127.734884517,
    "lastSuccessfulSync": "2025-07-26T23:36:27.308Z",
    "activeConnections": 1
  }
}
```

### Component Health Checks

#### 1. Edge Devices (`edgeDevices`)
- **Purpose**: Monitors SSH connectivity to all Raspberry Pi devices
- **Devices Monitored**: `pifive0`, `piiv`, `piiv2`
- **Health Criteria**:
  - `healthy`: All devices responding
  - `degraded`: Some devices responding (> 0 but < total)
  - `unhealthy`: No devices responding
- **Implementation**: Uses SSH MCP tools to test connectivity

#### 2. Oracle Database (`oracleDatabase`)
- **Purpose**: Verifies Oracle database connectivity and response time
- **Health Criteria**:
  - `healthy`: Query response < 100ms, no errors
  - `degraded`: Query response 100-500ms or warnings
  - `unhealthy`: Query fails or response > 500ms
- **Test Query**: `SELECT 1 FROM DUAL`

#### 3. Data Freshness (`dataFreshness`)
- **Purpose**: Ensures data synchronization is working properly
- **Health Criteria**:
  - `healthy`: Data updated within 5 minutes
  - `degraded`: Data 5-15 minutes old
  - `unhealthy`: Data > 15 minutes old
- **Implementation**: Tracks last successful sync timestamp

#### 4. API Performance (`apiPerformance`)
- **Purpose**: Monitors MCP server response times
- **Health Criteria**:
  - `healthy`: Response time < 100ms
  - `degraded`: Response time 100-500ms
  - `unhealthy`: Response time > 500ms

### Deployment Modes

#### Standard Mode (stdio)
```bash
npm start
# Uses stdio transport for local MCP client connections
```

#### HTTP Mode (cloud deployment)
```bash
MCP_HTTP_PORT=3002 npm start
# Provides HTTP endpoints for monitoring and cloud access
```

### Tailscale Funnel Integration

The server is accessible via secure Tailscale Funnel at:
- **Health Check**: `https://macbookpro.dory-phrygian.ts.net/health`
- **Web Interface**: `https://macbookpro.dory-phrygian.ts.net/`
- **MCP Endpoint**: `https://macbookpro.dory-phrygian.ts.net/mcp`

#### Configuration
```bash
# Start Tailscale Funnel
tailscale funnel --bg --https=443 3002

# Start MCP server in HTTP mode
MCP_HTTP_PORT=3002 npm start
```

### Environment Variables

```bash
# Standard MCP operation
AWS_UNIFIED_URL=http://localhost:3002
AWS_UNIFIED_TIMEOUT=30

# HTTP mode deployment
MCP_HTTP_PORT=3002  # or PORT=3002
```

### Reliability Features

#### 1. Graceful Shutdown
- Handles SIGINT and SIGTERM signals
- Cleanly closes Oracle connection pools
- Prevents data corruption during shutdown

#### 2. Error Handling
- Comprehensive try-catch blocks around all health checks
- Graceful degradation when components are unavailable
- Detailed error messages for troubleshooting

#### 3. Connection Pooling
- Oracle connections are pooled and managed efficiently
- SSH connections are reused where possible
- Automatic reconnection on failures

#### 4. Performance Monitoring
- Real-time latency tracking for all components
- Memory usage monitoring
- Uptime tracking

### Monitoring Integration

#### Pipedream Workflows
The health endpoint is designed for integration with Pipedream monitoring workflows:

```javascript
// Health check in Pipedream
const healthResponse = await fetch('https://macbookpro.dory-phrygian.ts.net/health');
const health = await healthResponse.json();

if (health.status === 'unhealthy') {
  // Trigger alerts
  await this.slack.chat.postMessage({
    channel: '#alerts',
    text: `🚨 MCP Server Unhealthy: ${health.components}`
  });
}
```

#### Oracle Analytics
Health metrics are automatically stored in Oracle for trend analysis:
- Component availability over time
- Performance degradation patterns
- Correlation with cost anomalies

### Testing & Verification

#### Manual Health Check
```bash
curl -s https://macbookpro.dory-phrygian.ts.net/health | jq .
```

#### Component-Specific Tests
```bash
# Test edge device connectivity
curl -s https://macbookpro.dory-phrygian.ts.net/health | jq .components.edgeDevices

# Test Oracle database
curl -s https://macbookpro.dory-phrygian.ts.net/health | jq .components.oracleDatabase
```

### Troubleshooting

#### Common Issues

1. **Edge Devices Unhealthy**
   - Check SSH key authentication
   - Verify Tailscale connectivity to devices
   - Ensure devices are powered on

2. **Oracle Database Unhealthy**
   - Verify Oracle service is running
   - Check connection string and credentials
   - Test network connectivity to Oracle host

3. **Data Freshness Degraded**
   - Check sync script execution
   - Verify Pipedream workflow status
   - Review API rate limits

4. **API Performance Degraded**
   - Monitor memory usage for leaks
   - Check for high CPU utilization
   - Review concurrent connection counts

### Production Checklist

- [ ] Health endpoint accessible via Tailscale Funnel
- [ ] All edge devices responding to SSH checks
- [ ] Oracle database connectivity verified
- [ ] Data sync working within 5-minute intervals
- [ ] Memory usage stable (< 200MB typical)
- [ ] Response times < 100ms for healthy status
- [ ] Monitoring alerts configured in Pipedream
- [ ] Graceful shutdown tested
- [ ] Error logging operational

### Metrics & SLAs

#### Target Availability: 99.5%
- **Edge Devices**: 95% healthy (2/3 minimum)
- **Oracle Database**: 99% uptime
- **Data Freshness**: < 5 minutes, 95% of the time
- **API Performance**: < 100ms response, 95% of requests

#### Alert Thresholds
- **Critical**: Any component reports `unhealthy`
- **Warning**: Any component reports `degraded` for > 15 minutes
- **Info**: Data freshness > 10 minutes

This comprehensive health monitoring system ensures the MCP server maintains high reliability for production use in the cloud operations monitoring platform.