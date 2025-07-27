#!/bin/bash

# Automation script for 1Password to AWS Secrets sync
# Usage: ./automate-op-sync.sh [cron|watch|once]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SCRIPT="$SCRIPT_DIR/sync-op-to-aws-secrets.sh"
LOGFILE="$SCRIPT_DIR/op-sync.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Run sync with logging
run_sync() {
    echo "$(date): Starting 1Password to AWS sync..." >> "$LOGFILE"
    if "$SYNC_SCRIPT" --force >> "$LOGFILE" 2>&1; then
        echo "$(date): Sync completed successfully" >> "$LOGFILE"
        print_status "Sync completed successfully"
    else
        echo "$(date): Sync failed" >> "$LOGFILE"
        print_error "Sync failed - check $LOGFILE for details"
        return 1
    fi
}

# Setup cron job
setup_cron() {
    local interval="${1:-30}"  # Default 30 minutes
    local cron_entry="*/$interval * * * * $SCRIPT_DIR/automate-op-sync.sh once"
    
    # Check if cron entry already exists
    if crontab -l 2>/dev/null | grep -q "$SCRIPT_DIR/automate-op-sync.sh"; then
        print_warning "Cron job already exists"
        return 0
    fi
    
    # Add cron entry
    (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
    print_status "Cron job added - syncs every $interval minutes"
    print_status "Logs will be written to: $LOGFILE"
}

# Remove cron job
remove_cron() {
    if crontab -l 2>/dev/null | grep -q "$SCRIPT_DIR/automate-op-sync.sh"; then
        crontab -l 2>/dev/null | grep -v "$SCRIPT_DIR/automate-op-sync.sh" | crontab -
        print_status "Cron job removed"
    else
        print_warning "No cron job found"
    fi
}

# Watch mode (runs continuously)
watch_mode() {
    local interval="${1:-1800}"  # Default 30 minutes (1800 seconds)
    
    print_status "Starting watch mode - syncing every $interval seconds"
    print_status "Press Ctrl+C to stop"
    
    while true; do
        run_sync
        sleep "$interval"
    done
}

# Show help
show_help() {
    echo "1Password to AWS Secrets Automation Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  once                 Run sync once"
    echo "  cron [interval]      Setup cron job (default: 30 minutes)"
    echo "  cron-remove          Remove cron job"
    echo "  watch [seconds]      Run in watch mode (default: 1800 seconds)"
    echo "  logs                 Show recent log entries"
    echo "  help                 Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 once              # Run sync once"
    echo "  $0 cron 15           # Setup cron to run every 15 minutes"
    echo "  $0 watch 600         # Watch mode, sync every 10 minutes"
    echo "  $0 logs              # Show recent logs"
}

# Show logs
show_logs() {
    if [ -f "$LOGFILE" ]; then
        echo "Recent sync logs:"
        echo "=================="
        tail -20 "$LOGFILE"
    else
        print_warning "No log file found at $LOGFILE"
    fi
}

# Main script logic
case "${1:-help}" in
    "once")
        run_sync
        ;;
    "cron")
        setup_cron "$2"
        ;;
    "cron-remove")
        remove_cron
        ;;
    "watch")
        watch_mode "$2"
        ;;
    "logs")
        show_logs
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