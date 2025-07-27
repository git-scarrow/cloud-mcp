import { BaseQueryHandler, QueryOptions } from './base-query.js';

interface KnowledgeArticle {
  title: string;
  description: string;
  url: string;
  category: string;
  tags: string[];
  lastUpdated?: string;
}

interface ServiceDocumentation {
  service: string;
  description: string;
  documentation: {
    userGuide: string;
    apiReference: string;
    developerGuide?: string;
    bestPractices?: string;
  };
  pricing: string;
  freeTier?: string;
}

export class AWSKnowledgeQuery extends BaseQueryHandler {
  name = 'AWS Knowledge Server';
  description = 'Query AWS Knowledge base for documentation, best practices, and guidance';

  // Comprehensive AWS service documentation mapping
  private serviceDocumentation: Record<string, ServiceDocumentation> = {
    's3': {
      service: 'Amazon S3',
      description: 'Object storage service',
      documentation: {
        userGuide: 'https://docs.aws.amazon.com/s3/latest/userguide/',
        apiReference: 'https://docs.aws.amazon.com/s3/latest/API/',
        developerGuide: 'https://docs.aws.amazon.com/s3/latest/dev/',
        bestPractices: 'https://docs.aws.amazon.com/s3/latest/userguide/security-best-practices.html'
      },
      pricing: 'https://aws.amazon.com/s3/pricing/',
      freeTier: '5GB standard storage, 20,000 GET requests, 2,000 PUT requests'
    },
    'ec2': {
      service: 'Amazon EC2',
      description: 'Virtual servers in the cloud',
      documentation: {
        userGuide: 'https://docs.aws.amazon.com/ec2/latest/userguide/',
        apiReference: 'https://docs.aws.amazon.com/ec2/latest/APIReference/',
        bestPractices: 'https://docs.aws.amazon.com/ec2/latest/userguide/ec2-best-practices.html'
      },
      pricing: 'https://aws.amazon.com/ec2/pricing/',
      freeTier: '750 hours t2.micro/t3.micro per month'
    },
    'lambda': {
      service: 'AWS Lambda',
      description: 'Serverless compute service',
      documentation: {
        userGuide: 'https://docs.aws.amazon.com/lambda/latest/dg/',
        apiReference: 'https://docs.aws.amazon.com/lambda/latest/api/',
        bestPractices: 'https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html'
      },
      pricing: 'https://aws.amazon.com/lambda/pricing/',
      freeTier: '1M requests, 400,000 GB-seconds per month'
    },
    'dynamodb': {
      service: 'Amazon DynamoDB',
      description: 'NoSQL database service',
      documentation: {
        userGuide: 'https://docs.aws.amazon.com/dynamodb/latest/userguide/',
        apiReference: 'https://docs.aws.amazon.com/dynamodb/latest/APIReference/',
        bestPractices: 'https://docs.aws.amazon.com/dynamodb/latest/userguide/best-practices.html'
      },
      pricing: 'https://aws.amazon.com/dynamodb/pricing/',
      freeTier: '25GB storage, 25 provisioned capacity units'
    },
    'cloudwatch': {
      service: 'Amazon CloudWatch',
      description: 'Monitoring and observability service',
      documentation: {
        userGuide: 'https://docs.aws.amazon.com/cloudwatch/latest/userguide/',
        apiReference: 'https://docs.aws.amazon.com/cloudwatch/latest/APIReference/',
        bestPractices: 'https://docs.aws.amazon.com/cloudwatch/latest/userguide/Best_Practice_Recommended_Alarms_AWS_Services.html'
      },
      pricing: 'https://aws.amazon.com/cloudwatch/pricing/',
      freeTier: '10 custom metrics, 10 alarms, 1M API requests'
    }
  };

  async query(query: string, options?: QueryOptions): Promise<string> {
    // Extract service names from query
    const serviceMatch = this.extractServiceFromQuery(query);
    if (serviceMatch) {
      return this.formatResponse(await this.getServiceDocumentation(serviceMatch, query), options?.format);
    }

    const knowledgeCategories = {
      'best-practices': this.getBestPractices,
      'architecture': this.getArchitectureGuidance,
      'api': this.getAPIDocumentation,
      'getting-started': this.getGettingStarted,
      'whats-new': this.getWhatsNew,
      'free-tier': this.getFreeTierInfo,
      'pricing': this.getPricingInfo,
    };

    // Extract category from query if present
    const category = options?.category || this.detectCategory(query);
    const handler = knowledgeCategories[category as keyof typeof knowledgeCategories];

    if (handler) {
      return this.formatResponse(await handler.call(this, query), options?.format);
    }

    // Default search behavior
    return this.formatResponse(await this.generalSearch(query), options?.format);
  }

  private extractServiceFromQuery(query: string): string | null {
    const lowerQuery = query.toLowerCase();
    for (const [key, service] of Object.entries(this.serviceDocumentation)) {
      if (lowerQuery.includes(key) || lowerQuery.includes(service.service.toLowerCase())) {
        return key;
      }
    }
    return null;
  }

  private async getServiceDocumentation(service: string, query: string): Promise<any> {
    const docs = this.serviceDocumentation[service];
    if (!docs) {
      return { error: 'Service documentation not found' };
    }

    return {
      service: docs.service,
      description: docs.description,
      documentation: docs.documentation,
      pricing: docs.pricing,
      freeTier: docs.freeTier,
      relatedQuery: query,
      quickLinks: [
        `📚 [User Guide](${docs.documentation.userGuide})`,
        `🔧 [API Reference](${docs.documentation.apiReference})`,
        docs.documentation.bestPractices ? `✨ [Best Practices](${docs.documentation.bestPractices})` : null,
        `💰 [Pricing](${docs.pricing})`
      ].filter(Boolean)
    };
  }

  private detectCategory(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('best practice') || lowerQuery.includes('recommendation')) return 'best-practices';
    if (lowerQuery.includes('architecture') || lowerQuery.includes('design')) return 'architecture';
    if (lowerQuery.includes('api') || lowerQuery.includes('sdk')) return 'api';
    if (lowerQuery.includes('getting started') || lowerQuery.includes('tutorial')) return 'getting-started';
    if (lowerQuery.includes('new') || lowerQuery.includes('announcement')) return 'whats-new';
    if (lowerQuery.includes('free tier') || lowerQuery.includes('free usage')) return 'free-tier';
    if (lowerQuery.includes('pricing') || lowerQuery.includes('cost')) return 'pricing';
    return 'general';
  }

  private async getBestPractices(query: string): Promise<any> {
    return {
      category: 'Best Practices',
      query: query,
      results: [
        {
          title: 'AWS Well-Architected Framework',
          description: 'Design principles and best practices for building on AWS',
          topics: ['Security', 'Reliability', 'Performance', 'Cost Optimization', 'Operational Excellence'],
        },
        {
          title: 'Service-Specific Best Practices',
          description: 'Detailed recommendations for individual AWS services',
          relevantTo: this.extractServiceNames(query),
        },
      ],
    };
  }

  private async getArchitectureGuidance(query: string): Promise<any> {
    return {
      category: 'Architecture Guidance',
      query: query,
      patterns: [
        {
          name: 'Microservices Architecture',
          services: ['ECS', 'EKS', 'Lambda', 'API Gateway'],
          useCases: ['Scalable applications', 'Independent deployments'],
        },
        {
          name: 'Serverless Architecture',
          services: ['Lambda', 'DynamoDB', 'API Gateway', 'S3'],
          useCases: ['Event-driven processing', 'Cost optimization'],
        },
      ],
    };
  }

  private async getAPIDocumentation(query: string): Promise<any> {
    const service = this.extractServiceNames(query)[0] || 'general';
    return {
      category: 'API Documentation',
      service: service,
      commonOperations: [
        'List resources',
        'Create resource',
        'Update resource',
        'Delete resource',
        'Describe resource',
      ],
      sdkLanguages: ['Python (boto3)', 'JavaScript/Node.js', 'Java', '.NET', 'Go'],
    };
  }

  private async getGettingStarted(query: string): Promise<any> {
    return {
      category: 'Getting Started',
      steps: [
        'Create an AWS account',
        'Set up IAM users and permissions',
        'Configure AWS CLI',
        'Choose your first service',
        'Follow service-specific tutorials',
      ],
      resources: [
        'AWS Free Tier',
        'AWS Documentation',
        'AWS Training and Certification',
      ],
    };
  }

  private async getWhatsNew(query: string): Promise<any> {
    return {
      category: "What's New",
      recent: [
        'New AWS services and features',
        'Service updates and improvements',
        'Regional expansions',
        'Price reductions',
      ],
      note: 'Check AWS News Blog for latest announcements',
    };
  }

  private async generalSearch(query: string): Promise<any> {
    return {
      query: query,
      searchResults: [
        {
          type: 'Documentation',
          relevance: 'High',
          sources: ['AWS Docs', 'API Reference', 'User Guides'],
        },
        {
          type: 'Examples',
          relevance: 'Medium',
          sources: ['Code samples', 'Tutorials', 'Workshops'],
        },
      ],
      suggestedActions: [
        'Refine search with service name',
        'Specify documentation type',
        'Use category filters',
      ],
    };
  }

  private async getFreeTierInfo(query: string): Promise<any> {
    const freeTierServices = [
      { service: 'EC2', offering: '750 hours t2.micro/t3.micro', period: 'per month for 12 months' },
      { service: 'S3', offering: '5GB standard storage, 20,000 GET, 2,000 PUT', period: 'per month' },
      { service: 'Lambda', offering: '1M requests, 400,000 GB-seconds', period: 'per month always free' },
      { service: 'DynamoDB', offering: '25GB storage, 25 RCU, 25 WCU', period: 'always free' },
      { service: 'CloudWatch', offering: '10 metrics, 10 alarms, 1M API requests', period: 'always free' },
      { service: 'SNS', offering: '1M publishes, 100K HTTP deliveries', period: 'per month always free' },
      { service: 'SQS', offering: '1M requests', period: 'per month always free' },
    ];

    return {
      category: 'AWS Free Tier',
      overview: 'AWS offers a generous free tier for many services',
      services: freeTierServices,
      types: [
        { type: 'Always Free', description: 'Available to all AWS customers indefinitely' },
        { type: '12 Months Free', description: 'Available for 12 months from account creation' },
        { type: 'Trials', description: 'Short-term free trials for specific services' }
      ],
      tips: [
        'Monitor usage with AWS Budgets',
        'Set up billing alerts',
        'Use Cost Explorer to track spending',
        'Tag resources for cost allocation'
      ],
      documentation: 'https://aws.amazon.com/free/'
    };
  }

  private async getPricingInfo(query: string): Promise<any> {
    const pricingPrinciples = [
      'Pay only for what you use',
      'No upfront commitments or long-term contracts',
      'Volume discounts available',
      'Reserved capacity for additional savings'
    ];

    return {
      category: 'AWS Pricing',
      principles: pricingPrinciples,
      tools: [
        { name: 'AWS Pricing Calculator', url: 'https://calculator.aws/', description: 'Estimate costs for your architecture' },
        { name: 'Cost Explorer', description: 'Analyze your AWS spending patterns' },
        { name: 'AWS Budgets', description: 'Set custom budgets and alerts' },
        { name: 'Cost & Usage Report', description: 'Detailed billing data' }
      ],
      optimization: [
        'Use appropriate instance types',
        'Turn off unused resources',
        'Use auto-scaling',
        'Leverage spot instances',
        'Implement lifecycle policies'
      ]
    };
  }

  private extractServiceNames(query: string): string[] {
    const services = ['S3', 'EC2', 'Lambda', 'DynamoDB', 'RDS', 'ECS', 'EKS', 'CloudFormation', 'IAM'];
    const found: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const service of services) {
      if (lowerQuery.includes(service.toLowerCase())) {
        found.push(service);
      }
    }
    
    return found;
  }
}