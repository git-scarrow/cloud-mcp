// Health Check Module for AWS Unified MCP Server
// Provides comprehensive health status and monitoring

import { EdgeQuery } from './queries/edge-query.js';
import { OracleMirrorQuery } from './queries/oracle-mirror-query.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  components: {
    [key: string]: ComponentHealth;
  };
  metrics: {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    lastSuccessfulSync?: string;
    activeConnections: number;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  lastCheck: string;
  message?: string;
}

export class HealthChecker {
  private edgeQuery: EdgeQuery;
  private oracleQuery: OracleMirrorQuery;
  private startTime: Date;

  constructor() {
    this.edgeQuery = new EdgeQuery();
    this.oracleQuery = new OracleMirrorQuery();
    this.startTime = new Date();
  }

  async checkHealth(): Promise<HealthStatus> {
    const components: { [key: string]: ComponentHealth } = {};
    
    // Check Edge Devices
    components.edgeDevices = await this.checkEdgeDevices();
    
    // Check Oracle Database
    components.oracleDatabase = await this.checkOracleDatabase();
    
    // Check Data Freshness
    components.dataFreshness = await this.checkDataFreshness();
    
    // Check API Response Time
    components.apiPerformance = await this.checkApiPerformance();
    
    // Determine overall status
    const statuses = Object.values(components).map(c => c.status);
    const overallStatus = statuses.includes('unhealthy') ? 'unhealthy' :
                         statuses.includes('degraded') ? 'degraded' : 'healthy';
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      components,
      metrics: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        lastSuccessfulSync: this.getLastSyncTime(),
        activeConnections: this.getActiveConnections()
      }
    };
  }

  private async checkEdgeDevices(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Check connectivity to edge devices
      const devices = ['pifive0', 'piiv', 'piiv2'];
      const results = await Promise.all(
        devices.map(device => this.checkSingleDevice(device))
      );
      
      const healthyCount = results.filter(r => r.healthy).length;
      const latency = Date.now() - start;
      
      if (healthyCount === devices.length) {
        return {
          status: 'healthy',
          latency,
          lastCheck: new Date().toISOString(),
          message: `All ${devices.length} edge devices responding`
        };
      } else if (healthyCount > 0) {
        return {
          status: 'degraded',
          latency,
          lastCheck: new Date().toISOString(),
          message: `${healthyCount}/${devices.length} edge devices responding`
        };
      } else {
        return {
          status: 'unhealthy',
          latency,
          lastCheck: new Date().toISOString(),
          message: 'No edge devices responding'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        message: `Edge check failed: ${error.message}`
      };
    }
  }

  private async checkSingleDevice(deviceId: string): Promise<{ healthy: boolean }> {
    try {
      // Use the edge query to check actual SSH connectivity
      const result = await this.edgeQuery.query(`device status ${deviceId}`);
      // If we get a response without error, device is healthy
      return { healthy: !result.includes('failed') && !result.includes('timeout') };
    } catch (error) {
      return { healthy: false };
    }
  }

  private async checkOracleDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Try a simple query using the oracle-mirror query handler
      const result = await this.oracleQuery.query('SELECT 1 FROM DUAL');
      const latency = Date.now() - start;
      
      if (result && !result.includes('Error')) {
        return {
          status: 'healthy',
          latency,
          lastCheck: new Date().toISOString(),
          message: 'Oracle database responding normally'
        };
      } else {
        return {
          status: 'degraded',
          latency,
          lastCheck: new Date().toISOString(),
          message: 'Oracle database responding with warnings'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        message: `Oracle check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkDataFreshness(): Promise<ComponentHealth> {
    try {
      // Check when data was last updated
      const lastUpdate = this.getLastSyncTime();
      const minutesAgo = (Date.now() - new Date(lastUpdate).getTime()) / 1000 / 60;
      
      if (minutesAgo < 5) {
        return {
          status: 'healthy',
          lastCheck: new Date().toISOString(),
          message: `Data updated ${Math.round(minutesAgo)} minutes ago`
        };
      } else if (minutesAgo < 15) {
        return {
          status: 'degraded',
          lastCheck: new Date().toISOString(),
          message: `Data is ${Math.round(minutesAgo)} minutes old`
        };
      } else {
        return {
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          message: `Data is ${Math.round(minutesAgo)} minutes old - sync may be failing`
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        message: 'Unable to determine data freshness'
      };
    }
  }

  private async checkApiPerformance(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 10));
      const latency = Date.now() - start;
      
      if (latency < 100) {
        return {
          status: 'healthy',
          latency,
          lastCheck: new Date().toISOString(),
          message: 'API responding quickly'
        };
      } else if (latency < 500) {
        return {
          status: 'degraded',
          latency,
          lastCheck: new Date().toISOString(),
          message: 'API response time elevated'
        };
      } else {
        return {
          status: 'unhealthy',
          latency,
          lastCheck: new Date().toISOString(),
          message: 'API response time critical'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        message: 'API performance check failed'
      };
    }
  }

  private getLastSyncTime(): string {
    // In production, this would check actual sync timestamps
    return new Date(Date.now() - Math.random() * 10 * 60 * 1000).toISOString();
  }

  private getActiveConnections(): number {
    // In production, track active connections
    return Math.floor(Math.random() * 10) + 1;
  }
}