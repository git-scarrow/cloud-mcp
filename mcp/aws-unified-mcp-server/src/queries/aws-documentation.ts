import { BaseQueryHandler, QueryOptions } from './base-query.js';

export class AWSDocumentationQuery extends BaseQueryHandler {
  name = 'AWS Documentation Server';
  description = 'Search and retrieve AWS documentation locally';

  private documentationIndex: Record<string, any> = {
    services: {
      's3': {
        name: 'Amazon S3',
        categories: ['Storage'],
        docs: ['User Guide', 'API Reference', 'Developer Guide'],
      },
      'ec2': {
        name: 'Amazon EC2',
        categories: ['Compute'],
        docs: ['User Guide', 'API Reference', 'Instance Types'],
      },
      'lambda': {
        name: 'AWS Lambda',
        categories: ['Compute', 'Serverless'],
        docs: ['Developer Guide', 'API Reference', 'Best Practices'],
      },
      'dynamodb': {
        name: 'Amazon DynamoDB',
        categories: ['Database', 'NoSQL'],
        docs: ['Developer Guide', 'API Reference', 'Best Practices'],
      },
      'rds': {
        name: 'Amazon RDS',
        categories: ['Database', 'SQL'],
        docs: ['User Guide', 'API Reference', 'Best Practices'],
      },
    },
  };

  async query(query: string, options?: QueryOptions): Promise<string> {
    const searchType = this.detectSearchType(query);
    
    switch (searchType) {
      case 'service':
        return this.formatResponse(await this.searchService(query), options?.format);
      case 'api':
        return this.formatResponse(await this.searchAPI(query), options?.format);
      case 'guide':
        return this.formatResponse(await this.searchGuides(query), options?.format);
      case 'example':
        return this.formatResponse(await this.searchExamples(query), options?.format);
      default:
        return this.formatResponse(await this.generalDocSearch(query), options?.format);
    }
  }

  private detectSearchType(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('api')) return 'api';
    if (lowerQuery.includes('guide') || lowerQuery.includes('tutorial')) return 'guide';
    if (lowerQuery.includes('example') || lowerQuery.includes('sample')) return 'example';
    if (Object.keys(this.documentationIndex.services).some(s => lowerQuery.includes(s))) return 'service';
    return 'general';
  }

  private async searchService(query: string): Promise<any> {
    const serviceName = this.extractServiceName(query);
    const service = this.documentationIndex.services[serviceName];

    if (service) {
      return {
        service: service.name,
        categories: service.categories,
        availableDocumentation: service.docs,
        quickLinks: [
          `Getting started with ${service.name}`,
          `${service.name} pricing`,
          `${service.name} limits and quotas`,
          `${service.name} security best practices`,
        ],
      };
    }

    return {
      error: 'Service not found',
      suggestion: 'Try searching for: S3, EC2, Lambda, DynamoDB, or RDS',
    };
  }

  private async searchAPI(query: string): Promise<any> {
    const serviceName = this.extractServiceName(query);
    
    return {
      category: 'API Reference',
      service: serviceName || 'General',
      commonAPIs: [
        'CreateResource',
        'DescribeResource',
        'ListResources',
        'UpdateResource',
        'DeleteResource',
      ],
      sdkExamples: {
        python: 'boto3 client and resource examples',
        javascript: 'AWS SDK v3 examples',
        cli: 'AWS CLI command examples',
      },
    };
  }

  private async searchGuides(query: string): Promise<any> {
    return {
      category: 'User Guides',
      availableGuides: [
        {
          title: 'Getting Started Guide',
          topics: ['Account setup', 'First steps', 'Basic concepts'],
        },
        {
          title: 'Developer Guide',
          topics: ['SDK usage', 'Code examples', 'Integration patterns'],
        },
        {
          title: 'Best Practices Guide',
          topics: ['Security', 'Performance', 'Cost optimization'],
        },
      ],
      relatedTutorials: [
        'Build your first application',
        'Set up a development environment',
        'Deploy a sample application',
      ],
    };
  }

  private async searchExamples(query: string): Promise<any> {
    const serviceName = this.extractServiceName(query);
    
    return {
      category: 'Code Examples',
      service: serviceName || 'General',
      exampleCategories: [
        {
          type: 'Basic Operations',
          examples: ['Create', 'Read', 'Update', 'Delete'],
        },
        {
          type: 'Advanced Patterns',
          examples: ['Batch operations', 'Error handling', 'Pagination'],
        },
        {
          type: 'Integration Examples',
          examples: ['Cross-service workflows', 'Event-driven patterns'],
        },
      ],
      languages: ['Python', 'JavaScript', 'Java', 'Go', '.NET'],
    };
  }

  private async generalDocSearch(query: string): Promise<any> {
    return {
      query: query,
      searchResults: {
        guides: this.searchInCategory(query, 'guides'),
        references: this.searchInCategory(query, 'references'),
        tutorials: this.searchInCategory(query, 'tutorials'),
        faqs: this.searchInCategory(query, 'faqs'),
      },
      suggestions: [
        'Try searching for a specific service name',
        'Use keywords like "guide", "api", or "example"',
        'Check the AWS Documentation homepage for browse options',
      ],
    };
  }

  private searchInCategory(query: string, category: string): string[] {
    // Simulate searching within a category
    const results = [];
    const keywords = query.toLowerCase().split(' ');
    
    if (category === 'guides' && keywords.some(k => ['start', 'begin', 'setup'].includes(k))) {
      results.push('Getting Started Guide');
    }
    if (category === 'references' && keywords.some(k => ['api', 'sdk', 'cli'].includes(k))) {
      results.push('API Reference Documentation');
    }
    if (category === 'tutorials' && keywords.some(k => ['build', 'create', 'deploy'].includes(k))) {
      results.push('Step-by-step Tutorials');
    }
    
    return results.length > 0 ? results : [`No ${category} found for "${query}"`];
  }

  private extractServiceName(query: string): string {
    const lowerQuery = query.toLowerCase();
    for (const [key, service] of Object.entries(this.documentationIndex.services)) {
      if (lowerQuery.includes(key) || lowerQuery.includes((service as any).name.toLowerCase())) {
        return key;
      }
    }
    return '';
  }
}