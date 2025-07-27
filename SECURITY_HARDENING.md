# Security Hardening - AWS Unified MCP Server

## 🔒 Security Implementation Complete

The AWS Unified MCP Server has been fully hardened with enterprise-grade security features to protect against common attack vectors and ensure safe production deployment.

## Security Features Implemented

### 1. **Authentication & Authorization** ✅

#### JWT Token Support
```javascript
// Generate JWT token
const token = securityManager.generateJWT(userId, ['read', 'write']);

// Use in requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### API Key Authentication
```javascript
// Pipedream workflow authentication
headers: {
  'Authorization': `ApiKey ${CONFIG.PIPEDREAM_API_KEY}`,
  'User-Agent': 'Pipedream-Cost-Optimizer/1.0'
}
```

#### Permission Levels
- **read**: Basic query access
- **write**: Data modification (metrics, anomalies)
- **write:metrics**: Restricted to metrics tables only
- **health**: Health check access only
- **admin**: Full administrative access

### 2. **Input Validation & SQL Injection Prevention** ✅

#### Allowed SQL Patterns
```sql
-- READ operations (allowed)
SELECT columns FROM CLOUD_COMPARE.table_name

-- WRITE operations (restricted to specific tables)
INSERT INTO CLOUD_COMPARE.COST_DAILY_METRICS (...)
INSERT INTO CLOUD_COMPARE.COST_ANOMALIES (...)
INSERT INTO CLOUD_COMPARE.WORKFLOW_EXECUTIONS (...)

-- UPDATE operations (very limited)
UPDATE CLOUD_COMPARE.COST_ANOMALIES SET resolved_at = ...
```

#### Blocked Dangerous Patterns
```sql
-- These patterns are automatically blocked:
DROP, DELETE, TRUNCATE, ALTER, CREATE, GRANT, REVOKE
EXEC, EXECUTE, xp_, sp_, --, /*, UNION SELECT
INFORMATION_SCHEMA, USER_TABLES, ALL_TABLES
```

#### Query Size Limits
- SQL queries: 10,000 characters maximum
- MCP queries: 5,000 characters maximum
- JSON payloads: 100KB maximum
- Automatic ROWNUM limitation (1,000 rows max)

### 3. **Rate Limiting & DDoS Protection** ✅

#### Rate Limits
```javascript
// Default configuration
rateLimits: {
  windowMs: 60000,      // 1 minute window
  maxRequests: 100      // 100 requests per minute per IP
}

// Configurable via environment
RATE_LIMIT_MAX=100
```

#### IP-Based Tracking
- Tracks requests per client IP
- Handles proxy headers (X-Forwarded-For, X-Real-IP)
- Automatic cleanup of expired rate limit entries
- Escalating restrictions for repeat offenders

### 4. **Audit Logging & Monitoring** ✅

#### Security Event Logging
```javascript
// Critical events automatically logged
await auditLogger.logSQLInjectionAttempt(clientIp, query);
await auditLogger.logAuthFailure(clientIp, endpoint, error);
await auditLogger.logRateLimit(clientIp, endpoint);
```

#### Log Files
- **Security Log**: `/var/log/mcp-server/security.log`
- **Access Log**: `/var/log/mcp-server/access.log`
- **Automatic Rotation**: When files exceed 10MB
- **Retention**: Configurable (default: unlimited)

#### Alert Thresholds
- **5** auth failures per 5 minutes → Alert
- **3** rate limit hits per 5 minutes → Alert  
- **1** SQL injection attempt → Critical Alert
- **10** invalid queries per 5 minutes → Alert

### 5. **CORS & Security Headers** ✅

#### Restrictive CORS Policy
```javascript
// Only allow specific origins
const allowedOrigins = [
  'https://api.pipedream.com',
  'https://pipedream.com'
];
```

#### Security Headers
```javascript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
```

### 6. **Public Endpoint Protection** ✅

#### Health Check Security
- User-Agent validation (blocks bots/crawlers)
- IP-based access control
- Suspicious pattern detection
- Rate limiting applies

#### Public Endpoints
- `/health` - Monitoring access only
- `/` - Landing page (minimal info exposure)

## Configuration

### Environment Variables
```bash
# Authentication
JWT_SECRET=your_jwt_secret_here_64_characters_minimum_for_production_use
PIPEDREAM_API_KEY=your_pipedream_api_key_here
MONITORING_API_KEY=your_monitoring_api_key_here  
ADMIN_API_KEY=your_admin_api_key_here

# Rate Limiting
RATE_LIMIT_MAX=100

# Logging
LOG_DIR=/var/log/mcp-server
```

### Pipedream Integration
```javascript
// Secure MCP calls from Pipedream
const response = await fetch(`${CONFIG.MCP_URL}/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `ApiKey ${CONFIG.PIPEDREAM_API_KEY}`,
    'User-Agent': 'Pipedream-Cost-Optimizer/1.0'
  },
  body: JSON.stringify({
    service: 'oracle-mirror',
    query: 'SELECT COUNT(*) FROM CLOUD_COMPARE.COST_DAILY_METRICS'
  })
});
```

## Security Monitoring

### Real-Time Alerts

#### Critical Events (Immediate Alert)
- SQL injection attempts
- Brute force authentication attacks
- Suspicious user agent patterns
- Malformed request floods

#### Warning Events (5-minute threshold)
- Multiple authentication failures
- Rate limit violations
- Invalid query patterns
- Blocked dangerous SQL attempts

### Security Metrics Dashboard
```bash
# Get security metrics (last 24 hours)
curl -H "Authorization: ApiKey $ADMIN_API_KEY" \
     https://macbookpro.dory-phrygian.ts.net/security/metrics
```

Response:
```json
{
  "totalEvents": 45,
  "eventTypes": {
    "auth_success": 40,
    "auth_failure": 3,
    "rate_limit": 2
  },
  "severityBreakdown": {
    "low": 35,
    "medium": 8,
    "high": 2,
    "critical": 0
  },
  "alertsTriggered": 2
}
```

## Testing Security

### Authentication Tests
```bash
# Test without authentication (should fail)
curl https://macbookpro.dory-phrygian.ts.net/query
# Expected: 401 Unauthorized

# Test with valid API key
curl -H "Authorization: ApiKey $PIPEDREAM_API_KEY" \
     https://macbookpro.dory-phrygian.ts.net/health
# Expected: 200 OK
```

### SQL Injection Tests
```bash
# These should be blocked and logged as security events
curl -X POST https://macbookpro.dory-phrygian.ts.net/query \
  -H "Authorization: ApiKey $ADMIN_API_KEY" \
  -d '{"service": "oracle-mirror", "query": "SELECT * FROM users; DROP TABLE users;"}'

curl -X POST https://macbookpro.dory-phrygian.ts.net/query \
  -H "Authorization: ApiKey $ADMIN_API_KEY" \
  -d '{"service": "oracle-mirror", "query": "SELECT * FROM INFORMATION_SCHEMA.TABLES"}'
```

### Rate Limiting Tests
```bash
# Rapid fire requests (should trigger rate limiting)
for i in {1..150}; do
  curl https://macbookpro.dory-phrygian.ts.net/health &
done
wait
```

## Security Best Practices Applied

### ✅ Defense in Depth
- Multiple layers of validation
- Authentication + Authorization + Input validation
- Rate limiting + Audit logging + Monitoring

### ✅ Principle of Least Privilege
- API keys have specific permission scopes
- Oracle queries restricted to CLOUD_COMPARE schema only
- Public endpoints minimal and monitored

### ✅ Fail Secure
- Default deny for authentication
- Fallback to safe defaults on validation failures
- Graceful degradation under attack

### ✅ Security by Design
- Input validation at all entry points
- Comprehensive audit logging
- Proactive threat detection

## Production Readiness Checklist

- [x] JWT authentication implemented
- [x] API key management configured
- [x] SQL injection prevention active
- [x] Rate limiting enabled
- [x] Audit logging operational
- [x] Security headers configured
- [x] CORS policy restrictive
- [x] Error handling secure
- [x] Monitoring alerts configured
- [x] Log rotation implemented

## Compliance & Governance

### Data Protection
- No sensitive data logged in plaintext
- SQL queries truncated in security logs
- Authentication tokens never logged
- PII handling compliant

### Audit Trail
- Complete access logging
- Security event classification
- Tamper-evident log storage
- 90-day retention minimum

### Incident Response
- Automated threat detection
- Real-time security alerts
- Escalation procedures defined
- Forensic data preservation

The MCP server is now production-ready with enterprise-grade security suitable for handling sensitive cost optimization data while maintaining the $15/month budget constraint.