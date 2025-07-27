#!/bin/bash

# Edge Device Metrics Pusher for CloudWatch
# Sends CPU, Memory, and Disk metrics to AWS CloudWatch

DEVICE_ID=$(hostname)
NAMESPACE="EdgeDevices"

# Function to get CPU usage
get_cpu_usage() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        ps -A -o %cpu | awk '{s+=$1} END {print s}'
    else
        # Linux (Raspberry Pi)
        top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
    fi
}

# Function to get memory usage
get_memory_usage() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        memory_pressure | grep "System-wide memory free percentage" | awk '{print 100-$5}' | tr -d '%'
    else
        # Linux (Raspberry Pi)
        free | grep Mem | awk '{print ($2-$7)/$2 * 100.0}'
    fi
}

# Function to get disk usage
get_disk_usage() {
    df -h / | tail -1 | awk '{print $5}' | tr -d '%'
}

# Push metrics to CloudWatch
push_metrics() {
    local cpu_usage=$(get_cpu_usage)
    local mem_usage=$(get_memory_usage)
    local disk_usage=$(get_disk_usage)
    
    echo "📊 Pushing metrics for $DEVICE_ID"
    echo "CPU: ${cpu_usage}%"
    echo "Memory: ${mem_usage}%"
    echo "Disk: ${disk_usage}%"
    
    # Push CPU metric
    aws cloudwatch put-metric-data \
        --namespace "$NAMESPACE" \
        --metric-name CPUUtilization \
        --dimensions DeviceId="$DEVICE_ID" \
        --value "$cpu_usage" \
        --unit Percent
    
    # Push Memory metric
    aws cloudwatch put-metric-data \
        --namespace "$NAMESPACE" \
        --metric-name MemoryUtilization \
        --dimensions DeviceId="$DEVICE_ID" \
        --value "$mem_usage" \
        --unit Percent
    
    # Push Disk metric
    aws cloudwatch put-metric-data \
        --namespace "$NAMESPACE" \
        --metric-name DiskUtilization \
        --dimensions DeviceId="$DEVICE_ID" \
        --value "$disk_usage" \
        --unit Percent
    
    # Push heartbeat metric
    aws cloudwatch put-metric-data \
        --namespace "$NAMESPACE" \
        --metric-name Heartbeat \
        --dimensions DeviceId="$DEVICE_ID" \
        --value 1 \
        --unit Count
    
    echo "✅ Metrics pushed successfully"
}

# Main execution
case "$1" in
    once)
        push_metrics
        ;;
    loop)
        echo "Starting metrics push loop (every 5 minutes)..."
        while true; do
            push_metrics
            sleep 300
        done
        ;;
    cron)
        # Add to crontab: */5 * * * * /path/to/edge-metrics-pusher.sh once
        push_metrics
        ;;
    *)
        echo "Usage: $0 {once|loop|cron}"
        echo "  once - Push metrics once and exit"
        echo "  loop - Push metrics every 5 minutes"
        echo "  cron - Push metrics once (for cron job)"
        echo ""
        echo "To install as cron job:"
        echo "  crontab -e"
        echo "  */5 * * * * $0 cron"
        exit 1
        ;;
esac