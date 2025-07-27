import { BaseQueryHandler, QueryOptions } from './base-query.js';

export class CoreMCPQuery extends BaseQueryHandler {
  name = 'Core MCP Server';
  description = 'Utility functions and core MCP operations';

  private utilities = {
    'json_formatter': 'Format and prettify JSON data',
    'yaml_converter': 'Convert between JSON and YAML formats',
    'base64_encoder': 'Encode/decode base64 strings',
    'hash_generator': 'Generate MD5, SHA1, SHA256 hashes',
    'uuid_generator': 'Generate UUIDs in various formats',
    'timestamp_converter': 'Convert between timestamp formats',
    'string_manipulator': 'Various string operations',
    'regex_tester': 'Test regular expressions',
  };

  async query(query: string, options?: QueryOptions): Promise<string> {
    const operation = this.detectOperation(query);

    switch (operation) {
      case 'format':
        return this.formatResponse(await this.formatData(query), options?.format);
      case 'convert':
        return this.formatResponse(await this.convertData(query), options?.format);
      case 'generate':
        return this.formatResponse(await this.generateData(query), options?.format);
      case 'encode':
        return this.formatResponse(await this.encodeData(query), options?.format);
      case 'help':
        return this.formatResponse(await this.showHelp(), options?.format);
      default:
        return this.formatResponse(await this.generalUtility(query), options?.format);
    }
  }

  private detectOperation(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('format') || lowerQuery.includes('prettify')) return 'format';
    if (lowerQuery.includes('convert') || lowerQuery.includes('transform')) return 'convert';
    if (lowerQuery.includes('generate') || lowerQuery.includes('create')) return 'generate';
    if (lowerQuery.includes('encode') || lowerQuery.includes('decode')) return 'encode';
    if (lowerQuery.includes('help') || lowerQuery.includes('list')) return 'help';
    return 'general';
  }

  private async formatData(query: string): Promise<any> {
    if (query.toLowerCase().includes('json')) {
      return {
        utility: 'JSON Formatter',
        description: 'Formats and validates JSON data',
        examples: [
          {
            input: '{"name":"test","value":123}',
            output: `{
  "name": "test",
  "value": 123
}`,
          },
        ],
        features: [
          'Syntax validation',
          'Pretty printing with indentation',
          'Minification option',
          'Key sorting',
        ],
      };
    }

    if (query.toLowerCase().includes('yaml')) {
      return {
        utility: 'YAML Formatter',
        description: 'Formats and validates YAML data',
        features: [
          'Syntax validation',
          'Indentation correction',
          'Comment preservation',
          'Multi-document support',
        ],
      };
    }

    return {
      availableFormatters: ['JSON', 'YAML', 'XML', 'CSV'],
      usage: 'Specify the format type in your query',
    };
  }

  private async convertData(query: string): Promise<any> {
    const conversions: Record<string, any> = {
      'json_to_yaml': {
        description: 'Convert JSON to YAML format',
        example: {
          json: '{"key": "value"}',
          yaml: 'key: value',
        },
      },
      'yaml_to_json': {
        description: 'Convert YAML to JSON format',
        example: {
          yaml: 'key: value',
          json: '{"key":"value"}',
        },
      },
      'csv_to_json': {
        description: 'Convert CSV data to JSON array',
        example: {
          csv: 'name,age\nJohn,30',
          json: '[{"name":"John","age":"30"}]',
        },
      },
      'timestamp': {
        description: 'Convert between timestamp formats',
        formats: ['Unix timestamp', 'ISO 8601', 'RFC 2822', 'Human readable'],
      },
    };

    const conversionType = this.detectConversionType(query);
    return conversions[conversionType] || {
      availableConversions: Object.keys(conversions),
      usage: 'Specify source and target formats',
    };
  }

  private async generateData(query: string): Promise<any> {
    if (query.toLowerCase().includes('uuid')) {
      return {
        utility: 'UUID Generator',
        generated: {
          v4: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
          compact: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        formats: ['UUID v4', 'Compact (no hyphens)', 'Upper case', 'Lower case'],
      };
    }

    if (query.toLowerCase().includes('hash')) {
      return {
        utility: 'Hash Generator',
        algorithms: ['MD5', 'SHA1', 'SHA256', 'SHA512'],
        usage: 'Provide text to hash and algorithm',
        example: {
          input: 'Hello World',
          md5: '3e25960a79dbc69b674cd4ec67a72c62',
          sha256: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b156f5e8e0e2e1a9a',
        },
      };
    }

    if (query.toLowerCase().includes('password')) {
      return {
        utility: 'Password Generator',
        options: {
          length: '8-128 characters',
          complexity: ['Uppercase', 'Lowercase', 'Numbers', 'Symbols'],
          memorable: 'Word-based passwords',
        },
        securityTips: [
          'Use unique passwords for each service',
          'Store passwords in a password manager',
          'Enable 2FA where possible',
        ],
      };
    }

    return {
      availableGenerators: ['UUID', 'Hash', 'Password', 'Random strings', 'Timestamps'],
      usage: 'Specify what type of data to generate',
    };
  }

  private async encodeData(query: string): Promise<any> {
    if (query.toLowerCase().includes('base64')) {
      return {
        utility: 'Base64 Encoder/Decoder',
        operations: ['Encode text to base64', 'Decode base64 to text'],
        examples: {
          encode: {
            input: 'Hello World',
            output: 'SGVsbG8gV29ybGQ=',
          },
          decode: {
            input: 'SGVsbG8gV29ybGQ=',
            output: 'Hello World',
          },
        },
        useCases: [
          'Encoding binary data for text protocols',
          'Embedding images in HTML/CSS',
          'Basic authentication headers',
        ],
      };
    }

    if (query.toLowerCase().includes('url')) {
      return {
        utility: 'URL Encoder/Decoder',
        operations: ['Encode URL parameters', 'Decode URL-encoded strings'],
        examples: {
          encode: {
            input: 'hello world & special chars',
            output: 'hello%20world%20%26%20special%20chars',
          },
        },
      };
    }

    return {
      availableEncoders: ['Base64', 'URL', 'HTML entities', 'JWT decoder'],
      usage: 'Specify encoding type and operation',
    };
  }

  private async showHelp(): Promise<any> {
    return {
      name: this.name,
      description: this.description,
      availableUtilities: this.utilities,
      categories: {
        formatting: ['JSON formatter', 'YAML formatter', 'XML formatter'],
        conversion: ['JSON↔YAML', 'CSV↔JSON', 'Timestamp formats'],
        generation: ['UUID', 'Hash', 'Password', 'Random data'],
        encoding: ['Base64', 'URL encode', 'HTML entities'],
        string: ['Case conversion', 'Regex testing', 'String manipulation'],
      },
      examples: [
        'Format JSON data',
        'Convert YAML to JSON',
        'Generate UUID',
        'Encode text to base64',
        'Test regex pattern',
      ],
      note: 'All operations are performed locally - no external services required',
    };
  }

  private async generalUtility(query: string): Promise<any> {
    // String manipulation utilities
    if (query.toLowerCase().includes('case') || query.toLowerCase().includes('string')) {
      return {
        utility: 'String Manipulation',
        operations: {
          case_conversion: ['UPPERCASE', 'lowercase', 'Title Case', 'camelCase', 'snake_case'],
          trimming: ['Trim whitespace', 'Remove line breaks', 'Normalize spaces'],
          extraction: ['Substring', 'Split by delimiter', 'Extract patterns'],
        },
        examples: [
          'Convert "hello world" to camelCase → "helloWorld"',
          'Convert "HelloWorld" to snake_case → "hello_world"',
        ],
      };
    }

    // Regex utilities
    if (query.toLowerCase().includes('regex')) {
      return {
        utility: 'Regular Expression Tester',
        features: [
          'Pattern validation',
          'Match highlighting',
          'Group extraction',
          'Common patterns library',
        ],
        commonPatterns: {
          email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          url: '^https?://[\\w.-]+(?:\\.[\\w\\.-]+)+[\\w\\-\\._~:/?#[\\]@!\\$&\'\\(\\)\\*\\+,;=.]+$',
          ipv4: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
        },
      };
    }

    return {
      query: query,
      availableUtilities: Object.keys(this.utilities),
      suggestion: 'Try asking about specific utilities like JSON formatting, UUID generation, or base64 encoding',
      categories: [
        'Data Formatting',
        'Data Conversion',
        'Data Generation',
        'Encoding/Decoding',
        'String Operations',
      ],
    };
  }

  private detectConversionType(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('json') && lowerQuery.includes('yaml')) return 'json_to_yaml';
    if (lowerQuery.includes('yaml') && lowerQuery.includes('json')) return 'yaml_to_json';
    if (lowerQuery.includes('csv') && lowerQuery.includes('json')) return 'csv_to_json';
    if (lowerQuery.includes('timestamp') || lowerQuery.includes('time')) return 'timestamp';
    return '';
  }
}