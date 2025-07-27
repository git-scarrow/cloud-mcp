#!/bin/bash
# Edge device alert sender for Pipedream webhook
# Run this on your Raspberry Pi devices

WEBHOOK_URL="https://eoiswpghbw14ljk.m.pipedream.net"  # Replace with your actual webhook
DEVICE_ID=$(hostname)

# Function to send alert
send_alert() {
    local alert_type=$1
    local severity=$2
    local message=$3
    
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"resource_id\": \"$DEVICE_ID\",
            \"alert_type\": \"$alert_type\",
            \"severity\": \"$severity\",
            \"message\": \"$message\",
            \"source\": \"edge-monitor\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }"
}

# CPU monitoring
check_cpu() {
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    CPU_INT=${CPU_USAGE%.*}
    
    if [ $CPU_INT -gt 90 ]; then
        send_alert "high_cpu" "Critical" "CPU usage at ${CPU_USAGE}%"
    elif [ $CPU_INT -gt 80 ]; then
        send_alert "high_cpu" "High" "CPU usage at ${CPU_USAGE}%"
    fi
}

# Disk monitoring
check_disk() {
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ $DISK_USAGE -gt 95 ]; then
        send_alert "disk_full" "Critical" "Disk usage at ${DISK_USAGE}%"
    elif [ $DISK_USAGE -gt 85 ]; then
        send_alert "disk_warning" "High" "Disk usage at ${DISK_USAGE}%"
    fi
}

# Memory monitoring
check_memory() {
    MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    
    if [ $MEM_USAGE -gt 90 ]; then
        send_alert "high_memory" "High" "Memory usage at ${MEM_USAGE}%"
    fi
}

# Service health check
check_services() {
    # Check if edge processor is running
    if ! pgrep -f "edge-processor" > /dev/null; then
        send_alert "service_down" "Critical" "Edge processor service is not running"
    fi
}

# Run all checks
check_cpu
check_disk
check_memory
check_services

echo "Health check completed at $(date)"