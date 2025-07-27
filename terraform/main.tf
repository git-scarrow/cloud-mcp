# Terraform configuration for existing edge infrastructure
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource tagging"
  type        = string
  default     = "edge-cluster"
}

# Data sources for existing resources
data "aws_caller_identity" "current" {}

# S3 Bucket for edge backups
resource "aws_s3_bucket" "edge_backup" {
  bucket = "edge-backup-picluster-free"

  tags = {
    Name        = "Edge Backup Bucket"
    Project     = var.project_name
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "edge_backup_lifecycle" {
  bucket = aws_s3_bucket.edge_backup.id

  rule {
    id     = "delete_old_backups"
    status = "Enabled"

    expiration {
      days = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
}

resource "aws_s3_bucket_notification" "edge_backup_notification" {
  bucket = aws_s3_bucket.edge_backup.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.edge_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "devices/"
  }

  depends_on = [aws_lambda_permission.s3_invoke]
}

# DynamoDB table for edge device state
resource "aws_dynamodb_table" "edge_device_state" {
  name           = "edge-device-state"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "deviceId"

  attribute {
    name = "deviceId"
    type = "S"
  }

  tags = {
    Name        = "Edge Device State"
    Project     = var.project_name
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_edge_processor_role" {
  name = "lambda-edge-processor-role"

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

  tags = {
    Name      = "Lambda Edge Processor Role"
    Project   = var.project_name
    ManagedBy = "terraform"
  }
}

resource "aws_iam_role_policy" "lambda_edge_processor_policy" {
  name = "lambda-edge-processor-policy"
  role = aws_iam_role.lambda_edge_processor_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.edge_backup.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.edge_device_state.arn
      }
    ]
  })
}

# Lambda function for edge data processing
resource "aws_lambda_function" "edge_processor" {
  filename         = "edge-processor.zip"
  function_name    = "edge-data-processor"
  role            = aws_iam_role.lambda_edge_processor_role.arn
  handler         = "edge-processor-simple.handler"
  runtime         = "nodejs18.x"
  timeout         = 60

  tags = {
    Name        = "Edge Data Processor"
    Project     = var.project_name
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# Lambda permission for S3 to invoke function
resource "aws_lambda_permission" "s3_invoke" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.edge_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.edge_backup.arn
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "edge_processor_logs" {
  name              = "/aws/lambda/edge-data-processor"
  retention_in_days = 7

  tags = {
    Name        = "Edge Processor Logs"
    Project     = var.project_name
    Environment = "production" 
    ManagedBy   = "terraform"
  }
}