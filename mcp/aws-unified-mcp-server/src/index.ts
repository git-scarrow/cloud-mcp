#!/usr/bin/env node
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import http, { IncomingMessage } from 'http';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import query handlers
import { AWSKnowledgeQuery } from './queries/aws-knowledge.js';
import { AWSDocumentationQuery } from './queries/aws-documentation.js';
import { TerraformQuery } from './queries/terraform.js';
import { CloudFormationQuery } from './queries/cloudformation.js';
import { CoreMCPQuery } from './queries/core-mcp.js';
import { EdgeQuery } from './queries/edge-query.js';
import { GCPQuery } from './queries/gcp-query.js';
import { OracleMirrorQuery } from './queries/oracle-mirror-query.js';
import { DigitalOceanQuery } from './queries/digitalocean-query.js';
import { HealthChecker } from './health-check.js';
import { securityManager, securityManagerInterval } from './security/auth.js';
import { InputValidator } from './security/input-validation.js';
import { auditLogger, auditLoggerInterval } from './security/audit-logger.js';
import { initializeSecrets } from './security/secrets-manager.js';
import { dashboardAPI } from './monitoring/dashboard-api.js';

// Define the server
const server = new Server(
  {
    name: 'aws-unified-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool schemas
const QuerySchema = z.object({
  service: z.enum(['knowledge', 'documentation', 'terraform', 'cloudformation', 'core', 'edge', 'gcp', 'oracle-mirror', 'digitalocean']),
  query: z.string(),
  options: z.object({
    format: z.enum(['text', 'json', 'markdown']).optional(),
    maxResults: z.number().optional(),
    category: z.string().optional(),
    deviceIds: z.array(z.string()).optional(),
    timeRange: z.string().optional(),
    deviceId: z.string().optional(),
  }).optional(),
});

const UnifiedQuerySchema = z.object({
  query: z.string(),
  services: z.array(z.enum(['knowledge', 'documentation', 'terraform', 'cloudformation', 'core', 'edge', 'gcp', 'oracle-mirror', 'digitalocean'])).optional(),
  options: z.object({
    format: z.enum(['text', 'json', 'markdown']).optional(),
    maxResults: z.number().optional(),
    deviceIds: z.array(z.string()).optional(),
    timeRange: z.string().optional(),
  }).optional(),
});

// Initialize query handlers
const queryHandlers = {
  knowledge: new AWSKnowledgeQuery(),
  documentation: new AWSDocumentationQuery(),
  terraform: new TerraformQuery(),
  cloudformation: new CloudFormationQuery(),
  core: new CoreMCPQuery(),
  edge: new EdgeQuery(),
  gcp: new GCPQuery(),
  'oracle-mirror': new OracleMirrorQuery(),
  digitalocean: new DigitalOceanQuery(),
};

// Initialize health checker
const healthChecker = new HealthChecker();

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'query_service',
        description: 'Query a specific AWS zero-cost service',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              enum: ['knowledge', 'documentation', 'terraform', 'cloudformation', 'core', 'edge', 'gcp', 'oracle-mirror', 'digitalocean'],
              description: 'The service to query',
            },
            query: {
              type: 'string',
              description: 'The query to execute',
            },
            options: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['text', 'json', 'markdown'],
                  description: 'Output format',
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results',
                },
                category: {
                  type: 'string',
                  description: 'Category filter for documentation queries',
                },
                deviceIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Edge device IDs to filter by',
                },
                timeRange: {
                  type: 'string',
                  description: 'Time range for metrics (e.g., 1h, 24h, 7d)',
                },
                deviceId: {
                  type: 'string',
                  description: 'Specific edge device ID',
                },
              },
            },
          },
          required: ['service', 'query'],
        },
      },
      {
        name: 'unified_query',
        description: 'Query multiple AWS services simultaneously',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The query to execute across services',
            },
            services: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['knowledge', 'documentation', 'terraform', 'cloudformation', 'core', 'edge', 'gcp', 'oracle-mirror', 'digitalocean'],
              },
              description: 'Services to query (defaults to all)',
            },
            options: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['text', 'json', 'markdown'],
                  description: 'Output format',
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum results per service',
                },
                deviceIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Edge device IDs to filter by',
                },
                timeRange: {
                  type: 'string',
                  description: 'Time range for edge metrics',
                },
              },
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_aws',
        description: 'Search across all AWS documentation and knowledge bases',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Term to search for',
            },
            filters: {
              type: 'object',
              properties: {
                service: {
                  type: 'string',
                  description: 'Filter by AWS service (e.g., S3, Lambda, EC2)',
                },
                type: {
                  type: 'string',
                  enum: ['api', 'guide', 'tutorial', 'reference', 'best-practices'],
                  description: 'Type of documentation',
                },
              },
            },
          },
          required: ['searchTerm'],
        },
      },
      {
        name: 'generate_template',
        description: 'Generate infrastructure as code templates',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['terraform', 'cloudformation'],
              description: 'Template type to generate',
            },
            resource: {
              type: 'string',
              description: 'AWS resource to create (e.g., S3 bucket, Lambda function)',
            },
            options: {
              type: 'object',
              description: 'Resource-specific options',
            },
          },
          required: ['type', 'resource'],
        },
      },
      {
        name: 'validate_template',
        description: 'Validate CloudFormation or Terraform templates',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['terraform', 'cloudformation'],
              description: 'Template type',
            },
            template: {
              type: 'string',
              description: 'Template content to validate',
            },
          },
          required: ['type', 'template'],
        },
      },
      {
        name: 'health_check',
        description: 'Get comprehensive health status of the MCP server and all components',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'query_service': {
        const validatedArgs = QuerySchema.parse(args);
        
        // Security validation for MCP queries
        const queryValidation = InputValidator.validateMCPQuery(
          validatedArgs.service, 
          validatedArgs.query, 
          validatedArgs.options
        );
        
        if (!queryValidation.valid) {
          // Log potential security issue
          if (queryValidation.error?.includes('SQL')) {
            await auditLogger.logSQLInjectionAttempt('mcp-client', validatedArgs.query);
          }
          
          throw new McpError(
            ErrorCode.InvalidParams,
            `Query validation failed: ${queryValidation.error}`
          );
        }
        
        const handler = queryHandlers[validatedArgs.service];
        if (!handler) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown service: ${validatedArgs.service}`
          );
        }
        
        try {
          // Use sanitized query
          const result = await handler.query(queryValidation.sanitized, validatedArgs.options);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          console.error(`Error in ${validatedArgs.service} query:`, error);
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                error: `${validatedArgs.service} query failed`,
                details: error instanceof Error ? error.message : 'Unknown error',
                query: validatedArgs.query
              }, null, 2)
            }] 
          };
        }
      }

      case 'unified_query': {
        const validatedArgs = UnifiedQuerySchema.parse(args);
        const services = validatedArgs.services || ['knowledge', 'documentation', 'terraform', 'cloudformation', 'core', 'edge', 'gcp', 'oracle-mirror', 'digitalocean'];
        const results = await Promise.all(
          services.map(async (service) => {
            const handler = queryHandlers[service];
            if (!handler) {
              return { service, result: `Service ${service} not found` };
            }
            try {
              const result = await handler.query(validatedArgs.query, validatedArgs.options);
              return { service, result };
            } catch (error) {
              console.error(`Error in ${service} query:`, error);
              return { 
                service, 
                result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
              };
            }
          })
        );
        
        const formattedResults = results
          .map(({ service, result }) => `## ${service.toUpperCase()}\n${result}`)
          .join('\n\n---\n\n');
        
        return { content: [{ type: 'text', text: formattedResults }] };
      }

      case 'search_aws': {
        const { searchTerm, filters } = args as any;
        const knowledgeResults = await queryHandlers.knowledge.search(searchTerm, filters);
        const docResults = await queryHandlers.documentation.search(searchTerm, filters);
        
        const combined = `# AWS Search Results for "${searchTerm}"\n\n## Knowledge Base\n${knowledgeResults}\n\n## Documentation\n${docResults}`;
        return { content: [{ type: 'text', text: combined }] };
      }

      case 'generate_template': {
        const { type, resource, options } = args as any;
        const handler = type === 'terraform' ? queryHandlers.terraform : queryHandlers.cloudformation;
        const template = await handler.generateTemplate(resource, options);
        return { content: [{ type: 'text', text: template }] };
      }

      case 'validate_template': {
        const { type, template } = args as any;
        const handler = type === 'terraform' ? queryHandlers.terraform : queryHandlers.cloudformation;
        const validation = await handler.validateTemplate(template);
        return { content: [{ type: 'text', text: validation }] };
      }

      case 'health_check': {
        const healthStatus = await healthChecker.checkHealth();
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify(healthStatus, null, 2)
          }] 
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`
      );
    }
    throw error;
  }
});

// HTTP server for health checks and monitoring
function createHttpServer() {
  return http.createServer(async (req, res) => {
    const startTime = Date.now();
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'];
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // CORS headers (restrictive)
    const allowedOrigins = ['https://api.pipedream.com', 'https://pipedream.com'];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let responseStatus = 200;
    let authResult: { authenticated: boolean; userId?: string; error?: string } = { authenticated: false };
    
    try {
      // Try to handle dashboard API requests first
      if (await dashboardAPI.handleDashboardAPI(req, res, url.pathname)) {
        return; // Request was handled by dashboard API
      }

      // Authentication check (except for public endpoints)
      if (!securityManager.isPublicEndpoint(url.pathname)) {
        authResult = await securityManager.authenticate(req);
        
        if (!authResult.authenticated) {
          responseStatus = 401;
          await auditLogger.logAuthFailure(clientIp, url.pathname, authResult.error || 'Authentication failed', userAgent);
          
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Authentication required' }));
          return;
        }
      }

      switch (url.pathname) {
        case '/health':
          // Validate health check access
          const healthValidation = InputValidator.validateHealthCheckAccess(clientIp, userAgent);
          if (!healthValidation.valid) {
            responseStatus = 403;
            await auditLogger.logSecurityEvent({
              timestamp: new Date().toISOString(),
              eventType: 'access_denied',
              clientIp,
              endpoint: '/health',
              userAgent,
              error: healthValidation.error,
              severity: 'medium'
            });
            
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Access denied' }));
            break;
          }
          
          try {
            const healthStatus = await healthChecker.checkHealth();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(healthStatus, null, 2));
          } catch (error) {
            console.error('Health check failed:', error);
            responseStatus = 500;
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'unhealthy',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case '/dashboard':
          // Serve security monitoring dashboard  
          try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const dashboardPath = path.join(process.cwd(), 'src', 'monitoring', 'dashboard.html');
            const dashboardContent = await fs.readFile(dashboardPath, 'utf-8');
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(dashboardContent);
          } catch (error) {
            console.error('Dashboard load failed:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Dashboard temporarily unavailable');
          }
          break;
        
      case '/':
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>AWS Unified MCP Server</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .status { padding: 20px; border-radius: 8px; margin: 20px 0; }
              .healthy { background-color: #d4edda; color: #155724; }
              .degraded { background-color: #fff3cd; color: #856404; }
              .unhealthy { background-color: #f8d7da; color: #721c24; }
              pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
            </style>
          </head>
          <body>
            <h1>AWS Unified MCP Server</h1>
            <p>Server is running and ready to handle MCP requests.</p>
            <h2>Available Endpoints:</h2>
            <ul>
              <li><a href="/health">/health</a> - Health check status</li>
              <li><a href="/dashboard">/dashboard</a> - Security monitoring dashboard</li>
              <li><a href="/mcp">/mcp</a> - MCP Server-Sent Events endpoint</li>
            </ul>
            <h2>Services:</h2>
            <ul>
              <li>AWS Knowledge Base</li>
              <li>AWS Documentation</li>
              <li>Terraform Templates</li>
              <li>CloudFormation Templates</li>
              <li>Core MCP Tools</li>
              <li>Edge Device Management</li>
              <li>GCP Integration</li>
              <li>Oracle Mirror</li>
              <li>DigitalOcean Integration</li>
            </ul>
          </body>
          </html>
        `);
        break;
        
      case '/mcp':
        // Handle MCP over HTTP using Server-Sent Events
        const transport = new SSEServerTransport('/mcp', res);
        await server.connect(transport);
        break;
        
        default:
          responseStatus = 404;
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          break;
      }
      
    } catch (error) {
      console.error('HTTP server error:', error);
      responseStatus = 500;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    } finally {
      // Log all requests and record metrics
      const responseTime = Date.now() - startTime;
      
      // Record metrics for dashboard
      dashboardAPI.recordRequest(url.pathname, responseTime);
      
      await auditLogger.logAccess({
        timestamp: new Date().toISOString(),
        clientIp,
        method: req.method || 'GET',
        endpoint: url.pathname,
        userAgent,
        userId: authResult.userId,
        responseStatus,
        responseTime,
        queryType: url.pathname.includes('query') ? 'mcp' : 'http'
      });
    }
  });
}

function getClientIp(req: IncomingMessage): string {
  // Handle various proxy headers
  const forwarded = req.headers['x-forwarded-for'] as string;
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) {
    return realIp;
  }
  
  return req.socket.remoteAddress || 'unknown';
}

// Start the server
async function main() {
  // Initialize secrets management first
  try {
    await initializeSecrets();
  } catch (error) {
    console.error('Failed to initialize secrets, continuing with environment variables');
  }
  
  // Check if we should run in HTTP mode
  const httpPort = process.env.MCP_HTTP_PORT || process.env.PORT;
  
  if (httpPort) {
    // HTTP mode for cloud deployment
    const httpServer = createHttpServer();
    httpServer.listen(parseInt(httpPort), () => {
      console.error(`AWS Unified MCP Server running on HTTP port ${httpPort}`);
      console.error(`Health endpoint: http://localhost:${httpPort}/health`);
      console.error(`MCP endpoint: http://localhost:${httpPort}/mcp`);
    });
  } else {
    // Standard stdio mode for local MCP
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('AWS Unified MCP Server running on stdio');
  }
}

// Enhanced graceful shutdown
async function gracefulShutdown() {
  console.error('🛑 Shutting down server...');
  try {
    // Clear all specific intervals to prevent memory leaks
    clearInterval(securityManagerInterval);
    clearInterval(auditLoggerInterval);
    console.error('✅ Cleared security and audit intervals');
    
    // Cleanup dashboard API
    dashboardAPI.cleanup();
    console.error('✅ Dashboard API cleanup complete');
    
    // Cleanup Oracle Mirror connection pool
    if (queryHandlers['oracle-mirror'] && typeof queryHandlers['oracle-mirror'].cleanup === 'function') {
      await queryHandlers['oracle-mirror'].cleanup();
      console.error('✅ Oracle Mirror cleanup complete');
    }
    
    // Cleanup Edge Query SSH processes
    if (queryHandlers['edge'] && typeof queryHandlers['edge'].cleanup === 'function') {
      await queryHandlers['edge'].cleanup();
      console.error('✅ Edge Query cleanup complete');
    }
    
    // Force final garbage collection if available
    if (global.gc) {
      global.gc();
      console.error('✅ Final garbage collection performed');
    }
    
    console.error('🎯 Graceful shutdown complete');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});