#!/bin/bash

# Tag all API credentials with "aws" tag (preserving existing tags)
# Usage: ./tag-api-credentials-fixed.sh [--dry-run]

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

# Get all API credential item IDs
item_ids=($(op item list --categories "API Credential" --format json | jq -r '.[].id'))
item_count=${#item_ids[@]}

print_info "Found $item_count API credential items"

success_count=0
fail_count=0

# Process each item
for item_id in "${item_ids[@]}"; do
    # Get item details
    item_json=$(op item get "$item_id" --format json)
    title=$(echo "$item_json" | jq -r '.title')
    existing_tags=$(echo "$item_json" | jq -r '.tags[]?' | grep -v '^aws$' | tr '\n' ',' | sed 's/,$//' || true)
    
    if [ "$DRY_RUN" = true ]; then
        print_info "DRY RUN: Would tag '$title' with 'aws'"
        ((success_count++))
    else
        # Check if already has aws tag
        if echo "$item_json" | jq -r '.tags[]?' | grep -q '^aws$'; then
            print_info "Already tagged: $title"
            ((success_count++))
            continue
        fi
        
        # Combine existing tags with aws tag
        if [ -n "$existing_tags" ]; then
            all_tags="aws,$existing_tags"
        else
            all_tags="aws"
        fi
        
        print_info "Tagging '$title' with 'aws'"
        if op item edit "$item_id" --tags "$all_tags" >/dev/null 2>&1; then
            print_status "Tagged: $title"
            ((success_count++))
        else
            print_error "Failed to tag: $title"
            ((fail_count++))
        fi
    fi
done

print_status "Completed: $success_count successful, $fail_count failed"

if [ "$DRY_RUN" = false ] && [ "$success_count" -gt 0 ]; then
    print_info "You can now run the sync script: ./sync-op-to-aws-secrets.sh"
fi