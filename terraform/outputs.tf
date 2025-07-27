# Outputs for edge infrastructure
output "s3_bucket_name" {
  description = "Name of the edge backup S3 bucket"
  value       = aws_s3_bucket.edge_backup.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the edge backup S3 bucket"
  value       = aws_s3_bucket.edge_backup.arn
}

output "dynamodb_table_name" {
  description = "Name of the edge device state DynamoDB table"
  value       = aws_dynamodb_table.edge_device_state.name
}

output "dynamodb_table_arn" {
  description = "ARN of the edge device state DynamoDB table"
  value       = aws_dynamodb_table.edge_device_state.arn
}

output "lambda_function_name" {
  description = "Name of the edge processor Lambda function"
  value       = aws_lambda_function.edge_processor.function_name
}

output "lambda_function_arn" {
  description = "ARN of the edge processor Lambda function"
  value       = aws_lambda_function.edge_processor.arn
}

output "iam_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_edge_processor_role.arn
}

output "account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "region" {
  description = "AWS Region"
  value       = var.aws_region
}