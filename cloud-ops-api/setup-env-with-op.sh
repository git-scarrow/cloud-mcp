#!/bin/bash

# Cloud-Ops Platform Environment Setup with 1Password CLI
# This script helps populate .env file with values from 1Password

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Cloud-Ops Platform Environment Setup with 1Password"
echo "====================================================="

# Check if op CLI is installed
if ! command -v op &> /dev/null; then
    echo -e "${RED}❌ 1Password CLI (op) is not installed${NC}"
    echo "Install it from: https://developer.1password.com/docs/cli/get-started/"
    exit 1
fi

# Check if user is signed in to 1Password
if ! op vault list &> /dev/null; then
    echo -e "${YELLOW}🔑 Please sign in to 1Password:${NC}"
    eval $(op signin)
fi

# Create .env from template if it doesn't exist
if [ ! -f .env ]; then
    if [ -f env.example ]; then
        echo "📝 Creating .env from template..."
        cp env.example .env
    else
        echo -e "${RED}❌ No env.example found!${NC}"
        exit 1
    fi
fi

echo -e "\n${GREEN}✓ 1Password CLI ready${NC}"
echo "Let's configure your environment variables..."

# Function to get value from 1Password or prompt user
get_value() {
    local var_name=$1
    local op_reference=$2
    local description=$3
    local default_value=${4:-""}
    
    echo -e "\n${YELLOW}→ ${var_name}${NC}"
    echo "  Description: ${description}"
    
    # Try to get from 1Password if reference provided
    if [ ! -z "$op_reference" ]; then
        echo "  Trying 1Password: ${op_reference}"
        value=$(op read "$op_reference" 2>/dev/null || echo "")
        
        if [ ! -z "$value" ]; then
            echo -e "  ${GREEN}✓ Found in 1Password${NC}"
            # Update .env file
            if grep -q "^${var_name}=" .env; then
                # Use a different delimiter for sed to handle URLs with slashes
                sed -i '' "s|^${var_name}=.*|${var_name}=${value}|" .env
            else
                echo "${var_name}=${value}" >> .env
            fi
            return
        else
            echo "  ⚠️  Not found in 1Password"
        fi
    fi
    
    # Show default if available
    if [ ! -z "$default_value" ]; then
        echo "  Default: ${default_value}"
    fi
    
    # Prompt for manual input
    read -p "  Enter value (or press Enter for default): " manual_value
    
    # Use manual value or default
    final_value="${manual_value:-$default_value}"
    
    if [ ! -z "$final_value" ]; then
        # Update .env file
        if grep -q "^${var_name}=" .env; then
            sed -i '' "s|^${var_name}=.*|${var_name}=${final_value}|" .env
        else
            echo "${var_name}=${final_value}" >> .env
        fi
        echo -e "  ${GREEN}✓ Set${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Skipped (no value provided)${NC}"
    fi
}

# Environment Settings
echo -e "\n📋 Environment Settings"
echo "========================"
get_value "CLOUD_OPS_ENV" "" "Environment (development/staging/production)" "development"

# API Configuration
echo -e "\n🌐 API Configuration"
echo "===================="
get_value "API_HOST" "" "API bind host" "0.0.0.0"
get_value "API_PORT" "" "API port" "5001"

# Oracle Database Configuration
echo -e "\n🗄️  Oracle Database Configuration"
echo "================================="
get_value "ORACLE_HOST" "op://Infrastructure/Oracle-CloudOps/hostname" "Oracle database host" "localhost"
get_value "ORACLE_PORT" "op://Infrastructure/Oracle-CloudOps/port" "Oracle database port" "1521"
get_value "ORACLE_SERVICE" "op://Infrastructure/Oracle-CloudOps/service" "Oracle service name" "FREE"
get_value "ORACLE_USER" "op://Infrastructure/Oracle-CloudOps/username" "Oracle username" "ANALYTICS"
get_value "ORACLE_PASSWORD" "op://Infrastructure/Oracle-CloudOps/password" "Oracle password" ""

# AWS Unified MCP Server
echo -e "\n☁️  AWS Unified MCP Configuration"
echo "================================"
get_value "AWS_UNIFIED_URL" "op://Development/AWS-Unified-MCP/url" "AWS Unified MCP server URL" "http://localhost:3000"
get_value "AWS_UNIFIED_TIMEOUT" "" "Request timeout in seconds" "30"

# Notion Configuration
echo -e "\n📓 Notion Configuration"
echo "======================="
get_value "NOTION_TOKEN" "op://APIs/Notion-CloudOps/credential" "Notion integration token" ""

echo -e "\n${YELLOW}📚 Notion Database IDs${NC}"
echo "To find database IDs:"
echo "1. Open the database in Notion"
echo "2. Look at the URL: https://notion.so/xxx?v=yyy"
echo "3. The database ID is the 'xxx' part (32 characters)"

get_value "NOTION_RESOURCES_DB_ID" "op://APIs/Notion-CloudOps/resources_db_id" "Resources database ID" ""
get_value "NOTION_PROJECTS_DB_ID" "op://APIs/Notion-CloudOps/projects_db_id" "Projects database ID" ""
get_value "NOTION_INCIDENTS_DB_ID" "op://APIs/Notion-CloudOps/incidents_db_id" "Incidents database ID" ""
get_value "NOTION_TASKS_DB_ID" "op://APIs/Notion-CloudOps/tasks_db_id" "Tasks database ID" ""

# Pipedream Webhooks
echo -e "\n🔗 Pipedream Webhook Configuration"
echo "=================================="
echo "To get webhook URLs:"
echo "1. Create/open workflow in Pipedream"
echo "2. Add HTTP trigger"
echo "3. Copy the webhook URL"

get_value "PIPEDREAM_BUDGET_ALERT_URL" "op://APIs/Pipedream-CloudOps/budget_alert_webhook" "Budget alert webhook URL" ""
get_value "PIPEDREAM_ANOMALY_DETECTION_URL" "op://APIs/Pipedream-CloudOps/anomaly_detection_webhook" "Anomaly detection webhook URL" ""
get_value "PIPEDREAM_COST_OPTIMIZATION_URL" "op://APIs/Pipedream-CloudOps/cost_optimization_webhook" "Cost optimization webhook URL" ""
get_value "PIPEDREAM_SYNC_COMPLETION_URL" "op://APIs/Pipedream-CloudOps/sync_completion_webhook" "Sync completion webhook URL (optional)" ""

# Project Configuration
echo -e "\n📊 Project Configuration"
echo "======================="
get_value "DEFAULT_PROJECT_ID" "" "Default project identifier" "cloud-ops-prod"
get_value "MONTHLY_BUDGET" "" "Monthly budget in dollars" "10.0"

# Alert Thresholds
echo -e "\n🚨 Alert Thresholds"
echo "==================="
get_value "BUDGET_WARNING_THRESHOLD" "" "Budget warning threshold (0.75 = 75%)" "0.75"
get_value "BUDGET_CRITICAL_THRESHOLD" "" "Budget critical threshold (0.90 = 90%)" "0.90"
get_value "CPU_UNDERUTILIZED_THRESHOLD" "" "CPU underutilized threshold (%)" "20"
get_value "MEMORY_UNDERUTILIZED_THRESHOLD" "" "Memory underutilized threshold (%)" "30"
get_value "ANOMALY_WARNING_THRESHOLD" "" "Anomaly warning threshold (0-1)" "0.6"
get_value "ANOMALY_CRITICAL_THRESHOLD" "" "Anomaly critical threshold (0-1)" "0.8"

# Notification Settings (Optional)
echo -e "\n📬 Notification Settings (Optional)"
echo "==================================="
get_value "SLACK_WEBHOOK_URL" "op://APIs/Slack-CloudOps/webhook_url" "Slack webhook URL" ""
get_value "ALERT_EMAIL" "op://Personal/CloudOps-Alerts/email" "Alert email address" ""
get_value "PAGERDUTY_INTEGRATION_KEY" "op://APIs/PagerDuty-CloudOps/integration_key" "PagerDuty integration key" ""

# Sync Service Settings
echo -e "\n⏰ Sync Service Settings"
echo "======================="
get_value "SYNC_INTERVAL_HOURS" "" "Hours between metric syncs" "1"
get_value "FULL_SYNC_HOUR" "" "Hour to run full sync (0-23)" "2"
get_value "OPTIMIZATION_DAY" "" "Day for optimization review" "sunday"

# Grafana Settings
echo -e "\n📊 Grafana Settings"
echo "==================="
get_value "GRAFANA_ORACLE_PROXY_URL" "" "Oracle proxy URL for Grafana" "http://oracle-proxy:5002"

echo -e "\n${GREEN}✅ Environment configuration complete!${NC}"
echo -e "\n📋 Next steps:"
echo "1. Review the .env file to ensure all values are correct"
echo "2. Run: python setup_production.py"
echo "3. Follow any additional setup instructions"

# Offer to validate configuration
echo -e "\n${YELLOW}Would you like to validate the configuration now? (y/n)${NC}"
read -p "> " validate_choice

if [[ "$validate_choice" =~ ^[Yy]$ ]]; then
    echo -e "\n🔍 Running configuration validation..."
    python setup_production.py
fi

echo -e "\n${GREEN}✨ Setup complete!${NC}"