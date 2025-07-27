import { DynamoDBClient } from '../storage/dynamodb-client.js';

export interface SessionState {
  sessionId: string;
  userId?: string;
  conversationContext: ConversationContext;
  learnedBehaviors: LearnedBehavior[];
  workingMemory: WorkingMemory;
  preferences: SessionPreferences;
  metadata: SessionMetadata;
}

export interface ConversationContext {
  recentQueries: QueryContext[];
  currentFocus: string; // What the user is currently working on
  projectContext?: ProjectContext;
  toolUsagePattern: ToolUsagePattern[];
  lastInteraction: Date;
}

export interface QueryContext {
  query: string;
  response: string;
  toolsUsed: string[];
  timestamp: Date;
  successful: boolean;
  followUpQueries?: string[];
}

export interface ProjectContext {
  projectName: string;
  technology: string; // e.g., 'terraform', 'cloudformation', 'aws-cli'
  currentPhase: string; // e.g., 'planning', 'implementation', 'testing'
  resources: string[]; // AWS resources being worked with
  goals: string[];
}

export interface LearnedBehavior {
  pattern: string;
  frequency: number;
  confidence: number;
  lastSeen: Date;
  context: string; // When this behavior is relevant
}

export interface WorkingMemory {
  activeVariables: Record<string, any>; // Variables the agent is tracking
  temporaryNotes: string[]; // Short-term memory items
  pendingTasks: Task[];
  contextStack: string[]; // Stack of nested contexts
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[];
  estimatedEffort?: number;
}

export interface ToolUsagePattern {
  toolName: string;
  usageCount: number;
  averageSuccessRate: number;
  commonParameters: Record<string, any>;
  lastUsed: Date;
}

export interface SessionPreferences {
  communicationStyle: 'concise' | 'detailed' | 'interactive';
  defaultOutputFormat: 'text' | 'json' | 'markdown';
  expertiseLevel: 'beginner' | 'intermediate' | 'expert';
  preferredServices: string[];
  timeZone?: string;
}

export interface SessionMetadata {
  createdAt: Date;
  lastAccessed: Date;
  totalInteractions: number;
  sessionDuration: number; // in seconds
  averageResponseTime: number; // in milliseconds
  clientType?: string; // e.g., 'claude-desktop', 'cursor', 'vscode'
}

export class SessionStore {
  private dynamodb: DynamoDBClient;
  private sessionCache: Map<string, SessionState> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor() {
    this.dynamodb = new DynamoDBClient();
  }

  /**
   * Initialize or resume a session with minimal cognitive load
   */
  async initializeSession(sessionId: string, userId?: string): Promise<SessionState> {
    try {
      // Check cache first
      if (this.sessionCache.has(sessionId)) {
        const cached = this.sessionCache.get(sessionId)!;
        if (this.isSessionValid(cached)) {
          await this.updateLastAccessed(sessionId);
          return cached;
        }
      }

      // Try to load existing session
      let session = await this.loadSession(sessionId);
      
      if (!session || this.isSessionExpired(session)) {
        // Create new session with intelligent defaults
        session = await this.createNewSession(sessionId, userId);
      } else {
        // Resume existing session
        session = await this.resumeSession(session);
      }

      // Cache for quick access
      this.cacheSession(session);
      
      return session;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      // Fallback to basic session
      return this.createFallbackSession(sessionId, userId);
    }
  }

  /**
   * Save current session state
   */
  async saveSession(session: SessionState): Promise<void> {
    try {
      // Update metadata
      session.metadata.lastAccessed = new Date();
      session.metadata.sessionDuration = Math.floor(
        (Date.now() - session.metadata.createdAt.getTime()) / 1000
      );

      // Save to DynamoDB
      await this.dynamodb.saveSessionState(session);
      
      // Update cache
      this.cacheSession(session);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  /**
   * Update session with new interaction data
   */
  async updateSession(
    sessionId: string, 
    query: string, 
    response: string,
    toolsUsed: string[] = [],
    successful = true
  ): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    if (!session) return;

    // Add to conversation context
    const queryContext: QueryContext = {
      query,
      response: response.substring(0, 1000), // Limit storage size
      toolsUsed,
      timestamp: new Date(),
      successful,
    };

    session.conversationContext.recentQueries.unshift(queryContext);
    
    // Keep only recent queries (last 20)
    if (session.conversationContext.recentQueries.length > 20) {
      session.conversationContext.recentQueries = 
        session.conversationContext.recentQueries.slice(0, 20);
    }

    // Update tool usage patterns
    for (const tool of toolsUsed) {
      this.updateToolUsagePattern(session, tool, successful);
    }

    // Learn from interaction patterns
    await this.updateLearnedBehaviors(session, query, toolsUsed);

    // Update current focus
    session.conversationContext.currentFocus = this.extractFocus(query);
    session.conversationContext.lastInteraction = new Date();

    // Increment interaction count
    session.metadata.totalInteractions++;

    await this.saveSession(session);
  }

  /**
   * Get session context for cognitive load reduction
   */
  async getContextualInformation(sessionId: string): Promise<any> {
    const session = this.sessionCache.get(sessionId);
    if (!session) return null;

    return {
      currentFocus: session.conversationContext.currentFocus,
      recentContext: session.conversationContext.recentQueries
        .slice(0, 5)
        .map(q => ({
          query: q.query,
          tools: q.toolsUsed,
          successful: q.successful
        })),
      preferredTools: session.conversationContext.toolUsagePattern
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5)
        .map(t => t.toolName),
      workingVariables: session.workingMemory.activeVariables,
      pendingTasks: session.workingMemory.pendingTasks
        .filter(t => t.status !== 'completed'),
      projectContext: session.conversationContext.projectContext,
      preferences: session.preferences,
    };
  }

  /**
   * Add task to working memory
   */
  async addTask(sessionId: string, task: Omit<Task, 'id'>): Promise<string> {
    const session = this.sessionCache.get(sessionId);
    if (!session) throw new Error('Session not found');

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: Task = {
      id: taskId,
      ...task,
    };

    session.workingMemory.pendingTasks.push(newTask);
    await this.saveSession(session);

    return taskId;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(sessionId: string, taskId: string, status: Task['status']): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    if (!session) return;

    const task = session.workingMemory.pendingTasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      await this.saveSession(session);
    }
  }

  /**
   * Set project context
   */
  async setProjectContext(sessionId: string, project: ProjectContext): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    if (!session) return;

    session.conversationContext.projectContext = project;
    await this.saveSession(session);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(sessionId: string, preferences: Partial<SessionPreferences>): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    if (!session) return;

    session.preferences = { ...session.preferences, ...preferences };
    await this.saveSession(session);
  }

  /**
   * Get session analytics for optimization
   */
  async getSessionAnalytics(sessionId: string): Promise<any> {
    const session = this.sessionCache.get(sessionId);
    if (!session) return null;

    const recentQueries = session.conversationContext.recentQueries;
    const successRate = recentQueries.length > 0 ? 
      recentQueries.filter(q => q.successful).length / recentQueries.length : 0;

    return {
      totalInteractions: session.metadata.totalInteractions,
      sessionDuration: session.metadata.sessionDuration,
      successRate,
      mostUsedTools: session.conversationContext.toolUsagePattern
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 3),
      currentFocus: session.conversationContext.currentFocus,
      taskCompletion: {
        completed: session.workingMemory.pendingTasks.filter(t => t.status === 'completed').length,
        pending: session.workingMemory.pendingTasks.filter(t => t.status === 'pending').length,
        inProgress: session.workingMemory.pendingTasks.filter(t => t.status === 'in_progress').length,
      },
    };
  }

  // Private helper methods

  private async loadSession(sessionId: string): Promise<SessionState | null> {
    try {
      return await this.dynamodb.getSessionState(sessionId);
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  private async createNewSession(sessionId: string, userId?: string): Promise<SessionState> {
    const now = new Date();
    
    return {
      sessionId,
      userId,
      conversationContext: {
        recentQueries: [],
        currentFocus: 'general',
        toolUsagePattern: [],
        lastInteraction: now,
      },
      learnedBehaviors: [],
      workingMemory: {
        activeVariables: {},
        temporaryNotes: [],
        pendingTasks: [],
        contextStack: [],
      },
      preferences: await this.getDefaultPreferences(userId),
      metadata: {
        createdAt: now,
        lastAccessed: now,
        totalInteractions: 0,
        sessionDuration: 0,
        averageResponseTime: 0,
      },
    };
  }

  private async resumeSession(session: SessionState): Promise<SessionState> {
    // Clean up old data
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    session.conversationContext.recentQueries = 
      session.conversationContext.recentQueries.filter(
        q => q.timestamp > oneHourAgo
      );

    // Update last accessed
    session.metadata.lastAccessed = new Date();

    return session;
  }

  private createFallbackSession(sessionId: string, userId?: string): SessionState {
    const now = new Date();
    
    return {
      sessionId,
      userId,
      conversationContext: {
        recentQueries: [],
        currentFocus: 'general',
        toolUsagePattern: [],
        lastInteraction: now,
      },
      learnedBehaviors: [],
      workingMemory: {
        activeVariables: {},
        temporaryNotes: [],
        pendingTasks: [],
        contextStack: [],
      },
      preferences: {
        communicationStyle: 'concise',
        defaultOutputFormat: 'text',
        expertiseLevel: 'intermediate',
        preferredServices: ['knowledge', 'documentation'],
      },
      metadata: {
        createdAt: now,
        lastAccessed: now,
        totalInteractions: 0,
        sessionDuration: 0,
        averageResponseTime: 0,
      },
    };
  }

  private async getDefaultPreferences(userId?: string): Promise<SessionPreferences> {
    if (userId) {
      // Try to get user's historical preferences
      const userPrefs = await this.dynamodb.getUserPreferences(userId);
      if (userPrefs) {
        return {
          communicationStyle: 'concise',
          defaultOutputFormat: userPrefs.preferredFormat,
          expertiseLevel: userPrefs.expertiseLevel,
          preferredServices: userPrefs.commonServices,
        };
      }
    }

    return {
      communicationStyle: 'concise',
      defaultOutputFormat: 'text',
      expertiseLevel: 'intermediate',
      preferredServices: ['knowledge', 'documentation'],
    };
  }

  private updateToolUsagePattern(session: SessionState, toolName: string, successful: boolean): void {
    let pattern = session.conversationContext.toolUsagePattern.find(p => p.toolName === toolName);
    
    if (!pattern) {
      pattern = {
        toolName,
        usageCount: 0,
        averageSuccessRate: 0,
        commonParameters: {},
        lastUsed: new Date(),
      };
      session.conversationContext.toolUsagePattern.push(pattern);
    }

    pattern.usageCount++;
    pattern.lastUsed = new Date();
    
    // Update success rate using moving average
    const alpha = 0.1; // Learning rate
    pattern.averageSuccessRate = 
      pattern.averageSuccessRate * (1 - alpha) + (successful ? 1 : 0) * alpha;
  }

  private async updateLearnedBehaviors(session: SessionState, query: string, toolsUsed: string[]): Promise<void> {
    // Simple pattern learning - could be enhanced with ML
    const pattern = this.extractPattern(query, toolsUsed);
    
    let behavior = session.learnedBehaviors.find(b => b.pattern === pattern);
    if (!behavior) {
      behavior = {
        pattern,
        frequency: 0,
        confidence: 0.1,
        lastSeen: new Date(),
        context: session.conversationContext.currentFocus,
      };
      session.learnedBehaviors.push(behavior);
    }

    behavior.frequency++;
    behavior.lastSeen = new Date();
    behavior.confidence = Math.min(behavior.confidence + 0.1, 1.0);

    // Keep only top behaviors
    if (session.learnedBehaviors.length > 20) {
      session.learnedBehaviors.sort((a, b) => b.frequency - a.frequency);
      session.learnedBehaviors = session.learnedBehaviors.slice(0, 20);
    }
  }

  private extractPattern(query: string, toolsUsed: string[]): string {
    const keywords = query.toLowerCase().match(/\b(create|generate|search|find|explain|validate)\b/g);
    const mainKeyword = keywords?.[0] || 'query';
    const primaryTool = toolsUsed[0] || 'unknown';
    
    return `${mainKeyword}_with_${primaryTool}`;
  }

  private extractFocus(query: string): string {
    const services = ['s3', 'ec2', 'lambda', 'dynamodb', 'rds', 'cloudformation', 'terraform'];
    const lowerQuery = query.toLowerCase();
    
    for (const service of services) {
      if (lowerQuery.includes(service)) {
        return service;
      }
    }
    
    return 'general';
  }

  private isSessionValid(session: SessionState): boolean {
    const maxAge = 60 * 60 * 1000; // 1 hour
    return Date.now() - session.metadata.lastAccessed.getTime() < maxAge;
  }

  private isSessionExpired(session: SessionState): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - session.metadata.lastAccessed.getTime() > maxAge;
  }

  private cacheSession(session: SessionState): void {
    if (this.sessionCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest session
      const oldestKey = this.sessionCache.keys().next().value;
      this.sessionCache.delete(oldestKey);
    }
    
    this.sessionCache.set(session.sessionId, session);
  }

  private async updateLastAccessed(sessionId: string): Promise<void> {
    try {
      const session = this.sessionCache.get(sessionId);
      if (session) {
        session.metadata.lastAccessed = new Date();
        await this.dynamodb.updateSessionLastAccessed(sessionId);
      }
    } catch (error) {
      console.warn('Failed to update last accessed:', error);
    }
  }
}