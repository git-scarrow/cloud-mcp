/**
 * AWS Lambda Background Processor for MCP Context Optimization
 * 
 * This function runs periodically to:
 * - Pre-process AWS documentation
 * - Update cached contexts
 * - Analyze usage patterns
 * - Optimize tool schemas
 * 
 * Uses only AWS Free Tier resources
 */

const { DynamoDBClient, ScanCommand, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand: DocScanCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Environment configuration
const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE_PREFIX = process.env.MCP_TABLE_PREFIX || 'mcp-cognitive-load';

// DynamoDB setup
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Table names
const CONTEXTS_TABLE = `${TABLE_PREFIX}-contexts`;
const METRICS_TABLE = `${TABLE_PREFIX}-metrics`;
const KNOWLEDGE_TABLE = `${TABLE_PREFIX}-knowledge`;
const QUERY_CACHE_TABLE = `${TABLE_PREFIX}-query-cache`;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
    console.log('Starting context processing...', JSON.stringify(event, null, 2));
    
    const results = {
        processedContexts: 0,
        updatedKnowledge: 0,
        optimizedQueries: 0,
        errors: [],
        executionTime: 0
    };
    
    const startTime = Date.now();
    
    try {
        // Determine processing type from event
        const processingType = event.processingType || 'full';
        
        switch (processingType) {
            case 'contexts':
                results.processedContexts = await processExpiredContexts();
                break;
            case 'knowledge':
                results.updatedKnowledge = await updateKnowledgeBase();
                break;
            case 'optimization':
                results.optimizedQueries = await optimizeQueryCache();
                break;
            case 'full':
            default:
                results.processedContexts = await processExpiredContexts();
                results.updatedKnowledge = await updateKnowledgeBase();
                results.optimizedQueries = await optimizeQueryCache();
                break;
        }
        
        results.executionTime = Date.now() - startTime;
        
        console.log('Processing completed:', results);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Context processing completed successfully',
                results
            })
        };
        
    } catch (error) {
        console.error('Processing failed:', error);
        results.errors.push(error.message);
        results.executionTime = Date.now() - startTime;
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Context processing failed',
                error: error.message,
                results
            })
        };
    }
};

/**
 * Process and refresh expired contexts
 */
async function processExpiredContexts() {
    console.log('Processing expired contexts...');
    
    try {
        // Scan for contexts that need refresh (older than 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        
        const response = await docClient.send(new DocScanCommand({
            TableName: CONTEXTS_TABLE,
            FilterExpression: 'lastAccessed < :threshold',
            ExpressionAttributeValues: {
                ':threshold': thirtyMinutesAgo
            },
            Limit: 50 // Process in batches to stay within Lambda limits
        }));
        
        let processedCount = 0;
        
        for (const item of response.Items || []) {
            await refreshContext(item);
            processedCount++;
        }
        
        console.log(`Processed ${processedCount} expired contexts`);
        return processedCount;
        
    } catch (error) {
        console.error('Failed to process expired contexts:', error);
        throw error;
    }
}

/**
 * Refresh a single context with optimized data
 */
async function refreshContext(contextItem) {
    try {
        const contextData = JSON.parse(contextItem.contextData);
        
        // Re-optimize tool schemas based on recent usage
        const optimizedTools = await optimizeToolSchemas(contextData.toolSchemas);
        
        // Update frequent queries based on recent patterns
        const recentQueries = await getRecentQueryPatterns(contextItem.userId);
        
        const updatedContextData = {
            ...contextData,
            toolSchemas: optimizedTools,
            frequentQueries: recentQueries.slice(0, 5), // Keep top 5
            lastOptimized: new Date().toISOString()
        };
        
        // Update the context
        await docClient.send(new UpdateCommand({
            TableName: CONTEXTS_TABLE,
            Key: { sessionId: contextItem.sessionId },
            UpdateExpression: 'SET contextData = :data, lastAccessed = :now',
            ExpressionAttributeValues: {
                ':data': JSON.stringify(updatedContextData),
                ':now': new Date().toISOString()
            }
        }));
        
        console.log(`Refreshed context for session: ${contextItem.sessionId}`);
        
    } catch (error) {
        console.error(`Failed to refresh context ${contextItem.sessionId}:`, error);
    }
}

/**
 * Update knowledge base with fresh AWS documentation
 */
async function updateKnowledgeBase() {
    console.log('Updating knowledge base...');
    
    try {
        let updatedCount = 0;
        
        // Pre-compute common AWS service information
        const awsServices = [
            'S3', 'EC2', 'Lambda', 'DynamoDB', 'RDS', 'CloudFormation', 
            'IAM', 'VPC', 'ECS', 'EKS'
        ];
        
        for (const service of awsServices) {
            const knowledgeEntry = await generateServiceKnowledge(service);
            
            await docClient.send(new PutCommand({
                TableName: KNOWLEDGE_TABLE,
                Item: {
                    serviceId: service.toLowerCase(),
                    serviceName: service,
                    knowledgeData: JSON.stringify(knowledgeEntry),
                    lastUpdated: new Date().toISOString(),
                    ttl: Math.floor(Date.now() / 1000) + (24 * 3600) // 24 hours
                }
            }));
            
            updatedCount++;
        }
        
        console.log(`Updated knowledge base for ${updatedCount} services`);
        return updatedCount;
        
    } catch (error) {
        console.error('Failed to update knowledge base:', error);
        throw error;
    }
}

/**
 * Generate optimized knowledge for an AWS service
 */
async function generateServiceKnowledge(serviceName) {
    // This would typically fetch from AWS APIs or documentation
    // For now, we'll generate structured knowledge
    
    const knowledgeTemplates = {
        'S3': {
            category: 'Storage',
            commonUseCases: ['Static website hosting', 'Data backup', 'Content distribution'],
            keyFeatures: ['Virtually unlimited storage', 'Multiple storage classes', 'Built-in security'],
            freeTierLimits: '5GB storage, 20,000 GET requests, 2,000 PUT requests per month',
            quickStart: 'Create bucket → Upload objects → Set permissions',
            bestPractices: ['Enable versioning', 'Use lifecycle policies', 'Encrypt at rest']
        },
        'Lambda': {
            category: 'Compute',
            commonUseCases: ['API backends', 'Data processing', 'Event-driven automation'],
            keyFeatures: ['Serverless execution', 'Auto-scaling', 'Event triggers'],
            freeTierLimits: '1M requests and 400,000 GB-seconds per month',
            quickStart: 'Create function → Write code → Configure trigger',
            bestPractices: ['Minimize cold starts', 'Use environment variables', 'Handle errors gracefully']
        },
        'DynamoDB': {
            category: 'Database',
            commonUseCases: ['Web applications', 'Gaming', 'IoT data storage'],
            keyFeatures: ['NoSQL database', 'Single-digit millisecond latency', 'Automatic scaling'],
            freeTierLimits: '25GB storage, 25 read/write capacity units',
            quickStart: 'Create table → Define primary key → Add items',
            bestPractices: ['Design partition keys carefully', 'Use sparse indexes', 'Monitor capacity']
        }
    };
    
    return knowledgeTemplates[serviceName] || {
        category: 'AWS Service',
        commonUseCases: ['General AWS service'],
        keyFeatures: ['AWS managed service'],
        freeTierLimits: 'Check AWS Free Tier page',
        quickStart: 'See AWS documentation',
        bestPractices: ['Follow AWS Well-Architected principles']
    };
}

/**
 * Optimize query cache based on usage patterns
 */
async function optimizeQueryCache() {
    console.log('Optimizing query cache...');
    
    try {
        // Get all cached queries
        const response = await docClient.send(new DocScanCommand({
            TableName: QUERY_CACHE_TABLE,
            Limit: 100
        }));
        
        let optimizedCount = 0;
        
        for (const item of response.Items || []) {
            // Calculate new relevance score based on recent usage
            const daysSinceLastUsed = (Date.now() - new Date(item.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
            const recencyFactor = Math.max(0, 1 - (daysSinceLastUsed / 30)); // Decay over 30 days
            const newRelevanceScore = (item.hitCount * recencyFactor) / 100;
            
            // Update if score changed significantly
            if (Math.abs(newRelevanceScore - item.relevanceScore) > 0.1) {
                await docClient.send(new UpdateCommand({
                    TableName: QUERY_CACHE_TABLE,
                    Key: {
                        userId: item.userId,
                        queryPattern: item.queryPattern
                    },
                    UpdateExpression: 'SET relevanceScore = :score',
                    ExpressionAttributeValues: {
                        ':score': newRelevanceScore
                    }
                }));
                
                optimizedCount++;
            }
        }
        
        console.log(`Optimized ${optimizedCount} query cache entries`);
        return optimizedCount;
        
    } catch (error) {
        console.error('Failed to optimize query cache:', error);
        throw error;
    }
}

/**
 * Optimize tool schemas based on usage patterns
 */
async function optimizeToolSchemas(currentTools) {
    // Get usage statistics from metrics
    const usageStats = await getToolUsageStats();
    
    return currentTools.map(tool => {
        const usageCount = usageStats[tool.name] || 0;
        
        return {
            ...tool,
            usageCount,
            // Compress description more aggressively for rarely used tools
            description: usageCount < 5 ? 
                tool.description.split('.')[0] : 
                tool.description,
            // Limit examples for rarely used tools
            examples: usageCount < 10 ? 
                (tool.examples || []).slice(0, 1) : 
                tool.examples
        };
    })
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)); // Sort by usage
}

/**
 * Get recent query patterns for a user
 */
async function getRecentQueryPatterns(userId) {
    try {
        const response = await docClient.send(new DocScanCommand({
            TableName: QUERY_CACHE_TABLE,
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId || 'global'
            },
            Limit: 20
        }));
        
        return (response.Items || [])
            .sort((a, b) => b.hitCount - a.hitCount)
            .slice(0, 5);
    } catch (error) {
        console.error('Failed to get recent query patterns:', error);
        return [];
    }
}

/**
 * Get tool usage statistics
 */
async function getToolUsageStats() {
    try {
        // This would typically analyze metrics table
        // For now, return mock data
        return {
            'query_service': 150,
            'search_aws': 89,
            'generate_template': 45,
            'unified_query': 32,
            'validate_template': 23
        };
    } catch (error) {
        console.error('Failed to get tool usage stats:', error);
        return {};
    }
}