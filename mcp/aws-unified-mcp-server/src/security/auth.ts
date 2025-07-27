// Security Module - Authentication and Authorization
// Implements JWT-based authentication with API key fallback

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { IncomingMessage } from 'http';

interface AuthConfig {
  jwtSecret: string;
  apiKeys: Set<string>;
  allowedOrigins: string[];
  rateLimits: {
    windowMs: number;
    maxRequests: number;
  };
}

interface AuthResult {
  authenticated: boolean;
  userId?: string;
  permissions?: string[];
  error?: string;
}

export class SecurityManager {
  private config: AuthConfig;
  private rateLimitStore: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.config = {
      jwtSecret: process.env.JWT_SECRET || this.generateSecureSecret(),
      apiKeys: new Set([
        process.env.PIPEDREAM_API_KEY,
        process.env.MONITORING_API_KEY,
        process.env.ADMIN_API_KEY
      ].filter(Boolean)),
      allowedOrigins: [
        'https://api.pipedream.com',
        'https://pipedream.com',
        'https://macbookpro.dory-phrygian.ts.net'
      ],
      rateLimits: {
        windowMs: 60000, // 1 minute
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100')
      }
    };
    
    this.rateLimitStore = new Map();
    
    // Warn if using generated secret (not persistent)
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  Using generated JWT secret - tokens will be invalid after restart');
    }
    
    // Warn if no API keys configured
    if (this.config.apiKeys.size === 0) {
      console.warn('⚠️  No API keys configured - authentication disabled');
    }
  }

  private generateSecureSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  async authenticate(req: IncomingMessage): Promise<AuthResult> {
    try {
      // Check CORS
      const origin = req.headers.origin;
      if (origin && !this.config.allowedOrigins.includes(origin)) {
        return { authenticated: false, error: 'Origin not allowed' };
      }

      // Rate limiting (check after initial auth to get userId for granular limiting)
      const clientIp = this.getClientIp(req);
      const preliminaryAuth = this.checkPreliminaryAuth(req);
      
      if (!this.checkRateLimit(clientIp, preliminaryAuth.userId)) {
        return { authenticated: false, error: 'Rate limit exceeded' };
      }

      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return { authenticated: false, error: 'No authorization header' };
      }

      // Try JWT token first
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        return this.verifyJWT(token);
      }

      // Try API key
      if (authHeader.startsWith('ApiKey ')) {
        const apiKey = authHeader.substring(7);
        return this.verifyApiKey(apiKey);
      }

      return { authenticated: false, error: 'Invalid authorization format' };

    } catch (error) {
      console.error('Authentication error:', error);
      return { authenticated: false, error: 'Authentication failed' };
    }
  }

  private verifyJWT(token: string): AuthResult {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      return {
        authenticated: true,
        userId: decoded.sub,
        permissions: decoded.permissions || ['read']
      };
    } catch (error) {
      return { authenticated: false, error: 'Invalid JWT token' };
    }
  }

  private verifyApiKey(apiKey: string): AuthResult {
    if (this.config.apiKeys.has(apiKey)) {
      // Determine permissions based on API key
      const permissions = this.getApiKeyPermissions(apiKey);
      return {
        authenticated: true,
        userId: `apikey-${apiKey.substring(0, 8)}`,
        permissions
      };
    }
    return { authenticated: false, error: 'Invalid API key' };
  }

  private getApiKeyPermissions(apiKey: string): string[] {
    // Map API keys to permissions
    if (apiKey === process.env.ADMIN_API_KEY) {
      return ['read', 'write', 'admin'];
    }
    if (apiKey === process.env.PIPEDREAM_API_KEY) {
      return ['read', 'write:metrics'];
    }
    if (apiKey === process.env.MONITORING_API_KEY) {
      return ['read', 'health'];
    }
    return ['read']; // Default permissions
  }

  private checkRateLimit(clientIp: string, userId?: string): boolean {
    const now = Date.now();
    
    // Use API key for rate limiting if authenticated, otherwise fall back to IP
    const rateLimitKey = userId || clientIp;
    
    // Different limits for authenticated vs unauthenticated users
    const maxRequests = userId ? this.getApiKeyRateLimit(userId) : this.config.rateLimits.maxRequests;
    
    const limit = this.rateLimitStore.get(rateLimitKey);

    if (!limit || now > limit.resetTime) {
      // New window
      this.rateLimitStore.set(rateLimitKey, {
        count: 1,
        resetTime: now + this.config.rateLimits.windowMs
      });
      return true;
    }

    if (limit.count >= maxRequests) {
      return false; // Rate limit exceeded
    }

    limit.count++;
    return true;
  }
  
  private getApiKeyRateLimit(userId: string): number {
    // Higher limits for authenticated API keys
    if (userId.startsWith('apikey-')) {
      const apiKeyType = this.identifyApiKeyType(userId);
      switch (apiKeyType) {
        case 'admin': return 1000; // High limit for admin operations
        case 'pipedream': return 500; // Medium-high for workflow automation
        case 'monitoring': return 200; // Medium for monitoring tools
        default: return 100; // Default for other API keys
      }
    }
    
    // JWT token users get standard limit
    return this.config.rateLimits.maxRequests;
  }
  
  private identifyApiKeyType(userId: string): string {
    // Extract the API key from userId for type identification
    const keyPrefix = userId.substring(8); // Remove 'apikey-' prefix
    
    if (process.env.ADMIN_API_KEY?.startsWith(keyPrefix)) return 'admin';
    if (process.env.PIPEDREAM_API_KEY?.startsWith(keyPrefix)) return 'pipedream';
    if (process.env.MONITORING_API_KEY?.startsWith(keyPrefix)) return 'monitoring';
    
    return 'unknown';
  }

  private checkPreliminaryAuth(req: IncomingMessage): { userId?: string } {
    // Quick check to extract userId for rate limiting without full auth
    const authHeader = req.headers.authorization;
    if (!authHeader) return {};
    
    try {
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, this.config.jwtSecret) as any;
        return { userId: decoded.sub };
      }
      
      if (authHeader.startsWith('ApiKey ')) {
        const apiKey = authHeader.substring(7);
        if (this.config.apiKeys.has(apiKey)) {
          return { userId: `apikey-${apiKey.substring(0, 8)}` };
        }
      }
    } catch {
      // Ignore errors, will be caught in full auth
    }
    
    return {};
  }

  private getClientIp(req: IncomingMessage): string {
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

  generateJWT(userId: string, permissions: string[] = ['read']): string {
    return jwt.sign(
      {
        sub: userId,
        permissions,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      this.config.jwtSecret
    );
  }

  hasPermission(authResult: AuthResult, requiredPermission: string): boolean {
    if (!authResult.authenticated || !authResult.permissions) {
      return false;
    }

    // Admin permission grants all access
    if (authResult.permissions.includes('admin')) {
      return true;
    }

    return authResult.permissions.includes(requiredPermission);
  }

  // Public endpoints that don't require authentication
  isPublicEndpoint(path: string): boolean {
    const publicPaths = ['/health', '/', '/dashboard'];
    return publicPaths.includes(path) || path.startsWith('/api/dashboard');
  }

  // Clean up old rate limit entries
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, limit] of this.rateLimitStore.entries()) {
      if (now > limit.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

// Singleton instance
export const securityManager = new SecurityManager();

// Cleanup interval with tracking
export const securityManagerInterval = setInterval(() => {
  securityManager.cleanupRateLimits();
}, 60000); // Clean up every minute