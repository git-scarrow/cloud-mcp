#!/bin/bash

# AWS Secrets Manager Setup Script
# Usage: ./setup-aws-secrets.sh [command] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity &>/dev/null; then
        print_error "AWS CLI not configured or credentials invalid"
        echo "Run 'aws configure' to set up your credentials"
        exit 1
    fi
    print_status "AWS credentials verified"
}

# Create a new secret
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"
    
    if [ -z "$secret_name" ] || [ -z "$secret_value" ]; then
        print_error "Usage: $0 create <secret-name> <secret-value> [description]"
        exit 1
    fi
    
    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "$secret_name" &>/dev/null; then
        print_warning "Secret '$secret_name' already exists"
        echo "Use 'update' command to modify existing secret"
        exit 1
    fi
    
    # Create the secret
    aws secretsmanager create-secret \
        --name "$secret_name" \
        --description "${description:-Created by setup-aws-secrets.sh}" \
        --secret-string "$secret_value" \
        --output table
    
    print_status "Secret '$secret_name' created successfully"
}

# Update existing secret
update_secret() {
    local secret_name="$1"
    local secret_value="$2"
    
    if [ -z "$secret_name" ] || [ -z "$secret_value" ]; then
        print_error "Usage: $0 update <secret-name> <secret-value>"
        exit 1
    fi
    
    aws secretsmanager update-secret \
        --secret-id "$secret_name" \
        --secret-string "$secret_value" \
        --output table
    
    print_status "Secret '$secret_name' updated successfully"
}

# Retrieve secret value
get_secret() {
    local secret_name="$1"
    
    if [ -z "$secret_name" ]; then
        print_error "Usage: $0 get <secret-name>"
        exit 1
    fi
    
    aws secretsmanager get-secret-value \
        --secret-id "$secret_name" \
        --query SecretString \
        --output text
}

# List all secrets
list_secrets() {
    aws secretsmanager list-secrets \
        --query 'SecretList[*].[Name,Description,LastChangedDate]' \
        --output table
}

# Delete a secret
delete_secret() {
    local secret_name="$1"
    local force="$2"
    
    if [ -z "$secret_name" ]; then
        print_error "Usage: $0 delete <secret-name> [--force]"
        exit 1
    fi
    
    if [ "$force" != "--force" ]; then
        print_warning "This will schedule '$secret_name' for deletion in 30 days"
        read -p "Are you sure? (y/N): " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            echo "Cancelled"
            exit 0
        fi
    fi
    
    aws secretsmanager delete-secret \
        --secret-id "$secret_name" \
        --recovery-window-in-days 30 \
        --output table
    
    print_status "Secret '$secret_name' scheduled for deletion in 30 days"
}

# Create JSON secret (for structured data)
create_json_secret() {
    local secret_name="$1"
    local json_file="$2"
    local description="$3"
    
    if [ -z "$secret_name" ] || [ -z "$json_file" ]; then
        print_error "Usage: $0 create-json <secret-name> <json-file> [description]"
        exit 1
    fi
    
    if [ ! -f "$json_file" ]; then
        print_error "JSON file '$json_file' not found"
        exit 1
    fi
    
    # Validate JSON
    if ! jq empty "$json_file" 2>/dev/null; then
        print_error "Invalid JSON in file '$json_file'"
        exit 1
    fi
    
    aws secretsmanager create-secret \
        --name "$secret_name" \
        --description "${description:-JSON secret created by setup-aws-secrets.sh}" \
        --secret-string file://"$json_file" \
        --output table
    
    print_status "JSON secret '$secret_name' created successfully"
}

# Show help
show_help() {
    echo "AWS Secrets Manager Setup Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  create <name> <value> [description]  Create a new secret"
    echo "  create-json <name> <json-file> [desc] Create secret from JSON file"
    echo "  update <name> <value>                Update existing secret"
    echo "  get <name>                           Retrieve secret value"
    echo "  list                                 List all secrets"
    echo "  delete <name> [--force]              Delete secret (30-day recovery)"
    echo "  help                                 Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 create my-api-key 'sk-1234567890abcdef'"
    echo "  $0 create-json db-config ./db-config.json"
    echo "  $0 get my-api-key"
    echo "  $0 list"
    echo "  $0 delete my-api-key"
}

# Main script logic
main() {
    check_aws_config
    
    case "${1:-help}" in
        "create")
            create_secret "$2" "$3" "$4"
            ;;
        "create-json")
            create_json_secret "$2" "$3" "$4"
            ;;
        "update")
            update_secret "$2" "$3"
            ;;
        "get")
            get_secret "$2"
            ;;
        "list")
            list_secrets
            ;;
        "delete")
            delete_secret "$2" "$3"
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"