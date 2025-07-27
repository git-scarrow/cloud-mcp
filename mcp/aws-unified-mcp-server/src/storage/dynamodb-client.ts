import { DynamoDBClient as AWSDynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand as DocQueryCommand } from '@aws-sdk/lib-dynamodb';
import { OptimizedContext, CachedQuery, UserPreferences, SessionContext } from '../context/context-manager.js';

export interface DynamoDBConfig {
  region?: string;
  endpoint?: string; // For local development
  tableName?: string;
}

export class DynamoDBClient {
  private client: DynamoDBDocumentClient;
  private contextTableName: string;
  private metricsTableName: string;
  private userPrefsTableName: string;
  private queryCacheTableName: string;

  constructor(config?: DynamoDBConfig) {
    const dynamoClient = new AWSDynamoDBClient({
      region: config?.region || process.env.AWS_REGION || 'us-east-1',
      endpoint: config?.endpoint,
    });
    
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    
    // Table names with prefix for organization
    const prefix = process.env.MCP_TABLE_PREFIX || 'mcp-cognitive-load';
    this.contextTableName = `${prefix}-contexts`;
    this.metricsTableName = `${prefix}-metrics`;
    this.userPrefsTableName = `${prefix}-user-prefs`;
    this.queryCacheTableName = `${prefix}-query-cache`;
  }

  /**
   * Save optimized context to DynamoDB with TTL
   */
  async saveContext(context: OptimizedContext): Promise<void> {
    try {
      const ttl = Math.floor(Date.now() / 1000) + (context.userPreferences.sessionTimeout || 3600);
      
      const item = {
        sessionId: context.sessionId,
        userId: context.userId || 'anonymous',
        contextData: JSON.stringify({
          toolSchemas: context.toolSchemas,
          frequentQueries: context.frequentQueries,
          userPreferences: context.userPreferences,
          contextVersion: context.contextVersion,
        }),
        lastAccessed: context.lastAccessed.toISOString(),
        ttl,
        createdAt: new Date().toISOString(),
      };

      await this.client.send(new PutCommand({
        TableName: this.contextTableName,
        Item: item,
      }));
    } catch (error) {
      console.error('Failed to save context:', error);
      throw new Error(`Context save failed: ${error.message}`);
    }
  }

  /**
   * Retrieve optimized context from DynamoDB
   */
  async getContext(sessionId: string): Promise<OptimizedContext | null> {
    try {
      const response = await this.client.send(new GetCommand({
        TableName: this.contextTableName,
        Key: { sessionId },
      }));

      if (!response.Item) {
        return null;
      }

      const contextData = JSON.parse(response.Item.contextData);
      
      return {
        sessionId: response.Item.sessionId,
        userId: response.Item.userId !== 'anonymous' ? response.Item.userId : undefined,
        toolSchemas: contextData.toolSchemas,
        frequentQueries: contextData.frequentQueries,
        userPreferences: contextData.userPreferences,
        lastAccessed: new Date(response.Item.lastAccessed),
        contextVersion: contextData.contextVersion,
      };
    } catch (error) {
      console.error('Failed to get context:', error);
      return null;
    }
  }

  /**
   * Save user preferences
   */
  async saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      await this.client.send(new PutCommand({
        TableName: this.userPrefsTableName,
        Item: {
          userId,
          preferences: JSON.stringify(preferences),
          updatedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 3600), // 30 days
        },
      }));
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const response = await this.client.send(new GetCommand({
        TableName: this.userPrefsTableName,
        Key: { userId },
      }));

      if (!response.Item) {
        return null;
      }

      return JSON.parse(response.Item.preferences);
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  /**
   * Record performance metrics
   */
  async recordMetrics(sessionId: string, metrics: SessionContext): Promise<void> {
    try {
      await this.client.send(new PutCommand({
        TableName: this.metricsTableName,
        Item: {
          sessionId,
          timestamp: new Date().toISOString(),
          minimal: metrics.minimal,
          toolCount: metrics.toolCount,
          contextSize: metrics.contextSize,
          loadTimeMs: metrics.loadTimeMs,
          ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 3600), // 7 days retention
        },
      }));
    } catch (error) {
      console.warn('Failed to record metrics:', error);
      // Don't throw - metrics are non-critical
    }
  }

  /**
   * Get frequent queries for caching
   */
  async getFrequentQueries(userId?: string, limit = 10): Promise<CachedQuery[]> {
    try {
      const keyCondition = userId ? 
        { userId } : 
        { userId: 'global' }; // Global cache for anonymous users

      const response = await this.client.send(new DocQueryCommand({
        TableName: this.queryCacheTableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId || 'global',
        },
        ScanIndexForward: false, // Sort by sort key descending
        Limit: limit,
      }));

      return response.Items?.map(item => ({
        queryPattern: item.queryPattern,
        response: item.response,
        hitCount: item.hitCount,
        lastUsed: new Date(item.lastUsed),
        relevanceScore: item.relevanceScore,
      })) || [];
    } catch (error) {
      console.error('Failed to get frequent queries:', error);
      return [];
    }
  }

  /**
   * Cache frequent query
   */
  async cacheQuery(userId: string | undefined, queryPattern: string, response: string, hitCount = 1): Promise<void> {
    try {
      const key = userId || 'global';
      
      await this.client.send(new UpdateCommand({
        TableName: this.queryCacheTableName,
        Key: {
          userId: key,
          queryPattern,
        },
        UpdateExpression: 'SET #response = :response, hitCount = if_not_exists(hitCount, :zero) + :inc, lastUsed = :now, relevanceScore = :score, ttl = :ttl',
        ExpressionAttributeNames: {
          '#response': 'response',
        },
        ExpressionAttributeValues: {
          ':response': response.substring(0, 1000), // Limit response size
          ':zero': 0,
          ':inc': 1,
          ':now': new Date().toISOString(),
          ':score': this.calculateRelevanceScore(hitCount),
          ':ttl': Math.floor(Date.now() / 1000) + (14 * 24 * 3600), // 14 days
        },
      }));
    } catch (error) {
      console.error('Failed to cache query:', error);
      // Don't throw - caching is non-critical
    }
  }

  /**
   * Get tool usage statistics
   */
  async getToolUsageStats(userId?: string): Promise<Record<string, number>> {
    try {
      // Query from metrics table to get tool usage patterns
      const response = await this.client.send(new DocQueryCommand({
        TableName: this.metricsTableName,
        FilterExpression: 'attribute_exists(toolName)',
        ProjectionExpression: 'toolName',
        Limit: 100,
      }));

      const stats: Record<string, number> = {};
      response.Items?.forEach(item => {
        if (item.toolName) {
          stats[item.toolName] = (stats[item.toolName] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to get tool usage stats:', error);
      return {};
    }
  }

  /**
   * Get performance metrics for optimization
   */
  async getPerformanceMetrics(timeRangeHours = 24): Promise<any> {
    try {
      const startTime = new Date(Date.now() - (timeRangeHours * 60 * 60 * 1000)).toISOString();
      
      const response = await this.client.send(new DocQueryCommand({
        TableName: this.metricsTableName,
        FilterExpression: '#timestamp > :startTime',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':startTime': startTime,
        },
        Limit: 1000,
      }));

      const metrics = response.Items || [];
      
      return {
        totalSessions: metrics.length,
        averageLoadTime: this.calculateAverage(metrics, 'loadTimeMs'),
        averageContextSize: this.calculateAverage(metrics, 'contextSize'),
        averageToolCount: this.calculateAverage(metrics, 'toolCount'),
        minimalContextUsage: metrics.filter(m => m.minimal).length / metrics.length,
      };
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return null;
    }
  }

  /**
   * Batch save contexts for efficiency
   */
  async batchSaveContexts(contexts: OptimizedContext[]): Promise<void> {
    // TODO: Implement batch write for efficiency
    // For now, save individually
    for (const context of contexts) {
      await this.saveContext(context);
    }
  }

  /**
   * Clean up expired data (called by maintenance Lambda)
   */
  async cleanup(): Promise<{ deletedItems: number }> {
    let deletedItems = 0;
    
    try {
      // DynamoDB TTL will automatically clean up expired items
      // This method can be enhanced for manual cleanup if needed
      console.log('Cleanup completed - TTL handles automatic expiration');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }

    return { deletedItems };
  }

  /**
   * Health check - verify DynamoDB connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple connectivity test
      await this.client.send(new GetCommand({
        TableName: this.contextTableName,
        Key: { sessionId: 'health-check' },
      }));
      return true;
    } catch (error) {
      console.error('DynamoDB health check failed:', error);
      return false;
    }
  }

  // Helper methods

  private calculateRelevanceScore(hitCount: number): number {
    // Simple relevance scoring - could be enhanced
    return Math.min(hitCount / 10, 1.0);
  }

  private calculateAverage(items: any[], field: string): number {
    if (!items.length) return 0;
    const sum = items.reduce((acc, item) => acc + (item[field] || 0), 0);
    return sum / items.length;
  }

  /**
   * Save session state to DynamoDB
   */
  async saveSessionState(session: any): Promise<void> {
    try {
      const sessionTableName = `${process.env.MCP_TABLE_PREFIX || 'mcp-cognitive-load'}-sessions`;
      const ttl = Math.floor(Date.now() / 1000) + (24 * 3600); // 24 hours
      
      await this.client.send(new PutCommand({
        TableName: sessionTableName,
        Item: {
          sessionId: session.sessionId,
          userId: session.userId || 'anonymous',
          sessionData: JSON.stringify({
            conversationContext: session.conversationContext,
            learnedBehaviors: session.learnedBehaviors,
            workingMemory: session.workingMemory,
            preferences: session.preferences,
          }),
          metadata: JSON.stringify(session.metadata),
          lastAccessed: session.metadata.lastAccessed.toISOString(),
          ttl,
        },
      }));
    } catch (error) {
      console.error('Failed to save session state:', error);
      throw error;
    }
  }

  /**
   * Get session state from DynamoDB
   */
  async getSessionState(sessionId: string): Promise<any | null> {
    try {
      const sessionTableName = `${process.env.MCP_TABLE_PREFIX || 'mcp-cognitive-load'}-sessions`;
      
      const response = await this.client.send(new GetCommand({
        TableName: sessionTableName,
        Key: { sessionId },
      }));

      if (!response.Item) {
        return null;
      }

      const sessionData = JSON.parse(response.Item.sessionData);
      const metadata = JSON.parse(response.Item.metadata);

      return {
        sessionId: response.Item.sessionId,
        userId: response.Item.userId !== 'anonymous' ? response.Item.userId : undefined,
        conversationContext: sessionData.conversationContext,
        learnedBehaviors: sessionData.learnedBehaviors,
        workingMemory: sessionData.workingMemory,
        preferences: sessionData.preferences,
        metadata: {
          ...metadata,
          createdAt: new Date(metadata.createdAt),
          lastAccessed: new Date(metadata.lastAccessed),
        },
      };
    } catch (error) {
      console.error('Failed to get session state:', error);
      return null;
    }
  }

  /**
   * Update session last accessed time
   */
  async updateSessionLastAccessed(sessionId: string): Promise<void> {
    try {
      const sessionTableName = `${process.env.MCP_TABLE_PREFIX || 'mcp-cognitive-load'}-sessions`;
      
      await this.client.send(new UpdateCommand({
        TableName: sessionTableName,
        Key: { sessionId },
        UpdateExpression: 'SET lastAccessed = :now, ttl = :ttl',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
          ':ttl': Math.floor(Date.now() / 1000) + (24 * 3600), // Extend TTL
        },
      }));
    } catch (error) {
      console.warn('Failed to update session last accessed:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Save knowledge entry to DynamoDB
   */
  async saveKnowledgeEntry(entry: any): Promise<void> {
    try {
      const knowledgeTableName = `${process.env.MCP_TABLE_PREFIX || 'mcp-cognitive-load'}-knowledge`;
      
      await this.client.send(new PutCommand({
        TableName: knowledgeTableName,
        Item: {
          id: entry.id,
          category: entry.category,
          service: entry.service,
          title: entry.title,
          content: entry.content,
          tags: entry.tags,
          searchTerms: entry.searchTerms,
          priority: entry.priority,
          lastUpdated: entry.lastUpdated.toISOString(),
          usageCount: entry.usageCount,
          relevanceScore: entry.relevanceScore,
          ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 3600), // 30 days
        },
      }));
    } catch (error) {
      console.error('Failed to save knowledge entry:', error);
      throw error;
    }
  }

  /**
   * Initialize tables if they don't exist (for local development)
   */
  async initializeTables(): Promise<void> {
    // This would typically be handled by CloudFormation in production
    console.log('Table initialization should be handled by CloudFormation');
  }
}