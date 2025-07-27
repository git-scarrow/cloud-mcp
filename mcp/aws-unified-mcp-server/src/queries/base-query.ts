export interface QueryOptions {
  format?: 'text' | 'json' | 'markdown';
  maxResults?: number;
  category?: string;
  [key: string]: any;
}

export interface SearchFilters {
  service?: string;
  type?: 'api' | 'guide' | 'tutorial' | 'reference' | 'best-practices';
  [key: string]: any;
}

export abstract class BaseQueryHandler {
  abstract name: string;
  abstract description: string;

  abstract query(query: string, options?: QueryOptions): Promise<string>;
  
  async search(searchTerm: string, filters?: SearchFilters): Promise<string> {
    return this.query(`search: ${searchTerm}`, { ...filters });
  }

  async generateTemplate(resource: string, options?: any): Promise<string> {
    throw new Error(`Template generation not supported by ${this.name}`);
  }

  async validateTemplate(template: string): Promise<string> {
    throw new Error(`Template validation not supported by ${this.name}`);
  }

  protected formatResponse(data: any, format?: 'text' | 'json' | 'markdown'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'markdown':
        return this.toMarkdown(data);
      case 'text':
      default:
        return this.toText(data);
    }
  }

  protected toText(data: any): string {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.map(item => this.toText(item)).join('\n');
    if (typeof data === 'object') return JSON.stringify(data, null, 2);
    return String(data);
  }

  protected toMarkdown(data: any): string {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
      return data.map(item => `- ${this.toText(item)}`).join('\n');
    }
    if (typeof data === 'object') {
      return Object.entries(data)
        .map(([key, value]) => `**${key}**: ${this.toText(value)}`)
        .join('\n');
    }
    return String(data);
  }
}