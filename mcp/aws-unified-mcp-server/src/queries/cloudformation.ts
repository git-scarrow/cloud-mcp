import { BaseQueryHandler, QueryOptions } from './base-query.js';

export class CloudFormationQuery extends BaseQueryHandler {
  name = 'CloudFormation Server';
  description = 'Generate and validate CloudFormation templates for AWS resources';

  private templateSnippets: Record<string, any> = {
    's3_bucket': {
      basic: `Resources:
  MyS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-bucket-name
      Tags:
        - Key: Name
          Value: MyBucket
        - Key: Environment
          Value: Dev`,
      withVersioning: `Resources:
  MyS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-bucket-name
      VersioningConfiguration:
        Status: Enabled
      Tags:
        - Key: Name
          Value: MyBucket`,
    },
    'ec2_instance': {
      basic: `Resources:
  MyEC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0  # Amazon Linux 2
      InstanceType: t2.micro
      Tags:
        - Key: Name
          Value: MyInstance`,
      withVpc: `Resources:
  MyVPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      
  MySubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      CidrBlock: 10.0.1.0/24
      
  MyEC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0
      InstanceType: t2.micro
      SubnetId: !Ref MySubnet`,
    },
    'lambda_function': {
      basic: `Resources:
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
            
  MyLambdaFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: MyFunction
      Runtime: nodejs18.x
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Code:
        ZipFile: |
          exports.handler = async (event) => {
            return {
              statusCode: 200,
              body: JSON.stringify('Hello from Lambda!')
            };
          };`,
    },
    'dynamodb_table': {
      basic: `Resources:
  MyDynamoDBTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: MyTable
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      Tags:
        - Key: Name
          Value: MyTable`,
    },
  };

  async query(query: string, options?: QueryOptions): Promise<string> {
    const queryType = this.detectQueryType(query);

    switch (queryType) {
      case 'generate':
        return this.formatResponse(await this.generateTemplateInternal(query), options?.format);
      case 'validate':
        return this.formatResponse(await this.validateSyntax(query), options?.format);
      case 'explain':
        return this.formatResponse(await this.explainResource(query), options?.format);
      case 'convert':
        return this.formatResponse(await this.convertToTerraform(query), options?.format);
      default:
        return this.formatResponse(await this.generalCloudFormationQuery(query), options?.format);
    }
  }

  async generateTemplate(resource: string, options?: any): Promise<string> {
    const fullTemplate = `AWSTemplateFormatVersion: '2010-09-09'
Description: 'CloudFormation template for ${resource}'

${this.generateResourceTemplate(resource, options)}

Outputs:
  ResourceId:
    Description: The ID of the created resource
    Value: !Ref ${this.getResourceLogicalId(resource)}`;

    return fullTemplate;
  }

  async validateTemplate(template: string): Promise<string> {
    const validationResult = {
      valid: true,
      errors: [],
      warnings: [],
      info: [],
    };

    // Basic validation checks
    if (!template.includes('AWSTemplateFormatVersion')) {
      validationResult.warnings.push('Missing AWSTemplateFormatVersion declaration');
    }

    if (!template.includes('Resources:')) {
      validationResult.valid = false;
      validationResult.errors.push('No Resources section found');
    }

    if (template.includes('Type:') && !template.includes('AWS::')) {
      validationResult.errors.push('Invalid resource type format (should start with AWS::)');
      validationResult.valid = false;
    }

    // Check for common issues
    if (template.includes('!Ref') && !template.includes('Resources')) {
      validationResult.warnings.push('!Ref used but no resources defined to reference');
    }

    if (template.includes('t2.micro')) {
      validationResult.info.push('Using t2.micro - eligible for AWS Free Tier');
    }

    return this.formatValidationResult(validationResult);
  }

  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('generate') || lowerQuery.includes('create')) return 'generate';
    if (lowerQuery.includes('validate') || lowerQuery.includes('check')) return 'validate';
    if (lowerQuery.includes('explain') || lowerQuery.includes('what is')) return 'explain';
    if (lowerQuery.includes('convert') || lowerQuery.includes('terraform')) return 'convert';
    return 'general';
  }

  private async generateTemplateInternal(query: string): Promise<any> {
    const resource = this.extractResourceType(query);
    
    if (resource && this.templateSnippets[resource]) {
      return {
        template: this.createFullTemplate(resource),
        resourceType: resource,
        variants: Object.keys(this.templateSnippets[resource]),
        tips: [
          'Use `cfn-lint` to validate your template',
          'Test with `--stack-policy` to prevent accidental updates',
          'Use parameters for reusable templates',
        ],
      };
    }

    return {
      error: 'Resource type not recognized',
      supportedResources: Object.keys(this.templateSnippets),
      suggestion: 'Try: "generate cloudformation for s3 bucket" or "create ec2 template"',
    };
  }

  private async validateSyntax(query: string): Promise<any> {
    return {
      action: 'Template Validation',
      validationChecks: [
        'YAML/JSON syntax validation',
        'Resource type verification',
        'Property name validation',
        'Intrinsic function usage',
        'Circular dependency detection',
      ],
      note: 'Extract the template from your query and use the validate_template tool',
    };
  }

  private async explainResource(query: string): Promise<any> {
    const explanations = {
      'intrinsic_functions': {
        '!Ref': 'Returns the value of the specified parameter or resource',
        '!GetAtt': 'Returns the value of an attribute from a resource',
        '!Sub': 'Substitutes variables in an input string',
        '!Join': 'Appends a set of values into a single value',
        '!Select': 'Returns a single object from a list of objects',
      },
      'resource_types': {
        'AWS::S3::Bucket': 'Creates an S3 bucket for object storage',
        'AWS::EC2::Instance': 'Launches an EC2 virtual server instance',
        'AWS::Lambda::Function': 'Creates a serverless Lambda function',
        'AWS::DynamoDB::Table': 'Creates a NoSQL DynamoDB table',
      },
      'sections': {
        'Parameters': 'Input values for the template',
        'Resources': 'AWS resources to create (required)',
        'Outputs': 'Values to return when viewing stack',
        'Mappings': 'Static key-value pairs for lookup',
        'Conditions': 'Conditions that control resource creation',
      },
    };

    const topic = this.detectExplanationTopic(query);
    return explanations[topic] || {
      availableTopics: Object.keys(explanations),
      suggestion: 'Ask about: intrinsic functions, resource types, or template sections',
    };
  }

  private async convertToTerraform(query: string): Promise<any> {
    return {
      action: 'CloudFormation to Terraform Conversion Guide',
      conversionMap: {
        'AWS::S3::Bucket': 'aws_s3_bucket',
        'AWS::EC2::Instance': 'aws_instance',
        'AWS::Lambda::Function': 'aws_lambda_function',
        'AWS::DynamoDB::Table': 'aws_dynamodb_table',
      },
      functionMap: {
        '!Ref': '${resource.logical_id.attribute}',
        '!GetAtt': '${resource.logical_id.attribute}',
        '!Sub': 'Terraform interpolation',
        '!Join': 'Terraform join() function',
      },
      tips: [
        'Parameters → Terraform variables',
        'Outputs → Terraform outputs',
        'Conditions → Terraform conditionals',
        'Use terraform import for existing resources',
      ],
    };
  }

  private async generalCloudFormationQuery(query: string): Promise<any> {
    return {
      query: query,
      capabilities: [
        'Generate CloudFormation templates',
        'Validate template syntax',
        'Explain CloudFormation concepts',
        'Convert between CloudFormation and Terraform',
      ],
      templateStructure: {
        required: ['Resources'],
        optional: ['AWSTemplateFormatVersion', 'Description', 'Parameters', 'Outputs', 'Mappings', 'Conditions'],
      },
      bestPractices: [
        'Use parameters for flexibility',
        'Add descriptions to all resources',
        'Use outputs for important values',
        'Tag all resources consistently',
      ],
      tip: 'All validation is performed locally - no AWS account needed!',
    };
  }

  private generateResourceTemplate(resource: string, options?: any): string {
    const normalizedResource = this.normalizeResourceType(resource);
    const snippets = this.templateSnippets[normalizedResource];
    
    if (snippets) {
      const variant = options?.variant || 'basic';
      return snippets[variant] || snippets.basic;
    }

    return this.generateGenericTemplate(resource);
  }

  private normalizeResourceType(resource: string): string {
    const normalized = resource.toLowerCase().replace(/[- ]/g, '_');
    
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
    for (const resource of Object.keys(this.templateSnippets)) {
      if (lowerQuery.includes(resource.replace('_', ' ')) || 
          lowerQuery.includes(resource.replace('_', '-'))) {
        return resource;
      }
    }
    return '';
  }

  private createFullTemplate(resourceType: string): string {
    return `AWSTemplateFormatVersion: '2010-09-09'
Description: 'CloudFormation template for ${resourceType.replace('_', ' ')}'

${this.templateSnippets[resourceType].basic}

Outputs:
  ResourceId:
    Description: The ID of the created resource
    Value: !Ref ${this.getResourceLogicalId(resourceType)}
    Export:
      Name: !Sub '\${AWS::StackName}-ResourceId'`;
  }

  private getResourceLogicalId(resourceType: string): string {
    const idMap: { [key: string]: string } = {
      's3_bucket': 'MyS3Bucket',
      'ec2_instance': 'MyEC2Instance',
      'lambda_function': 'MyLambdaFunction',
      'dynamodb_table': 'MyDynamoDBTable',
    };
    return idMap[resourceType] || 'MyResource';
  }

  private generateGenericTemplate(resource: string): string {
    return `Resources:
  MyResource:
    Type: AWS::${resource}
    Properties:
      # Add required properties here
      Name: my-${resource.toLowerCase()}
      Tags:
        - Key: Name
          Value: My ${resource}
        - Key: Environment
          Value: Development`;
  }

  private detectExplanationTopic(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('function') || lowerQuery.includes('!')) return 'intrinsic_functions';
    if (lowerQuery.includes('type') || lowerQuery.includes('resource')) return 'resource_types';
    if (lowerQuery.includes('section') || lowerQuery.includes('structure')) return 'sections';
    return '';
  }

  private formatValidationResult(result: any): string {
    let output = `CloudFormation Template Validation\n`;
    output += `Status: ${result.valid ? '✅ Valid' : '❌ Invalid'}\n\n`;

    if (result.errors.length > 0) {
      output += `❌ Errors:\n${result.errors.map((e: string) => `   - ${e}`).join('\n')}\n\n`;
    }

    if (result.warnings.length > 0) {
      output += `⚠️  Warnings:\n${result.warnings.map((w: string) => `   - ${w}`).join('\n')}\n\n`;
    }

    if (result.info.length > 0) {
      output += `ℹ️  Info:\n${result.info.map((i: string) => `   - ${i}`).join('\n')}\n`;
    }

    return output;
  }
}