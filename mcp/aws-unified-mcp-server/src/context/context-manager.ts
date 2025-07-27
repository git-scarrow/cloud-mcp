// import { DynamoDBClient } from './dynamodb-client.js'; // Removed to fix circular dependency
type DynamoDBClient = any; // Type placeholder

export interface OptimizedContext {
  sessionId: string;
  userId?: string;
  toolSchemas: CompressedToolSchema[];
  frequentQueries: CachedQuery[];
  userPreferences: UserPreferences;
  lastAccessed: Date;
  contextVersion: string;
}

export interface CompressedToolSchema {
  name: string;
  description: string;
  // Compressed schema - only essential fields
  requiredParams: string[];
  optionalParams?: string[];
  examples?: string[];
  usageCount?: number;
  lastUsed?: Date;
}

export interface CachedQuery {
  queryPattern: string;
  response: string;
  hitCount: number;
  lastUsed: Date;
  relevanceScore: number;
}

export interface UserPreferences {
  preferredFormat: 'text' | 'json' | 'markdown';
  commonServices: string[];
  expertiseLevel: 'beginner' | 'intermediate' | 'expert';
  sessionTimeout: number;
}

export interface SessionContext {
  minimal: boolean;
  toolCount: number;
  contextSize: number;
  loadTimeMs: number;
}

export class ContextManager {
  private dynamodb: DynamoDBClient;
  private cache: Map<string, OptimizedContext> = new Map();
  private compressionEnabled: boolean;

  constructor(compressionEnabled = true) {
    this.dynamodb = null as any; // Placeholder for DynamoDBClient
    this.compressionEnabled = compressionEnabled;
  }

  /**
   * Load minimal context for fast session startup
   * Reduces cognitive load by providing only essential information
   */
  async loadMinimalContext(sessionId: string, userId?: string): Promise<OptimizedContext> {
    const startTime = Date.now();
    
    try {
      // Check in-memory cache first
      if (this.cache.has(sessionId)) {
        const cached = this.cache.get(sessionId)!;
        if (this.isContextValid(cached)) {
          return cached;
        }
      }

      // Load from DynamoDB cache
      let context = await this.dynamodb.getContext(sessionId);
      
      if (!context || this.isContextExpired(context)) {
        // Generate fresh minimal context
        context = await this.generateMinimalContext(sessionId, userId);
        await this.dynamodb.saveContext(context);
      }

      // Update in-memory cache
      this.cache.set(sessionId, context);
      
      const loadTime = Date.now() - startTime;
      await this.recordMetrics(sessionId, { 
        minimal: true, 
        toolCount: context.toolSchemas.length,
        contextSize: JSON.stringify(context).length,
        loadTimeMs: loadTime
      });

      return context;
    } catch (error) {
      console.error('Failed to load minimal context:', error);
      // Fallback to basic context
      return this.generateFallbackContext(sessionId, userId);
    }
  }

  /**
   * Generate optimized context with compressed tool schemas
   */
  private async generateMinimalContext(sessionId: string, userId?: string): Promise<OptimizedContext> {
    const userPrefs = userId ? await this.getUserPreferences(userId) : this.getDefaultPreferences();
    
    // Get most frequently used tools (top 10 for minimal context)
    const topTools = await this.getTopTools(userId, 10);
    
    // Get cached frequent queries
    const frequentQueries = await this.getFrequentQueries(userId, 5);

    return {
      sessionId,
      userId,
      toolSchemas: await this.compressToolSchemas(topTools),
      frequentQueries,
      userPreferences: userPrefs,
      lastAccessed: new Date(),
      contextVersion: '1.0',
    };
  }

  /**
   * Compress tool schemas to reduce token usage
   */
  private async compressToolSchemas(tools: any[]): Promise<CompressedToolSchema[]> {
    return tools.map(tool => ({
      name: tool.name,
      description: this.compressDescription(tool.description),
      requiredParams: this.extractRequiredParams(tool.inputSchema),
      optionalParams: this.extractOptionalParams(tool.inputSchema),
      examples: tool.examples?.slice(0, 2), // Limit to 2 examples
      usageCount: tool.usageCount || 0,
      lastUsed: tool.lastUsed ? new Date(tool.lastUsed) : undefined,
    }));
  }

  /**
   * Compress descriptions to essential information only
   */
  private compressDescription(description: string): string {
    if (!this.compressionEnabled) return description;
    
    // Remove verbose explanations, keep core functionality
    return description
      .split('.')[0] // Keep only first sentence
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // Limit to 100 chars
  }

  /**
   * Extract required parameters from JSON schema
   */
  private extractRequiredParams(schema: any): string[] {
    if (!schema?.properties) return [];
    
    const required = schema.required || [];
    return required.length > 5 ? required.slice(0, 5) : required; // Limit to 5 most important
  }

  /**
   * Extract optional parameters (limited for minimal context)
   */
  private extractOptionalParams(schema: any): string[] | undefined {
    if (!schema?.properties) return undefined;
    
    const required = new Set(schema.required || []);
    const optional = Object.keys(schema.properties).filter(key => !required.has(key));
    
    return optional.length > 3 ? optional.slice(0, 3) : optional; // Limit to 3 most useful
  }

  /**
   * Get user preferences with intelligent defaults
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const prefs = await this.dynamodb.getUserPreferences(userId);
      return prefs || this.getDefaultPreferences();
    } catch {
      return this.getDefaultPreferences();
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      preferredFormat: 'text',
      commonServices: ['knowledge', 'documentation'],
      expertiseLevel: 'intermediate',
      sessionTimeout: 3600, // 1 hour
    };
  }

  /**
   * Get most frequently used tools for this user
   */
  private async getTopTools(userId?: string, limit = 10): Promise<any[]> {
    // Default essential tools for minimal context
    const essentialTools = [
      {
        name: 'query_service',
        description: 'Query AWS services',
        inputSchema: {
          type: 'object',
          properties: { service: { type: 'string' }, query: { type: 'string' } },
          required: ['service', 'query']
        },
        usageCount: 100,
        examples: ['Query AWS knowledge', 'Search documentation']
      },
      {
        name: 'search_aws',
        description: 'Search AWS documentation',
        inputSchema: {
          type: 'object', 
          properties: { searchTerm: { type: 'string' } },
          required: ['searchTerm']
        },
        usageCount: 75
      },
      {
        name: 'generate_template',
        description: 'Generate IaC templates',
        inputSchema: {
          type: 'object',
          properties: { type: { type: 'string' }, resource: { type: 'string' } },
          required: ['type', 'resource']
        },
        usageCount: 50
      }
    ];

    if (userId) {
      // TODO: Get user-specific tool usage from DynamoDB
      // For now, return essential tools
    }

    return essentialTools.slice(0, limit);
  }

  /**
   * Get cached frequent queries to reduce repeated processing
   */
  private async getFrequentQueries(userId?: string, limit = 5): Promise<CachedQuery[]> {
    try {
      return await this.dynamodb.getFrequentQueries(userId, limit) || [];
    } catch {
      return [];
    }
  }

  /**
   * Check if context is still valid
   */
  private isContextValid(context: OptimizedContext): boolean {
    const maxAge = 3600000; // 1 hour in milliseconds
    return Date.now() - context.lastAccessed.getTime() < maxAge;
  }

  /**
   * Check if context is expired
   */
  private isContextExpired(context: OptimizedContext): boolean {
    return !this.isContextValid(context);
  }

  /**
   * Generate fallback context when AWS services are unavailable
   */
  private generateFallbackContext(sessionId: string, userId?: string): OptimizedContext {
    return {
      sessionId,
      userId,
      toolSchemas: [
        {
          name: 'query_service',
          description: 'Query AWS services',
          requiredParams: ['service', 'query'],
          usageCount: 1
        }
      ],
      frequentQueries: [],
      userPreferences: this.getDefaultPreferences(),
      lastAccessed: new Date(),
      contextVersion: '1.0-fallback',
    };
  }

  /**
   * Record performance metrics
   */
  private async recordMetrics(sessionId: string, metrics: SessionContext): Promise<void> {
    try {
      await this.dynamodb.recordMetrics(sessionId, metrics);
    } catch (error) {
      console.warn('Failed to record metrics:', error);
    }
  }

  /**
   * Update context with new usage patterns
   */
  async updateContext(sessionId: string, toolName: string, query: string, response: string): Promise<void> {
    const context = this.cache.get(sessionId);
    if (!context) return;

    // Update tool usage count
    const tool = context.toolSchemas.find(t => t.name === toolName);
    if (tool) {
      tool.usageCount = (tool.usageCount || 0) + 1;
      tool.lastUsed = new Date();
    }

    // Cache frequent query patterns
    const queryPattern = this.extractQueryPattern(query);
    const existingQuery = context.frequentQueries.find(q => q.queryPattern === queryPattern);
    
    if (existingQuery) {
      existingQuery.hitCount++;
      existingQuery.lastUsed = new Date();
    } else if (context.frequentQueries.length < 10) {
      context.frequentQueries.push({
        queryPattern,
        response: response.substring(0, 500), // Limit cached response size
        hitCount: 1,
        lastUsed: new Date(),
        relevanceScore: 1.0
      });
    }

    // Update cache and persist
    context.lastAccessed = new Date();
    this.cache.set(sessionId, context);
    await this.dynamodb.saveContext(context);
  }

  /**
   * Extract pattern from query for caching
   */
  private extractQueryPattern(query: string): string {
    // Simple pattern extraction - could be enhanced with NLP
    return query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .slice(0, 5) // First 5 words
      .join(' ');
  }

  /**
   * Clear expired contexts
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [sessionId, context] of this.cache.entries()) {
      if (now - context.lastAccessed.getTime() > 3600000) { // 1 hour
        this.cache.delete(sessionId);
      }
    }
  }
}