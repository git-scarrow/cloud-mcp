import { ContextManager, OptimizedContext } from './context-manager.js';
import { SessionStore, SessionState } from '../session/session-store.js';
import { KnowledgeIndexer, KnowledgeEntry } from '../preprocessing/knowledge-indexer.js';
import { DynamoDBClient } from '../storage/dynamodb-client.js';

export interface ContextInjectionRequest {
  sessionId: string;
  currentQuery: string;
  conversationHistory: ConversationEntry[];
  toolContext?: ToolContext;
  userIntent?: string;
}

export interface ConversationEntry {
  query: string;
  response: string;
  toolsUsed: string[];
  timestamp: Date;
  successful: boolean;
}

export interface ToolContext {
  availableTools: string[];
  recentlyUsedTools: string[];
  failedTools: string[];
}

export interface InjectedContext {
  relevantKnowledge: KnowledgeEntry[];
  suggestedTools: ToolSuggestion[];
  contextualHints: ContextualHint[];
  priorityContext: string[];
  estimatedTokens: number;
}

export interface ToolSuggestion {
  toolName: string;
  reason: string;
  confidence: number;
  parameters?: Record<string, any>;
}

export interface ContextualHint {
  type: 'tip' | 'warning' | 'best-practice' | 'example';
  content: string;
  relevance: number;
  service?: string;
}

export interface IntentAnalysis {
  primaryIntent: string;
  confidence: number;
  entities: EntityExtraction[];
  contextClues: string[];
  suggestedActions: string[];
}

export interface EntityExtraction {
  type: 'service' | 'resource' | 'action' | 'parameter';
  value: string;
  confidence: number;
}

export class DynamicContextInjector {
  private contextManager: ContextManager;
  private sessionStore: SessionStore;
  private knowledgeIndexer: KnowledgeIndexer;
  private dynamodb: DynamoDBClient;

  constructor() {
    this.contextManager = new ContextManager();
    this.sessionStore = new SessionStore();
    this.knowledgeIndexer = new KnowledgeIndexer();
    this.dynamodb = new DynamoDBClient();
  }

  /**
   * Inject relevant context based on current conversation state
   */
  async injectRelevantContext(request: ContextInjectionRequest): Promise<InjectedContext> {
    try {
      // Analyze user intent from current query
      const intentAnalysis = await this.analyzeIntent(request.currentQuery, request.conversationHistory);
      
      // Get session context for personalization
      const sessionContext = await this.sessionStore.getContextualInformation(request.sessionId);
      
      // Find relevant knowledge entries
      const relevantKnowledge = await this.findRelevantKnowledge(
        intentAnalysis,
        sessionContext,
        request.conversationHistory
      );

      // Suggest optimal tools based on context
      const suggestedTools = await this.suggestTools(
        intentAnalysis,
        request.toolContext,
        sessionContext
      );

      // Generate contextual hints
      const contextualHints = await this.generateContextualHints(
        intentAnalysis,
        relevantKnowledge,
        sessionContext
      );

      // Prioritize context by relevance
      const priorityContext = this.prioritizeContext(
        relevantKnowledge,
        suggestedTools,
        contextualHints
      );

      // Estimate token usage for context window optimization
      const estimatedTokens = this.estimateTokenUsage({
        relevantKnowledge,
        suggestedTools,
        contextualHints,
        priorityContext,
        estimatedTokens: 0 // temporary, will be calculated
      });

      return {
        relevantKnowledge,
        suggestedTools,
        contextualHints,
        priorityContext,
        estimatedTokens
      };

    } catch (error) {
      console.error('Context injection failed:', error);
      return this.getFallbackContext();
    }
  }

  /**
   * Analyze user intent from query and conversation history
   */
  private async analyzeIntent(
    query: string, 
    history: ConversationEntry[]
  ): Promise<IntentAnalysis> {
    const lowerQuery = query.toLowerCase();
    
    // Extract primary intent
    let primaryIntent = 'general';
    let confidence = 0.5;

    // Intent patterns
    const intentPatterns = {
      'create': ['create', 'make', 'build', 'generate', 'setup'],
      'search': ['find', 'search', 'look for', 'show me', 'list'],
      'explain': ['explain', 'what is', 'how does', 'tell me about'],
      'troubleshoot': ['error', 'problem', 'issue', 'failed', 'not working'],
      'optimize': ['improve', 'optimize', 'better', 'faster', 'efficient'],
      'validate': ['check', 'validate', 'verify', 'test', 'ensure']
    };

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      for (const pattern of patterns) {
        if (lowerQuery.includes(pattern)) {
          primaryIntent = intent;
          confidence = 0.8;
          break;
        }
      }
      if (confidence > 0.5) break;
    }

    // Extract entities (AWS services, resources, etc.)
    const entities = this.extractEntities(query);
    
    // Get context clues from conversation history
    const contextClues = this.extractContextClues(history, query);
    
    // Suggest actions based on intent and entities
    const suggestedActions = this.generateActionSuggestions(primaryIntent, entities);

    return {
      primaryIntent,
      confidence,
      entities,
      contextClues,
      suggestedActions
    };
  }

  /**
   * Extract entities (services, resources, actions) from query
   */
  private extractEntities(query: string): EntityExtraction[] {
    const entities: EntityExtraction[] = [];
    const lowerQuery = query.toLowerCase();

    // AWS Services
    const awsServices = [
      's3', 'ec2', 'lambda', 'dynamodb', 'rds', 'cloudformation', 'iam', 
      'vpc', 'ecs', 'eks', 'apigateway', 'cloudwatch', 'sns', 'sqs'
    ];

    for (const service of awsServices) {
      if (lowerQuery.includes(service)) {
        entities.push({
          type: 'service',
          value: service,
          confidence: 0.9
        });
      }
    }

    // Resource types
    const resourceTypes = [
      'bucket', 'instance', 'function', 'table', 'database',
      'vpc', 'subnet', 'security group', 'load balancer'
    ];

    for (const resource of resourceTypes) {
      if (lowerQuery.includes(resource)) {
        entities.push({
          type: 'resource',
          value: resource,
          confidence: 0.8
        });
      }
    }

    // Actions
    const actions = [
      'create', 'delete', 'update', 'list', 'describe', 'configure'
    ];

    for (const action of actions) {
      if (lowerQuery.includes(action)) {
        entities.push({
          type: 'action',
          value: action,
          confidence: 0.7
        });
      }
    }

    return entities;
  }

  /**
   * Extract context clues from conversation history
   */
  private extractContextClues(history: ConversationEntry[], currentQuery: string): string[] {
    const clues: string[] = [];
    
    // Look at recent successful interactions
    const recentSuccessful = history
      .filter(entry => entry.successful)
      .slice(0, 3);

    for (const entry of recentSuccessful) {
      // Extract services mentioned
      const services = this.extractEntities(entry.query)
        .filter(e => e.type === 'service')
        .map(e => e.value);
      clues.push(...services);
      
      // Extract tools used
      clues.push(...entry.toolsUsed);
    }

    // Look for continuation patterns
    if (currentQuery.includes('also') || currentQuery.includes('and')) {
      clues.push('continuation');
    }

    return [...new Set(clues)]; // Remove duplicates
  }

  /**
   * Generate action suggestions based on intent and entities
   */
  private generateActionSuggestions(intent: string, entities: EntityExtraction[]): string[] {
    const suggestions: string[] = [];
    const services = entities.filter(e => e.type === 'service').map(e => e.value);
    
    switch (intent) {
      case 'create':
        if (services.includes('s3')) {
          suggestions.push('Generate S3 bucket configuration');
        }
        if (services.includes('lambda')) {
          suggestions.push('Create Lambda function template');
        }
        break;
        
      case 'explain':
        suggestions.push('Search AWS documentation');
        suggestions.push('Get best practices');
        break;
        
      case 'troubleshoot':
        suggestions.push('Search troubleshooting guides');
        suggestions.push('Check common issues');
        break;
    }

    return suggestions;
  }

  /**
   * Find relevant knowledge entries based on analysis
   */
  private async findRelevantKnowledge(
    intent: IntentAnalysis,
    sessionContext: any,
    history: ConversationEntry[]
  ): Promise<KnowledgeEntry[]> {
    const relevantEntries: KnowledgeEntry[] = [];
    
    try {
      // Get service-specific knowledge
      const services = intent.entities
        .filter(e => e.type === 'service')
        .map(e => e.value);

      for (const service of services) {
        const serviceKnowledge = await this.knowledgeIndexer.getServiceKnowledge(service);
        relevantEntries.push(...serviceKnowledge);
      }

      // Get intent-specific knowledge
      const intentKnowledge = await this.knowledgeIndexer.searchKnowledge(
        intent.primaryIntent,
        { category: this.mapIntentToCategory(intent.primaryIntent) }
      );
      relevantEntries.push(...intentKnowledge);

      // Personalize based on session context
      if (sessionContext?.preferredServices) {
        for (const service of sessionContext.preferredServices) {
          const personalizedKnowledge = await this.knowledgeIndexer.getServiceKnowledge(service);
          relevantEntries.push(...personalizedKnowledge.slice(0, 2)); // Limit to most relevant
        }
      }

    } catch (error) {
      console.error('Failed to find relevant knowledge:', error);
    }

    // Remove duplicates and sort by relevance
    const uniqueEntries = this.deduplicateKnowledge(relevantEntries);
    return uniqueEntries.slice(0, 5); // Limit to top 5 most relevant
  }

  /**
   * Suggest optimal tools based on context analysis
   */
  private async suggestTools(
    intent: IntentAnalysis,
    toolContext?: ToolContext,
    sessionContext?: any
  ): Promise<ToolSuggestion[]> {
    const suggestions: ToolSuggestion[] = [];

    // Map intent to tools
    const intentToTools: Record<string, string[]> = {
      'create': ['generate_template', 'query_service'],
      'search': ['search_aws', 'query_service'],
      'explain': ['query_service', 'search_aws'],
      'validate': ['validate_template', 'query_service'],
      'troubleshoot': ['search_aws', 'query_service']
    };

    const recommendedTools = intentToTools[intent.primaryIntent] || ['query_service'];

    for (const tool of recommendedTools) {
      suggestions.push({
        toolName: tool,
        reason: `Best tool for ${intent.primaryIntent} operations`,
        confidence: 0.8,
        parameters: this.suggestToolParameters(tool, intent)
      });
    }

    // Consider user's tool usage patterns
    if (sessionContext?.preferredTools) {
      for (const preferredTool of sessionContext.preferredTools.slice(0, 2)) {
        if (!suggestions.some(s => s.toolName === preferredTool)) {
          suggestions.push({
            toolName: preferredTool,
            reason: 'Based on your usage patterns',
            confidence: 0.6
          });
        }
      }
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Generate contextual hints for the user
   */
  private async generateContextualHints(
    intent: IntentAnalysis,
    knowledge: KnowledgeEntry[],
    sessionContext: any
  ): Promise<ContextualHint[]> {
    const hints: ContextualHint[] = [];

    // Add service-specific tips
    const services = intent.entities
      .filter(e => e.type === 'service')
      .map(e => e.value);

    for (const service of services) {
      const serviceTips = this.getServiceTips(service);
      hints.push(...serviceTips);
    }

    // Add intent-specific hints
    const intentHints = this.getIntentSpecificHints(intent.primaryIntent);
    hints.push(...intentHints);

    // Add free tier reminders
    if (sessionContext?.preferences?.expertiseLevel === 'beginner') {
      hints.push({
        type: 'tip',
        content: 'Remember to use AWS Free Tier services to avoid charges',
        relevance: 0.9
      });
    }

    return hints.slice(0, 4); // Limit to most relevant hints
  }

  /**
   * Get service-specific tips
   */
  private getServiceTips(service: string): ContextualHint[] {
    const tips: Record<string, ContextualHint[]> = {
      's3': [
        {
          type: 'tip' as const,
          content: 'S3 bucket names must be globally unique',
          relevance: 0.8,
          service: 's3'
        }
      ],
      'lambda': [
        {
          type: 'tip' as const,
          content: 'Lambda functions have a 15-minute maximum execution time',
          relevance: 0.7,
          service: 'lambda'
        }
      ],
      'dynamodb': [
        {
          type: 'best-practice' as const,
          content: 'Design partition keys to distribute data evenly',
          relevance: 0.9,
          service: 'dynamodb'
        }
      ]
    };

    return tips[service] || [];
  }

  /**
   * Get intent-specific hints
   */
  private getIntentSpecificHints(intent: string): ContextualHint[] {
    const hints: Record<string, ContextualHint[]> = {
      'create': [
        {
          type: 'tip' as const,
          content: 'Always tag your AWS resources for better organization',
          relevance: 0.8
        }
      ],
      'troubleshoot': [
        {
          type: 'tip' as const,
          content: 'Check CloudWatch logs for detailed error information',
          relevance: 0.9
        }
      ]
    };

    return hints[intent] || [];
  }

  /**
   * Prioritize context elements by relevance and importance
   */
  private prioritizeContext(
    knowledge: KnowledgeEntry[],
    tools: ToolSuggestion[],
    hints: ContextualHint[]
  ): string[] {
    const prioritized: string[] = [];

    // High priority: Critical hints and top tools
    hints
      .filter(h => h.relevance > 0.8)
      .forEach(h => prioritized.push(`HINT: ${h.content}`));

    tools
      .filter(t => t.confidence > 0.7)
      .forEach(t => prioritized.push(`TOOL: ${t.toolName} - ${t.reason}`));

    // Medium priority: Relevant knowledge
    knowledge
      .filter(k => k.priority > 7)
      .forEach(k => prioritized.push(`KNOWLEDGE: ${k.title}`));

    return prioritized.slice(0, 5); // Top 5 priority items
  }

  /**
   * Estimate token usage for context optimization
   */
  private estimateTokenUsage(context: InjectedContext): number {
    let tokens = 0;

    // Rough estimation (1 token ≈ 4 characters)
    context.relevantKnowledge.forEach(k => {
      tokens += Math.ceil(k.content.length / 4);
    });

    context.suggestedTools.forEach(t => {
      tokens += Math.ceil((t.toolName + t.reason).length / 4);
    });

    context.contextualHints.forEach(h => {
      tokens += Math.ceil(h.content.length / 4);
    });

    return tokens;
  }

  // Helper methods

  private mapIntentToCategory(intent: string): string {
    const mapping: Record<string, string> = {
      'create': 'pattern',
      'explain': 'service',
      'troubleshoot': 'troubleshooting',
      'search': 'service'
    };
    return mapping[intent] || 'service';
  }

  private suggestToolParameters(toolName: string, intent: IntentAnalysis): Record<string, any> {
    const services = intent.entities
      .filter(e => e.type === 'service')
      .map(e => e.value);

    switch (toolName) {
      case 'query_service':
        return {
          service: services[0] || 'knowledge',
          format: 'text'
        };
      case 'search_aws':
        return {
          filters: services.length > 0 ? { service: services[0] } : {}
        };
      default:
        return {};
    }
  }

  private deduplicateKnowledge(entries: KnowledgeEntry[]): KnowledgeEntry[] {
    const seen = new Set<string>();
    return entries.filter(entry => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
  }

  private getFallbackContext(): InjectedContext {
    return {
      relevantKnowledge: [],
      suggestedTools: [
        {
          toolName: 'query_service',
          reason: 'General purpose AWS querying',
          confidence: 0.5
        }
      ],
      contextualHints: [
        {
          type: 'tip',
          content: 'Try being more specific about the AWS service you need help with',
          relevance: 0.7
        }
      ],
      priorityContext: ['Use specific AWS service names for better assistance'],
      estimatedTokens: 50
    };
  }
}