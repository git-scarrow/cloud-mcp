// Input Validation and SQL Injection Prevention
// Implements strict validation for all user inputs

import { z } from 'zod';

// Define allowed SQL operations for Oracle queries
const ALLOWED_SQL_PATTERNS = {
  // Read operations
  SELECT: /^SELECT\s+[A-Za-z0-9_,\s\*\(\)\.]+\s+FROM\s+CLOUD_COMPARE\.[A-Za-z0-9_]+/i,
  
  // Write operations (restricted to specific tables)
  INSERT: /^INSERT\s+INTO\s+CLOUD_COMPARE\.(COST_DAILY_METRICS|COST_ANOMALIES|WORKFLOW_EXECUTIONS)\s*\(/i,
  
  // Update operations (very restricted)
  UPDATE: /^UPDATE\s+CLOUD_COMPARE\.(COST_ANOMALIES)\s+SET\s+resolved_at\s*=/i
};

// Dangerous SQL patterns that should never be allowed
const DANGEROUS_PATTERNS = [
  /DROP\s+/i,
  /DELETE\s+/i,
  /TRUNCATE\s+/i,
  /ALTER\s+/i,
  /CREATE\s+/i,
  /GRANT\s+/i,
  /REVOKE\s+/i,
  /EXEC\s+/i,
  /EXECUTE\s+/i,
  /xp_/i,
  /sp_/i,
  /--/,
  /\/\*/,
  /;\s*DROP/i,
  /UNION\s+SELECT/i,
  /INFORMATION_SCHEMA/i,
  /USER_TABLES/i,
  /ALL_TABLES/i
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: any;
}

export class InputValidator {
  
  static validateOracleQuery(query: string): ValidationResult {
    try {
      // Basic sanitization
      const trimmedQuery = query.trim();
      
      if (trimmedQuery.length === 0) {
        return { valid: false, error: 'Query cannot be empty' };
      }
      
      if (trimmedQuery.length > 10000) {
        return { valid: false, error: 'Query too long (max 10,000 characters)' };
      }
      
      // Check for dangerous patterns
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(trimmedQuery)) {
          return { 
            valid: false, 
            error: `Dangerous SQL pattern detected: ${pattern.source}` 
          };
        }
      }
      
      // Check if query matches allowed patterns
      const isAllowed = Object.values(ALLOWED_SQL_PATTERNS).some(pattern => 
        pattern.test(trimmedQuery)
      );
      
      if (!isAllowed) {
        return { 
          valid: false, 
          error: 'Query does not match allowed patterns' 
        };
      }
      
      // Additional validation for SELECT queries
      if (trimmedQuery.toUpperCase().startsWith('SELECT')) {
        return this.validateSelectQuery(trimmedQuery);
      }
      
      // Additional validation for INSERT queries
      if (trimmedQuery.toUpperCase().startsWith('INSERT')) {
        return this.validateInsertQuery(trimmedQuery);
      }
      
      return { valid: true, sanitized: trimmedQuery };
      
    } catch (error) {
      return { valid: false, error: 'Query validation failed' };
    }
  }
  
  private static validateSelectQuery(query: string): ValidationResult {
    // Ensure SELECT is only from allowed tables
    if (!query.includes('CLOUD_COMPARE.')) {
      return { valid: false, error: 'SELECT queries must specify CLOUD_COMPARE schema' };
    }
    
    // Limit result set size
    if (!query.toUpperCase().includes('ROWNUM') && 
        !query.toUpperCase().includes('LIMIT') &&
        !query.toUpperCase().includes('TOP ')) {
      // Add ROWNUM limitation for safety
      const limitedQuery = query.replace(
        /FROM\s+/i, 
        'FROM (SELECT * FROM '
      ) + ' WHERE ROWNUM <= 1000)';
      
      return { valid: true, sanitized: limitedQuery };
    }
    
    return { valid: true, sanitized: query };
  }
  
  private static validateInsertQuery(query: string): ValidationResult {
    // Ensure INSERT is only into allowed tables
    const allowedTables = [
      'CLOUD_COMPARE.COST_DAILY_METRICS',
      'CLOUD_COMPARE.COST_ANOMALIES', 
      'CLOUD_COMPARE.WORKFLOW_EXECUTIONS'
    ];
    
    const isAllowedTable = allowedTables.some(table => 
      query.toUpperCase().includes(table)
    );
    
    if (!isAllowedTable) {
      return { 
        valid: false, 
        error: 'INSERT only allowed into COST_DAILY_METRICS, COST_ANOMALIES, or WORKFLOW_EXECUTIONS tables' 
      };
    }
    
    return { valid: true, sanitized: query };
  }
  
  static validateMCPQuery(service: string, query: string, options?: any): ValidationResult {
    try {
      // Validate service name
      const allowedServices = [
        'knowledge', 'documentation', 'terraform', 'cloudformation', 
        'core', 'edge', 'gcp', 'oracle-mirror', 'digitalocean'
      ];
      
      if (!allowedServices.includes(service)) {
        return { valid: false, error: `Invalid service: ${service}` };
      }
      
      // Validate query string
      if (typeof query !== 'string' || query.length === 0) {
        return { valid: false, error: 'Query must be a non-empty string' };
      }
      
      if (query.length > 5000) {
        return { valid: false, error: 'Query too long (max 5,000 characters)' };
      }
      
      // Special validation for oracle-mirror service
      if (service === 'oracle-mirror') {
        return this.validateOracleQuery(query);
      }
      
      // Sanitize query for other services
      const sanitizedQuery = query
        .replace(/[<>]/g, '') // Remove potential XSS
        .replace(/['"]/g, '') // Remove quotes that could break parsing
        .trim();
      
      return { valid: true, sanitized: sanitizedQuery };
      
    } catch (error) {
      return { valid: false, error: 'MCP query validation failed' };
    }
  }
  
  static validateHealthCheckAccess(clientIp: string, userAgent?: string): ValidationResult {
    // Allow health checks from monitoring systems
    const allowedUserAgents = [
      /curl/i,
      /pipedream/i,
      /monitoring/i,
      /uptime/i,
      /pingdom/i,
      /datadog/i
    ];
    
    // Block suspicious patterns
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scanner/i
    ];
    
    if (userAgent) {
      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(userAgent)
      );
      
      if (isSuspicious) {
        return { valid: false, error: 'Suspicious user agent' };
      }
    }
    
    return { valid: true };
  }
  
  static sanitizeJsonInput(input: any): ValidationResult {
    try {
      // Prevent prototype pollution
      if (input && typeof input === 'object') {
        if ('__proto__' in input || 'constructor' in input || 'prototype' in input) {
          return { valid: false, error: 'Potentially malicious object keys detected' };
        }
      }
      
      // Limit JSON size
      const jsonString = JSON.stringify(input);
      if (jsonString.length > 100000) { // 100KB limit
        return { valid: false, error: 'JSON payload too large' };
      }
      
      return { valid: true, sanitized: input };
      
    } catch (error) {
      return { valid: false, error: 'JSON sanitization failed' };
    }
  }
  
  static validateDeviceId(deviceId: string): ValidationResult {
    // Only allow known device IDs
    const allowedDevices = ['pifive0', 'piiv', 'piiv2'];
    
    if (!allowedDevices.includes(deviceId)) {
      return { valid: false, error: `Invalid device ID: ${deviceId}` };
    }
    
    return { valid: true, sanitized: deviceId };
  }
  
  static validateTimeRange(timeRange: string): ValidationResult {
    // Only allow safe time range patterns
    const allowedPatterns = /^(1|2|3|6|12|24)h$|^(1|2|3|7|14|30)d$/;
    
    if (!allowedPatterns.test(timeRange)) {
      return { valid: false, error: 'Invalid time range format' };
    }
    
    return { valid: true, sanitized: timeRange };
  }
}

// Schema definitions for structured validation
export const QuerySchema = z.object({
  service: z.enum(['knowledge', 'documentation', 'terraform', 'cloudformation', 'core', 'edge', 'gcp', 'oracle-mirror', 'digitalocean']),
  query: z.string().min(1).max(5000),
  options: z.object({
    format: z.enum(['text', 'json', 'markdown']).optional(),
    maxResults: z.number().min(1).max(1000).optional(),
    category: z.string().max(100).optional(),
    deviceIds: z.array(z.string().max(20)).max(10).optional(),
    timeRange: z.string().regex(/^(1|2|3|6|12|24)h$|^(1|2|3|7|14|30)d$/).optional(),
    deviceId: z.string().max(20).optional(),
  }).optional(),
});

export const HealthCheckSchema = z.object({
  // Health checks don't require parameters but we validate the request structure
});

// Export validation middleware
export function createValidationMiddleware() {
  return {
    validateQuery: (data: any) => {
      try {
        const validated = QuerySchema.parse(data);
        return { valid: true, data: validated };
      } catch (error) {
        return { valid: false, error: error.message };
      }
    },
    
    validateHealthCheck: (data: any) => {
      try {
        const validated = HealthCheckSchema.parse(data);
        return { valid: true, data: validated };
      } catch (error) {
        return { valid: false, error: error.message };
      }
    }
  };
}