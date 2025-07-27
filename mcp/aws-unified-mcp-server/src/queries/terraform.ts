import { BaseQueryHandler, QueryOptions } from './base-query.js';
import pkg from 'hcl2-parser';
const { parseHCL } = pkg;

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  resources?: any[];
}

export class TerraformQuery extends BaseQueryHandler {
  name = 'Terraform Server';
  description = 'Generate and validate Terraform configurations for AWS resources';

  private resourceTemplates: Record<string, any> = {
    's3_bucket': {
      basic: `resource "aws_s3_bucket" "example" {
  bucket = "my-bucket-name"
  
  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}`,
      withVersioning: `resource "aws_s3_bucket" "example" {
  bucket = "my-bucket-name"
}

resource "aws_s3_bucket_versioning" "example" {
  bucket = aws_s3_bucket.example.id
  versioning_configuration {
    status = "Enabled"
  }
}`,
    },
    'ec2_instance': {
      basic: `resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0" # Amazon Linux 2
  instance_type = "t2.micro"

  tags = {
    Name = "ExampleInstance"
  }
}`,
      withVpc: `resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "main" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}

resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.main.id

  tags = {
    Name = "ExampleInstance"
  }
}`,
    },
    'lambda_function': {
      basic: `resource "aws_iam_role" "lambda_role" {
  name = "lambda_execution_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_lambda_function" "example" {
  filename      = "lambda_function.zip"
  function_name = "example_lambda"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
}`,
    },
    'dynamodb_table': {
      basic: `resource "aws_dynamodb_table" "example" {
  name           = "example-table"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name        = "example-table"
    Environment = "dev"
  }
}`,
    },
  };

  async query(query: string, options?: QueryOptions): Promise<string> {
    const queryType = this.detectQueryType(query);

    switch (queryType) {
      case 'generate':
        return this.formatResponse(await this.generateConfiguration(query), options?.format);
      case 'validate':
        return this.formatResponse(await this.validateConfiguration(query), options?.format);
      case 'explain':
        return this.formatResponse(await this.explainResource(query), options?.format);
      case 'convert':
        return this.formatResponse(await this.convertFromCloudFormation(query), options?.format);
      default:
        return this.formatResponse(await this.generalTerraformQuery(query), options?.format);
    }
  }

  async generateTemplate(resource: string, options?: any): Promise<string> {
    const resourceType = this.normalizeResourceType(resource);
    const template = this.resourceTemplates[resourceType];

    if (template) {
      const variant = options?.variant || 'basic';
      return template[variant] || template.basic;
    }

    return this.generateCustomTemplate(resource, options);
  }

  async validateTemplate(template: string): Promise<string> {
    const validationResult: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      resources: []
    };

    try {
      // Parse the HCL template
      const parsed = await parseHCL(template);
      
      // Check if parsing succeeded
      if (!parsed) {
        validationResult.valid = false;
        validationResult.errors.push('Failed to parse HCL template');
        return this.formatValidationResult(validationResult);
      }

      // Extract resources
      const resources = this.extractResources(parsed);
      validationResult.resources = resources;

      // Validate each resource
      for (const resource of resources) {
        const validation = this.validateResource(resource);
        validationResult.errors.push(...validation.errors);
        validationResult.warnings.push(...validation.warnings);
        validationResult.suggestions.push(...validation.suggestions);
      }

      // Check for Terraform best practices
      this.checkBestPractices(template, resources, validationResult);

      validationResult.valid = validationResult.errors.length === 0;

    } catch (error: any) {
      validationResult.valid = false;
      validationResult.errors.push(`HCL parsing error: ${error.message}`);
      
      // Provide helpful syntax error messages
      if (error.message.includes('unexpected')) {
        validationResult.suggestions.push('Check for missing closing braces or quotes');
      }
      if (error.message.includes('EOF')) {
        validationResult.suggestions.push('Check for unclosed blocks or incomplete statements');
      }
    }

    return this.formatValidationResult(validationResult);
  }

  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('generate') || lowerQuery.includes('create')) return 'generate';
    if (lowerQuery.includes('validate') || lowerQuery.includes('check')) return 'validate';
    if (lowerQuery.includes('explain') || lowerQuery.includes('what is')) return 'explain';
    if (lowerQuery.includes('convert') || lowerQuery.includes('cloudformation')) return 'convert';
    return 'general';
  }

  private async generateConfiguration(query: string): Promise<any> {
    const resource = this.extractResourceType(query);
    
    if (resource && this.resourceTemplates[resource]) {
      return {
        resource: resource,
        configuration: this.resourceTemplates[resource].basic,
        variants: Object.keys(this.resourceTemplates[resource]),
        notes: [
          'Remember to run `terraform init` before applying',
          'Use `terraform plan` to preview changes',
          'This is a basic configuration - customize as needed',
        ],
      };
    }

    return {
      error: 'Resource type not recognized',
      supportedResources: Object.keys(this.resourceTemplates),
      suggestion: 'Try: "generate terraform for s3 bucket" or "create ec2 instance configuration"',
    };
  }

  private async validateConfiguration(query: string): Promise<any> {
    return {
      action: 'Validation',
      note: 'Extract the Terraform configuration from your query and use the validate_template tool',
      steps: [
        'Ensure configuration has valid HCL syntax',
        'Check resource types are correct',
        'Verify required arguments are present',
        'Look for deprecated patterns',
      ],
    };
  }

  private async explainResource(query: string): Promise<any> {
    const resource = this.extractResourceType(query);
    
    const explanations: Record<string, any> = {
      's3_bucket': {
        purpose: 'Creates an S3 bucket for object storage',
        requiredArgs: ['bucket'],
        optionalArgs: ['acl', 'versioning', 'lifecycle_rule', 'server_side_encryption_configuration'],
        bestPractices: [
          'Enable versioning for important data',
          'Use encryption at rest',
          'Set up lifecycle policies to manage costs',
          'Use meaningful naming conventions',
        ],
      },
      'ec2_instance': {
        purpose: 'Launches an EC2 virtual machine instance',
        requiredArgs: ['ami', 'instance_type'],
        optionalArgs: ['key_name', 'security_groups', 'subnet_id', 'user_data'],
        bestPractices: [
          'Use the latest AMI for your region',
          'Start with t2.micro for Free Tier eligibility',
          'Always tag your resources',
          'Use IAM instance profiles instead of hardcoded credentials',
        ],
      },
    };

    return explanations[resource] || {
      error: 'Resource not found in explanation database',
      suggestion: 'Try explaining: s3_bucket, ec2_instance, lambda_function, or dynamodb_table',
    };
  }

  private async convertFromCloudFormation(query: string): Promise<any> {
    return {
      action: 'CloudFormation to Terraform Conversion',
      note: 'This server can help convert CloudFormation templates to Terraform',
      conversionTips: [
        'Resource types: AWS::S3::Bucket → aws_s3_bucket',
        'Intrinsic functions: !Ref → interpolation syntax ${resource.name.attribute}',
        'Parameters → Terraform variables',
        'Outputs → Terraform outputs',
      ],
      example: {
        cloudFormation: '!Ref MyBucket',
        terraform: '${aws_s3_bucket.my_bucket.id}',
      },
    };
  }

  private async generalTerraformQuery(query: string): Promise<any> {
    return {
      query: query,
      capabilities: [
        'Generate Terraform configurations for AWS resources',
        'Validate Terraform syntax',
        'Explain Terraform resources and best practices',
        'Convert CloudFormation to Terraform',
      ],
      commonCommands: {
        'terraform init': 'Initialize a Terraform working directory',
        'terraform plan': 'Show changes required by the current configuration',
        'terraform apply': 'Apply the changes required to reach the desired state',
        'terraform destroy': 'Destroy Terraform-managed infrastructure',
      },
      tip: 'All operations are local - no AWS credentials or costs required!',
    };
  }

  private normalizeResourceType(resource: string): string {
    const normalized = resource.toLowerCase().replace(/[- ]/g, '_');
    
    // Map common names to resource types
    const mappings: { [key: string]: string } = {
      's3': 's3_bucket',
      'bucket': 's3_bucket',
      'ec2': 'ec2_instance',
      'instance': 'ec2_instance',
      'lambda': 'lambda_function',
      'function': 'lambda_function',
      'dynamodb': 'dynamodb_table',
      'table': 'dynamodb_table',
    };

    return mappings[normalized] || normalized;
  }

  private extractResourceType(query: string): string {
    const lowerQuery = query.toLowerCase();
    for (const resource of Object.keys(this.resourceTemplates)) {
      if (lowerQuery.includes(resource.replace('_', ' ')) || 
          lowerQuery.includes(resource.replace('_', '-'))) {
        return resource;
      }
    }
    return '';
  }

  private generateCustomTemplate(resource: string, options?: any): string {
    return `# Terraform configuration for ${resource}
# This is a template - please customize for your needs

resource "aws_${resource}" "example" {
  # Add required arguments here
  name = "example-${resource}"
  
  # Add optional arguments as needed
  
  tags = {
    Name        = "Example ${resource}"
    Environment = "Development"
    ManagedBy   = "Terraform"
  }
}

# Outputs
output "${resource}_id" {
  value       = aws_${resource}.example.id
  description = "The ID of the ${resource}"
}`;
  }

  private extractResources(parsed: any): any[] {
    const resources: any[] = [];
    
    // Navigate the parsed HCL structure
    if (parsed.resource) {
      Object.entries(parsed.resource).forEach(([type, instances]) => {
        Object.entries(instances as any).forEach(([name, config]) => {
          resources.push({ type, name, config });
        });
      });
    }
    
    return resources;
  }

  private validateResource(resource: any): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Resource-specific validation
    const validators: Record<string, (config: any) => ValidationResult> = {
      'aws_s3_bucket': this.validateS3Bucket.bind(this),
      'aws_instance': this.validateEC2Instance.bind(this),
      'aws_lambda_function': this.validateLambdaFunction.bind(this),
      'aws_dynamodb_table': this.validateDynamoDBTable.bind(this),
    };

    const validator = validators[resource.type];
    if (validator) {
      const validation = validator(resource.config);
      result.errors.push(...validation.errors);
      result.warnings.push(...validation.warnings);
      result.suggestions.push(...validation.suggestions);
    }

    return result;
  }

  private validateS3Bucket(config: any): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };
    
    if (!config.bucket) {
      result.errors.push('S3 bucket name is required');
    }
    
    if (!config.tags) {
      result.warnings.push('Consider adding tags for resource management');
    }
    
    if (!config.versioning) {
      result.suggestions.push('Enable versioning for data protection');
    }
    
    return result;
  }

  private validateEC2Instance(config: any): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };
    
    if (!config.ami) {
      result.errors.push('AMI ID is required for EC2 instance');
    }
    
    if (!config.instance_type) {
      result.errors.push('Instance type is required');
    }
    
    if (config.instance_type === 't2.micro') {
      result.suggestions.push('t2.micro is eligible for AWS Free Tier');
    }
    
    return result;
  }

  private validateLambdaFunction(config: any): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };
    
    if (!config.function_name) {
      result.errors.push('Function name is required');
    }
    
    if (!config.runtime) {
      result.errors.push('Runtime is required');
    }
    
    if (!config.handler) {
      result.errors.push('Handler is required');
    }
    
    return result;
  }

  private validateDynamoDBTable(config: any): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };
    
    if (!config.name) {
      result.errors.push('Table name is required');
    }
    
    if (!config.hash_key) {
      result.errors.push('Hash key is required');
    }
    
    if (!config.billing_mode) {
      result.warnings.push('Consider setting billing_mode to PAY_PER_REQUEST for cost optimization');
    }
    
    return result;
  }

  private checkBestPractices(template: string, resources: any[], result: ValidationResult): void {
    // Check for hardcoded values
    if (template.includes('ami-') && !template.includes('variable')) {
      result.warnings.push('AMI ID is hardcoded - consider using variables or data sources');
    }
    
    // Check for missing provider
    if (!template.includes('provider "aws"')) {
      result.warnings.push('No AWS provider block found - add provider configuration');
    }
    
    // Check for state management
    if (!template.includes('backend') && resources.length > 2) {
      result.suggestions.push('Consider using remote state backend for team collaboration');
    }
    
    // Check for resource naming
    resources.forEach(resource => {
      if (resource.name === 'example' || resource.name === 'test') {
        result.warnings.push(`Resource "${resource.type}.${resource.name}" uses generic name - use descriptive names`);
      }
    });
  }

  private formatValidationResult(result: any): string {
    let output = `Terraform Validation Result\n`;
    output += `Status: ${result.valid ? '✅ Valid' : '❌ Invalid'}\n\n`;

    if (result.errors.length > 0) {
      output += `Errors:\n${result.errors.map((e: string) => `  - ${e}`).join('\n')}\n\n`;
    }

    if (result.warnings.length > 0) {
      output += `Warnings:\n${result.warnings.map((w: string) => `  - ${w}`).join('\n')}\n\n`;
    }

    if (result.suggestions.length > 0) {
      output += `Suggestions:\n${result.suggestions.map((s: string) => `  - ${s}`).join('\n')}\n`;
    }

    return output;
  }
}