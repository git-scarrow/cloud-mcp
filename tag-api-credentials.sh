#!/bin/bash

# Tag all API credentials with "aws" tag
# Usage: ./tag-api-credentials.sh [--dry-run]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}⚠️  DRY RUN MODE - No changes will be made${NC}"
fi

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get all API credential items
api_items=$(op item list --categories "API Credential" --format json)
item_count=$(echo "$api_items" | jq length)

print_info "Found $item_count API credential items"

# Process each item
while IFS=$'\t' read -r item_id title; do
    if [ "$DRY_RUN" = true ]; then
        print_info "DRY RUN: Would tag '$title' with 'aws'"
    else
        # Get existing tags first
        existing_tags=$(op item get "$item_id" --format json | jq -r '.tags[]?' | grep -v '^aws$' | tr '\n' ',' | sed 's/,$//')
        
        # Combine existing tags with aws tag
        if [ -n "$existing_tags" ]; then
            all_tags="aws,$existing_tags"
        else
            all_tags="aws"
        fi
        
        print_info "Tagging '$title' with 'aws' (preserving existing tags)"
        if op item edit "$item_id" --tags "$all_tags" >/dev/null 2>&1; then
            print_status "Tagged: $title"
        else
            print_error "Failed to tag: $title"
        fi
    fi
done < <(echo "$api_items" | jq -r '.[] | "\(.id)\t\(.title)"')

if [ "$DRY_RUN" = false ]; then
    print_status "All API credentials have been tagged with 'aws'"
    print_info "You can now run the sync script: ./sync-op-to-aws-secrets.sh"
fi