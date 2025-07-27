#!/bin/bash

# 1Password to AWS Secrets Manager Sync Script
# Syncs all 1Password items tagged with "aws" to AWS Secrets Manager
# Usage: ./sync-op-to-aws-secrets.sh [--dry-run] [--force]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OP_TAG="aws"
AWS_SECRET_PREFIX="op-aws"
DRY_RUN=false
FORCE=false

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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Show help
show_help() {
    echo "1Password to AWS Secrets Manager Sync Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --dry-run    Show what would be synced without making changes"
    echo "  --force      Overwrite existing AWS secrets"
    echo "  -h, --help   Show this help"
    echo ""
    echo "Configuration:"
    echo "  1Password Tag: $OP_TAG"
    echo "  AWS Secret Prefix: $AWS_SECRET_PREFIX"
    echo ""
    echo "This script will:"
    echo "  1. Find all 1Password items tagged with '$OP_TAG'"
    echo "  2. Create/update corresponding AWS Secrets Manager secrets"
    echo "  3. Use naming convention: $AWS_SECRET_PREFIX-<item-title>"
}

# Check if 1Password CLI is authenticated
check_op_auth() {
    if ! op whoami &>/dev/null; then
        print_warning "1Password CLI not authenticated. Attempting to sign in..."
        if ! op signin --force; then
            print_error "Failed to authenticate with 1Password"
            echo "Please run 'op signin' manually and try again"
            exit 1
        fi
    fi
    print_status "1Password CLI authenticated"
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

# Get 1Password items tagged with specified tag
get_op_items() {
    local tag="$1"
    op item list --tags "$tag" --format json 2>/dev/null || echo "[]"
}

# Get item details from 1Password
get_op_item_details() {
    local item_id="$1"
    op item get "$item_id" --format json 2>/dev/null
}

# Create AWS secret name from 1Password item title
create_secret_name() {
    local title="$1"
    # Convert to lowercase, replace spaces and special chars with hyphens
    echo "${AWS_SECRET_PREFIX}-$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')"
}

# Check if AWS secret exists
secret_exists() {
    local secret_name="$1"
    aws secretsmanager describe-secret --secret-id "$secret_name" &>/dev/null
}

# Create or update AWS secret
sync_to_aws() {
    local secret_name="$1"
    local secret_data="$2"
    local description="$3"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "DRY RUN: Would sync secret '$secret_name'"
        return 0
    fi
    
    if secret_exists "$secret_name"; then
        if [ "$FORCE" = true ]; then
            print_info "Updating existing secret: $secret_name"
            aws secretsmanager update-secret \
                --secret-id "$secret_name" \
                --secret-string "$secret_data" \
                --description "$description" \
                --output table >/dev/null
            print_status "Updated secret: $secret_name"
        else
            print_warning "Secret '$secret_name' already exists (use --force to overwrite)"
        fi
    else
        print_info "Creating new secret: $secret_name"
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --secret-string "$secret_data" \
            --description "$description" \
            --output table >/dev/null
        print_status "Created secret: $secret_name"
    fi
}

# Extract relevant fields from 1Password item
extract_secret_data() {
    local item_json="$1"
    local item_category=$(echo "$item_json" | jq -r '.category')
    
    case "$item_category" in
        "LOGIN")
            # For login items, create JSON with username/password
            local username=$(echo "$item_json" | jq -r '.fields[] | select(.id=="username") | .value // empty')
            local password=$(echo "$item_json" | jq -r '.fields[] | select(.id=="password") | .value // empty')
            local website=$(echo "$item_json" | jq -r '.urls[0].href // empty')
            
            jq -n \
                --arg username "$username" \
                --arg password "$password" \
                --arg website "$website" \
                '{username: $username, password: $password, website: $website}'
            ;;
        "PASSWORD")
            # For password items, store the password directly
            echo "$item_json" | jq -r '.fields[] | select(.id=="password") | .value // empty'
            ;;
        "API_CREDENTIAL")
            # For API credentials, extract all fields as JSON
            echo "$item_json" | jq '{
                username: (.fields[] | select(.id=="username") | .value // null),
                credential: (.fields[] | select(.id=="credential") | .value // null),
                type: (.fields[] | select(.id=="type") | .value // null),
                filename: (.fields[] | select(.id=="filename") | .value // null),
                validFrom: (.fields[] | select(.id=="validFrom") | .value // null),
                expires: (.fields[] | select(.id=="expires") | .value // null),
                hostname: (.fields[] | select(.id=="hostname") | .value // null)
            } | with_entries(select(.value != null and .value != ""))'
            ;;
        "SECURE_NOTE")
            # For secure notes, extract the note text
            echo "$item_json" | jq -r '.fields[] | select(.id=="notesPlain") | .value // empty'
            ;;
        *)
            # For other types, extract all custom fields as JSON
            echo "$item_json" | jq '[.fields[] | select(.value != null and .value != "") | {key: (.label // .id), value: .value}] | from_entries'
            ;;
    esac
}

# Main sync function
sync_op_to_aws() {
    local items_json=$(get_op_items "$OP_TAG")
    local item_count=$(echo "$items_json" | jq length)
    
    if [ "$item_count" -eq 0 ]; then
        print_warning "No 1Password items found with tag '$OP_TAG'"
        return 0
    fi
    
    print_info "Found $item_count 1Password items with tag '$OP_TAG'"
    
    # Process each item
    for i in $(seq 0 $((item_count - 1))); do
        local item=$(echo "$items_json" | jq -r ".[$i]")
        local item_id=$(echo "$item" | jq -r '.id')
        local item_title=$(echo "$item" | jq -r '.title')
        local item_category=$(echo "$item" | jq -r '.category')
        
        print_info "Processing: $item_title ($item_category)"
        
        # Get detailed item information
        local item_details=$(get_op_item_details "$item_id")
        if [ -z "$item_details" ] || [ "$item_details" = "null" ]; then
            print_error "Failed to get details for item: $item_title"
            continue
        fi
        
        # Extract secret data based on item type
        local secret_data=$(extract_secret_data "$item_details")
        if [ -z "$secret_data" ] || [ "$secret_data" = "null" ] || [ "$secret_data" = '""' ]; then
            print_warning "No extractable data found in item: $item_title"
            continue
        fi
        
        # Create AWS secret name
        local secret_name=$(create_secret_name "$item_title")
        local description="Synced from 1Password item: $item_title (Category: $item_category, Tag: $OP_TAG)"
        
        # Sync to AWS
        sync_to_aws "$secret_name" "$secret_data" "$description"
    done
    
    print_status "Sync completed successfully!"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main script execution
main() {
    parse_args "$@"
    
    echo "1Password to AWS Secrets Manager Sync"
    echo "====================================="
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    check_op_auth
    check_aws_config
    sync_op_to_aws
}

# Run main function
main "$@"