// AWS Unified MCP Server Usage Examples

// Example 1: Query AWS Knowledge for Best Practices
const bestPracticesQuery = {
  tool: "query_service",
  arguments: {
    service: "knowledge",
    query: "S3 bucket security best practices",
    options: {
      format: "markdown",
      category: "best-practices"
    }
  }
};

// Example 2: Search Multiple Services
const multiServiceSearch = {
  tool: "unified_query",
  arguments: {
    query: "How to optimize Lambda cold starts",
    services: ["knowledge", "documentation"],
    options: {
      format: "text",
      maxResults: 5
    }
  }
};

// Example 3: Generate Terraform Template
const terraformGeneration = {
  tool: "generate_template",
  arguments: {
    type: "terraform",
    resource: "s3_bucket",
    options: {
      variant: "withVersioning"
    }
  }
};

// Example 4: Generate CloudFormation Template
const cloudFormationGeneration = {
  tool: "generate_template",
  arguments: {
    type: "cloudformation",
    resource: "lambda_function"
  }
};

// Example 5: Validate Terraform Configuration
const terraformValidation = {
  tool: "validate_template",
  arguments: {
    type: "terraform",
    template: `
resource "aws_s3_bucket" "example" {
  bucket = "my-bucket-name"
  
  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}`
  }
};

// Example 6: Search AWS Documentation
const docSearch = {
  tool: "search_aws",
  arguments: {
    searchTerm: "EC2 instance types",
    filters: {
      service: "EC2",
      type: "reference"
    }
  }
};

// Example 7: Core Utility - JSON Formatting
const jsonFormat = {
  tool: "query_service",
  arguments: {
    service: "core",
    query: "format json",
    options: {
      format: "json"
    }
  }
};

// Example 8: Core Utility - Generate UUID
const generateUuid = {
  tool: "query_service",
  arguments: {
    service: "core",
    query: "generate uuid"
  }
};

// Example 9: Documentation API Reference
const apiReference = {
  tool: "query_service",
  arguments: {
    service: "documentation",
    query: "DynamoDB API reference",
    options: {
      category: "api"
    }
  }
};

// Example 10: Complex Multi-Service Query
const complexQuery = {
  tool: "unified_query",
  arguments: {
    query: "Setting up a serverless web application with S3, CloudFront, Lambda, and DynamoDB",
    services: ["knowledge", "documentation", "terraform", "cloudformation"],
    options: {
      format: "markdown",
      maxResults: 10
    }
  }
};

// Example 11: CloudFormation Intrinsic Functions
const cfnFunctions = {
  tool: "query_service",
  arguments: {
    service: "cloudformation",
    query: "explain !Ref and !GetAtt functions"
  }
};

// Example 12: Terraform to CloudFormation Comparison
const iacComparison = {
  tool: "unified_query",
  arguments: {
    query: "convert S3 bucket from CloudFormation to Terraform",
    services: ["terraform", "cloudformation"]
  }
};

// Example Response Format
interface QueryResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

// Example: Using with an MCP Client
async function exampleUsage(mcpClient: any) {
  // Query for S3 best practices
  const response = await mcpClient.callTool({
    name: "query_service",
    arguments: {
      service: "knowledge",
      query: "S3 bucket lifecycle policies",
      options: {
        format: "markdown"
      }
    }
  });
  
  console.log(response.content[0].text);
}