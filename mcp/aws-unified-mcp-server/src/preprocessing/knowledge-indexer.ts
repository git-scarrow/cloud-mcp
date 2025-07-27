import { DynamoDBClient } from '../storage/dynamodb-client.js';

export interface KnowledgeEntry {
  id: string;
  category: 'service' | 'best-practice' | 'pattern' | 'example' | 'troubleshooting';
  service: string;
  title: string;
  content: string;
  tags: string[];
  searchTerms: string[];
  priority: number; // 1-10, higher = more important
  lastUpdated: Date;
  usageCount: number;
  relevanceScore: number;
}

export interface IndexedKnowledge {
  serviceIndex: Map<string, KnowledgeEntry[]>;
  categoryIndex: Map<string, KnowledgeEntry[]>;
  tagIndex: Map<string, KnowledgeEntry[]>;
  searchIndex: Map<string, KnowledgeEntry[]>;
}

export interface BestPractice {
  service: string;
  category: string;
  title: string;
  summary: string;
  details: string[];
  priority: 'critical' | 'important' | 'recommended';
  freeTierRelevant: boolean;
}

export interface CodePattern {
  id: string;
  name: string;
  service: string;
  language: 'terraform' | 'cloudformation' | 'cli' | 'sdk';
  pattern: string;
  example: string;
  description: string;
  useCases: string[];
  complexity: 'basic' | 'intermediate' | 'advanced';
}

export class KnowledgeIndexer {
  private dynamodb: DynamoDBClient;
  private knowledgeTable: string;
  private patternsTable: string;
  private bestPracticesTable: string;

  constructor() {
    this.dynamodb = new DynamoDBClient();
    const prefix = process.env.MCP_TABLE_PREFIX || 'mcp-cognitive-load';
    this.knowledgeTable = `${prefix}-knowledge`;
    this.patternsTable = `${prefix}-patterns`;
    this.bestPracticesTable = `${prefix}-best-practices`;
  }

  /**
   * Index all AWS knowledge for fast retrieval
   */
  async indexAllKnowledge(): Promise<{ indexed: number; errors: string[] }> {
    console.log('Starting comprehensive knowledge indexing...');
    
    const results = { indexed: 0, errors: [] };
    
    try {
      // Index AWS services
      results.indexed += await this.indexAWSServices();
      
      // Index best practices
      results.indexed += await this.indexBestPractices();
      
      // Index code patterns
      results.indexed += await this.indexCodePatterns();
      
      // Index common troubleshooting
      results.indexed += await this.indexTroubleshooting();
      
      // Index examples
      results.indexed += await this.indexExamples();
      
      console.log(`Knowledge indexing completed: ${results.indexed} entries`);
      
    } catch (error) {
      console.error('Knowledge indexing failed:', error);
      results.errors.push(error.message);
    }
    
    return results;
  }

  /**
   * Index AWS service information
   */
  private async indexAWSServices(): Promise<number> {
    const services = [
      {
        id: 's3',
        name: 'Amazon S3',
        category: 'Storage',
        description: 'Object storage service with industry-leading scalability, data availability, security, and performance',
        freeTier: '5 GB standard storage, 20,000 GET requests, 2,000 PUT requests per month for 12 months',
        keyFeatures: [
          'Virtually unlimited storage capacity',
          'Multiple storage classes for cost optimization',
          'Built-in security and compliance features',
          'Strong consistency for all operations'
        ],
        commonUseCases: [
          'Static website hosting',
          'Data backup and restore',
          'Content distribution',
          'Data lakes and analytics'
        ],
        quickStart: [
          'Create an S3 bucket',
          'Upload objects via console or CLI',
          'Set bucket policies and permissions',
          'Configure lifecycle rules'
        ]
      },
      {
        id: 'lambda',
        name: 'AWS Lambda',
        category: 'Compute',
        description: 'Run code without provisioning or managing servers',
        freeTier: '1 million free requests per month and 400,000 GB-seconds of compute time per month',
        keyFeatures: [
          'Event-driven execution',
          'Automatic scaling',
          'Pay-per-use pricing',
          'Integrated with AWS services'
        ],
        commonUseCases: [
          'API backends',
          'Data processing',
          'Real-time file processing',
          'Scheduled tasks'
        ],
        quickStart: [
          'Create a Lambda function',
          'Write function code',
          'Configure triggers',
          'Test and monitor'
        ]
      },
      {
        id: 'dynamodb',
        name: 'Amazon DynamoDB',
        category: 'Database',
        description: 'Fast, flexible NoSQL database service for any scale',
        freeTier: '25 GB storage, 25 read capacity units, 25 write capacity units per month',
        keyFeatures: [
          'Single-digit millisecond latency',
          'Automatic scaling',
          'Built-in security',
          'Global tables for multi-region'
        ],
        commonUseCases: [
          'Web and mobile applications',
          'Gaming applications',
          'IoT data storage',
          'Real-time analytics'
        ],
        quickStart: [
          'Create a DynamoDB table',
          'Define primary key',
          'Add items to table',
          'Query and scan data'
        ]
      }
    ];

    let indexed = 0;
    for (const service of services) {
      const knowledgeEntry: KnowledgeEntry = {
        id: `service_${service.id}`,
        category: 'service',
        service: service.id,
        title: service.name,
        content: JSON.stringify({
          description: service.description,
          freeTier: service.freeTier,
          keyFeatures: service.keyFeatures,
          commonUseCases: service.commonUseCases,
          quickStart: service.quickStart
        }),
        tags: [service.category.toLowerCase(), 'aws-service', 'free-tier'],
        searchTerms: [service.name.toLowerCase(), service.id, service.category.toLowerCase()],
        priority: 9,
        lastUpdated: new Date(),
        usageCount: 0,
        relevanceScore: 1.0
      };

      await this.saveKnowledgeEntry(knowledgeEntry);
      indexed++;
    }

    return indexed;
  }

  /**
   * Index AWS best practices
   */
  private async indexBestPractices(): Promise<number> {
    const bestPractices: BestPractice[] = [
      {
        service: 's3',
        category: 'Security',
        title: 'S3 Security Best Practices',
        summary: 'Secure your S3 buckets with proper access controls and encryption',
        details: [
          'Enable bucket versioning to protect against accidental deletion',
          'Use bucket policies and IAM roles instead of public access',
          'Enable server-side encryption (SSE-S3 or SSE-KMS)',
          'Configure CORS policies carefully',
          'Enable CloudTrail logging for access monitoring',
          'Use pre-signed URLs for temporary access'
        ],
        priority: 'critical',
        freeTierRelevant: true
      },
      {
        service: 'lambda',
        category: 'Performance',
        title: 'Lambda Performance Optimization',
        summary: 'Optimize Lambda functions for better performance and cost',
        details: [
          'Minimize deployment package size',
          'Use connection pooling for database connections',
          'Optimize memory allocation based on CPU needs',
          'Use provisioned concurrency for consistent performance',
          'Implement proper error handling and retries',
          'Use environment variables for configuration'
        ],
        priority: 'important',
        freeTierRelevant: true
      },
      {
        service: 'dynamodb',
        category: 'Design',
        title: 'DynamoDB Table Design',
        summary: 'Design efficient DynamoDB tables for optimal performance',
        details: [
          'Choose partition keys that distribute data evenly',
          'Use composite sort keys for complex queries',
          'Avoid hot partitions by distributing writes',
          'Use sparse global secondary indexes',
          'Consider eventual consistency for better performance',
          'Implement proper error handling for throttling'
        ],
        priority: 'critical',
        freeTierRelevant: true
      }
    ];

    let indexed = 0;
    for (const practice of bestPractices) {
      const knowledgeEntry: KnowledgeEntry = {
        id: `best-practice_${practice.service}_${Date.now()}`,
        category: 'best-practice',
        service: practice.service,
        title: practice.title,
        content: JSON.stringify({
          summary: practice.summary,
          details: practice.details,
          priority: practice.priority,
          freeTierRelevant: practice.freeTierRelevant
        }),
        tags: ['best-practice', practice.category.toLowerCase(), practice.service],
        searchTerms: [practice.title.toLowerCase(), practice.service, 'best practice'],
        priority: practice.priority === 'critical' ? 10 : practice.priority === 'important' ? 8 : 6,
        lastUpdated: new Date(),
        usageCount: 0,
        relevanceScore: 1.0
      };

      await this.saveKnowledgeEntry(knowledgeEntry);
      indexed++;
    }

    return indexed;
  }

  /**
   * Index code patterns and templates
   */
  private async indexCodePatterns(): Promise<number> {
    const patterns: CodePattern[] = [
      {
        id: 'terraform_s3_basic',
        name: 'Basic S3 Bucket',
        service: 's3',
        language: 'terraform',
        pattern: 'resource "aws_s3_bucket" "bucket" {\n  bucket = var.bucket_name\n}',
        example: `resource "aws_s3_bucket" "example" {
  bucket = "my-unique-bucket-name"
  
  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}`,
        description: 'Creates a basic S3 bucket with minimal configuration',
        useCases: ['Static websites', 'File storage', 'Backup'],
        complexity: 'basic'
      },
      {
        id: 'cloudformation_lambda_basic',
        name: 'Basic Lambda Function',
        service: 'lambda',
        language: 'cloudformation',
        pattern: 'AWS::Lambda::Function with basic configuration',
        example: `Resources:
  MyLambda:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: my-function
      Runtime: nodejs18.x
      Handler: index.handler
      Code:
        ZipFile: |
          exports.handler = async (event) => {
            return { statusCode: 200, body: 'Hello World' };
          };
      Role: !GetAtt LambdaRole.Arn`,
        description: 'Creates a basic Lambda function with inline code',
        useCases: ['API endpoints', 'Event processing', 'Automation'],
        complexity: 'basic'
      }
    ];

    let indexed = 0;
    for (const pattern of patterns) {
      const knowledgeEntry: KnowledgeEntry = {
        id: `pattern_${pattern.id}`,
        category: 'pattern',
        service: pattern.service,
        title: pattern.name,
        content: JSON.stringify({
          language: pattern.language,
          pattern: pattern.pattern,
          example: pattern.example,
          description: pattern.description,
          useCases: pattern.useCases,
          complexity: pattern.complexity
        }),
        tags: ['code-pattern', pattern.language, pattern.service, pattern.complexity],
        searchTerms: [pattern.name.toLowerCase(), pattern.service, pattern.language],
        priority: 7,
        lastUpdated: new Date(),
        usageCount: 0,
        relevanceScore: 1.0
      };

      await this.saveKnowledgeEntry(knowledgeEntry);
      indexed++;
    }

    return indexed;
  }

  /**
   * Index troubleshooting guides
   */
  private async indexTroubleshooting(): Promise<number> {
    const troubleshootingGuides = [
      {
        service: 's3',
        issue: 'Access Denied Error',
        solution: 'Check bucket policies, IAM permissions, and public access settings',
        details: [
          'Verify IAM user has s3:GetObject permission',
          'Check bucket policy allows the action',
          'Ensure bucket is not blocking public access if needed',
          'Verify correct region in API calls'
        ]
      },
      {
        service: 'lambda',
        issue: 'Function Timeout',
        solution: 'Optimize code performance and increase timeout if necessary',
        details: [
          'Profile code to find bottlenecks',
          'Optimize database connections',
          'Increase function timeout (max 15 minutes)',
          'Consider breaking into smaller functions'
        ]
      }
    ];

    let indexed = 0;
    for (const guide of troubleshootingGuides) {
      const knowledgeEntry: KnowledgeEntry = {
        id: `troubleshooting_${guide.service}_${Date.now()}`,
        category: 'troubleshooting',
        service: guide.service,
        title: `${guide.service.toUpperCase()}: ${guide.issue}`,
        content: JSON.stringify({
          issue: guide.issue,
          solution: guide.solution,
          details: guide.details
        }),
        tags: ['troubleshooting', guide.service, 'error', 'solution'],
        searchTerms: [guide.issue.toLowerCase(), guide.service, 'error', 'problem'],
        priority: 8,
        lastUpdated: new Date(),
        usageCount: 0,
        relevanceScore: 1.0
      };

      await this.saveKnowledgeEntry(knowledgeEntry);
      indexed++;
    }

    return indexed;
  }

  /**
   * Index code examples
   */
  private async indexExamples(): Promise<number> {
    const examples = [
      {
        service: 's3',
        title: 'Upload File to S3 (Python)',
        code: `import boto3

s3 = boto3.client('s3')
s3.upload_file('local_file.txt', 'my-bucket', 'remote_file.txt')`,
        description: 'Simple file upload using boto3'
      },
      {
        service: 'lambda',
        title: 'Basic Lambda Handler (Node.js)',
        code: `exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event));
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' })
  };
};`,
        description: 'Basic Lambda function structure'
      }
    ];

    let indexed = 0;
    for (const example of examples) {
      const knowledgeEntry: KnowledgeEntry = {
        id: `example_${example.service}_${Date.now()}`,
        category: 'example',
        service: example.service,
        title: example.title,
        content: JSON.stringify({
          code: example.code,
          description: example.description
        }),
        tags: ['example', 'code', example.service],
        searchTerms: [example.title.toLowerCase(), example.service, 'example', 'code'],
        priority: 6,
        lastUpdated: new Date(),
        usageCount: 0,
        relevanceScore: 1.0
      };

      await this.saveKnowledgeEntry(knowledgeEntry);
      indexed++;
    }

    return indexed;
  }

  /**
   * Search indexed knowledge
   */
  async searchKnowledge(
    query: string,
    filters?: {
      service?: string;
      category?: string;
      tags?: string[];
    },
    limit = 10
  ): Promise<KnowledgeEntry[]> {
    try {
      // This is a simplified search - in production you'd use more sophisticated indexing
      const searchTerms = query.toLowerCase().split(' ');
      const results: KnowledgeEntry[] = [];

      // Search would be implemented using DynamoDB queries
      // For now, return structure for interface
      
      return results.slice(0, limit);
    } catch (error) {
      console.error('Knowledge search failed:', error);
      return [];
    }
  }

  /**
   * Get knowledge by service
   */
  async getServiceKnowledge(service: string): Promise<KnowledgeEntry[]> {
    try {
      // Query DynamoDB for service-specific knowledge
      return []; // Placeholder
    } catch (error) {
      console.error('Failed to get service knowledge:', error);
      return [];
    }
  }

  /**
   * Update knowledge usage statistics
   */
  async trackKnowledgeUsage(knowledgeId: string): Promise<void> {
    try {
      // Update usage count and relevance score
      // This helps prioritize frequently accessed knowledge
    } catch (error) {
      console.error('Failed to track knowledge usage:', error);
    }
  }

  /**
   * Get most relevant knowledge for context injection
   */
  async getRelevantKnowledge(
    context: {
      recentQueries: string[];
      currentFocus: string;
      toolsUsed: string[];
    },
    limit = 5
  ): Promise<KnowledgeEntry[]> {
    try {
      // Analyze context to determine most relevant knowledge
      const relevantEntries: KnowledgeEntry[] = [];
      
      // Implementation would score entries based on:
      // - Context relevance
      // - Usage frequency
      // - Recency
      // - User patterns
      
      return relevantEntries.slice(0, limit);
    } catch (error) {
      console.error('Failed to get relevant knowledge:', error);
      return [];
    }
  }

  // Private helper methods

  private async saveKnowledgeEntry(entry: KnowledgeEntry): Promise<void> {
    try {
      await this.dynamodb.saveKnowledgeEntry(entry);
    } catch (error) {
      console.error('Failed to save knowledge entry:', error);
      throw error;
    }
  }

  /**
   * Refresh knowledge index with latest information
   */
  async refreshIndex(): Promise<void> {
    console.log('Refreshing knowledge index...');
    
    try {
      // This would typically run as a scheduled Lambda
      // Update entries that are older than a certain threshold
      const results = await this.indexAllKnowledge();
      console.log(`Refresh completed: ${results.indexed} entries updated`);
    } catch (error) {
      console.error('Failed to refresh index:', error);
      throw error;
    }
  }
}