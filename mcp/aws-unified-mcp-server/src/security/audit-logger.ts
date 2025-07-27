// Audit Logging and Security Monitoring
// Comprehensive logging for security events and access patterns

import fs from 'fs/promises';
import path from 'path';

export interface SecurityEvent {
  timestamp: string;
  eventType: 'auth_success' | 'auth_failure' | 'rate_limit' | 'sql_injection_attempt' | 'invalid_query' | 'access_denied' | 'suspicious_activity';
  clientIp: string;
  userId?: string;
  userAgent?: string;
  endpoint: string;
  query?: string;
  error?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface AccessLog {
  timestamp: string;
  clientIp: string;
  method: string;
  endpoint: string;
  userAgent?: string;
  userId?: string;
  responseStatus: number;
  responseTime: number;
  queryType?: string;
}

export class AuditLogger {
  private logDir: string;
  private securityLogFile: string;
  private accessLogFile: string;
  private alertThresholds: Map<string, { count: number; windowMs: number; lastReset: number }>;

  constructor() {
    this.logDir = process.env.LOG_DIR || '/tmp/mcp-logs';
    this.securityLogFile = path.join(this.logDir, 'security.log');
    this.accessLogFile = path.join(this.logDir, 'access.log');
    this.alertThresholds = new Map();
    
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      const logEntry = {
        ...event,
        timestamp: new Date().toISOString()
      };

      // Write to security log file
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.securityLogFile, logLine);

      // Console output for immediate visibility
      const severityColor = this.getSeverityColor(event.severity);
      console.error(`${severityColor}[SECURITY] ${event.eventType}: ${event.error || 'Event logged'}\x1b[0m`);

      // Check for alert conditions
      await this.checkAlertThresholds(event);

      // Send critical alerts immediately
      if (event.severity === 'critical') {
        await this.sendCriticalAlert(event);
      }

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  async logAccess(log: AccessLog): Promise<void> {
    try {
      const logEntry = {
        ...log,
        timestamp: new Date().toISOString()
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.accessLogFile, logLine);

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`${log.method} ${log.endpoint} - ${log.responseStatus} (${log.responseTime}ms)`);
      }

    } catch (error) {
      console.error('Failed to log access:', error);
    }
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      low: '\x1b[32m',      // Green
      medium: '\x1b[33m',   // Yellow  
      high: '\x1b[31m',     // Red
      critical: '\x1b[35m'  // Magenta
    };
    return colors[severity] || '\x1b[0m';
  }

  private async checkAlertThresholds(event: SecurityEvent): Promise<void> {
    const key = `${event.eventType}_${event.clientIp}`;
    const now = Date.now();
    const windowMs = 300000; // 5 minutes
    const maxEvents = this.getMaxEventsForType(event.eventType);

    let threshold = this.alertThresholds.get(key);
    if (!threshold || now > threshold.lastReset + windowMs) {
      threshold = { count: 0, windowMs, lastReset: now };
      this.alertThresholds.set(key, threshold);
    }

    threshold.count++;

    if (threshold.count >= maxEvents) {
      await this.logSecurityEvent({
        timestamp: new Date().toISOString(),
        eventType: 'suspicious_activity',
        clientIp: event.clientIp,
        endpoint: event.endpoint,
        error: `Threshold exceeded: ${threshold.count} ${event.eventType} events in ${windowMs/1000}s`,
        severity: 'high',
        metadata: {
          originalEventType: event.eventType,
          eventCount: threshold.count,
          windowMs: windowMs
        }
      });
    }
  }

  private getMaxEventsForType(eventType: string): number {
    const thresholds = {
      'auth_failure': 5,
      'rate_limit': 3,
      'sql_injection_attempt': 1,
      'invalid_query': 10,
      'access_denied': 5
    };
    return thresholds[eventType] || 10;
  }

  private async sendCriticalAlert(event: SecurityEvent): Promise<void> {
    // In production, this would integrate with alerting systems
    console.error(`🚨 CRITICAL SECURITY ALERT: ${event.eventType}`);
    console.error(`Client: ${event.clientIp}`);
    console.error(`Error: ${event.error}`);
    console.error(`Time: ${event.timestamp}`);
    
    // TODO: Integrate with:
    // - Slack notifications
    // - Email alerts  
    // - PagerDuty
    // - Security incident management system
  }

  async getSecurityMetrics(hours: number = 24): Promise<any> {
    try {
      const logContent = await fs.readFile(this.securityLogFile, 'utf-8');
      const lines = logContent.trim().split('\n').filter(line => line);
      
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const events = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(event => event && new Date(event.timestamp) > cutoffTime);

      const metrics = {
        totalEvents: events.length,
        eventTypes: {},
        severityBreakdown: {},
        topClientIps: {},
        timelineData: [],
        alertsTriggered: 0
      };

      events.forEach(event => {
        // Count by event type
        metrics.eventTypes[event.eventType] = (metrics.eventTypes[event.eventType] || 0) + 1;
        
        // Count by severity
        metrics.severityBreakdown[event.severity] = (metrics.severityBreakdown[event.severity] || 0) + 1;
        
        // Count by client IP
        metrics.topClientIps[event.clientIp] = (metrics.topClientIps[event.clientIp] || 0) + 1;
        
        // Count critical/high severity as alerts
        if (event.severity === 'critical' || event.severity === 'high') {
          metrics.alertsTriggered++;
        }
      });

      return metrics;

    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return { error: 'Failed to retrieve metrics' };
    }
  }

  async rotateLogsIfNeeded(): Promise<void> {
    try {
      const maxLogSize = 10 * 1024 * 1024; // 10MB
      
      // Check security log size
      try {
        const securityStats = await fs.stat(this.securityLogFile);
        if (securityStats.size > maxLogSize) {
          await this.rotateLog(this.securityLogFile);
        }
      } catch {
        // File doesn't exist yet, no rotation needed
      }

      // Check access log size  
      try {
        const accessStats = await fs.stat(this.accessLogFile);
        if (accessStats.size > maxLogSize) {
          await this.rotateLog(this.accessLogFile);
        }
      } catch {
        // File doesn't exist yet, no rotation needed
      }

    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  private async rotateLog(logFile: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = `${logFile}.${timestamp}`;
    
    try {
      await fs.rename(logFile, rotatedFile);
      console.log(`Log rotated: ${logFile} -> ${rotatedFile}`);
    } catch (error) {
      console.error(`Failed to rotate log ${logFile}:`, error);
    }
  }

  // Helper methods for common security events
  async logAuthFailure(clientIp: string, endpoint: string, error: string, userAgent?: string): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date().toISOString(),
      eventType: 'auth_failure',
      clientIp,
      endpoint,
      userAgent,
      error,
      severity: 'medium'
    });
  }

  async logSQLInjectionAttempt(clientIp: string, query: string, userAgent?: string): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date().toISOString(),
      eventType: 'sql_injection_attempt',
      clientIp,
      endpoint: '/query',
      userAgent,
      query: query.substring(0, 500), // Truncate for logging
      error: 'Potential SQL injection detected',
      severity: 'critical'
    });
  }

  async logRateLimit(clientIp: string, endpoint: string, userAgent?: string): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date().toISOString(),
      eventType: 'rate_limit',
      clientIp,
      endpoint,
      userAgent,
      error: 'Rate limit exceeded',
      severity: 'medium'
    });
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

// Start log rotation check interval with tracking
export const auditLoggerInterval = setInterval(() => {
  auditLogger.rotateLogsIfNeeded();
}, 60 * 60 * 1000); // Check every hour