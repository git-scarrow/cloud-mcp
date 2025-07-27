#!/bin/bash
# Edge device script - runs on Pi cluster
# Optimized for AWS free tier limits

# Configuration
BUCKET="edge-backup-picluster-free"
DEVICE_ID=$(hostname)
AWS_REGION="us-east-1"

# Function to sync only essential data
sync_essential_data() {
    echo "📤 Syncing essential data to S3..."
    
    # Create a small tarball of only critical configs and recent logs
    cd /
    tar czf /tmp/edge-essential.tar.gz \
        --exclude='*.log.*' \
        --exclude='*debug*' \
        etc/kubernetes/manifests/ \
        var/log/syslog \
        home/sam/.kube/config \
        2>/dev/null || true
    
    # Upload with metadata
    aws s3 cp /tmp/edge-essential.tar.gz \
        s3://$BUCKET/edge-data/$DEVICE_ID/essential-$(date +%Y%m%d).tar.gz \
        --storage-class STANDARD_IA \
        --metadata "device=$DEVICE_ID,timestamp=$(date -u +%s)"
    
    # Clean up
    rm -f /tmp/edge-essential.tar.gz
}

# Function to push only anomaly metrics
push_anomaly_metrics() {
    echo "📊 Checking for anomalies..."
    
    CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -f1 -d'%' | cut -f1 -d'.')
    MEM=$(free | grep Mem | awk '{print int(($3/$2) * 100)}')
    
    # Only push to CloudWatch if abnormal (saves API calls)
    if [ $CPU -gt 80 ] || [ $MEM -gt 90 ]; then
        aws cloudwatch put-metric-data \
            --namespace EdgeCluster \
            --metric-name AnomalyDetected \
            --value 1 \
            --dimensions Device=$DEVICE_ID,Type=Resource
    fi
}

# Function to aggregate and compress logs
aggregate_logs() {
    echo "📝 Aggregating logs..."
    
    # Collect only error logs from last hour
    journalctl --since "1 hour ago" --priority=err --no-pager > /tmp/errors.log
    
    # Only upload if there are errors
    if [ -s /tmp/errors.log ]; then
        gzip /tmp/errors.log
        aws s3 cp /tmp/errors.log.gz \
            s3://$BUCKET/edge-data/$DEVICE_ID/errors/$(date +%Y%m%d-%H).log.gz
    fi
    
    rm -f /tmp/errors.log*
}

# Function to sync with rate limiting
rate_limited_sync() {
    # Check if we've synced recently (prevent exceeding free tier)
    LAST_SYNC_FILE="/tmp/last_sync_time"
    CURRENT_TIME=$(date +%s)
    
    if [ -f "$LAST_SYNC_FILE" ]; then
        LAST_SYNC=$(cat $LAST_SYNC_FILE)
        ELAPSED=$((CURRENT_TIME - LAST_SYNC))
        
        # Only sync every 6 hours to stay under S3 PUT limits
        if [ $ELAPSED -lt 21600 ]; then
            echo "⏳ Skipping sync (last sync was $((ELAPSED/60)) minutes ago)"
            return
        fi
    fi
    
    sync_essential_data
    aggregate_logs
    push_anomaly_metrics
    
    echo $CURRENT_TIME > $LAST_SYNC_FILE
}

# Main execution
case "$1" in
    hourly)
        # Run every hour but rate limit
        rate_limited_sync
        ;;
    daily)
        # Daily full sync
        sync_essential_data
        # Clean old local backups
        find /var/backups -name "*.tar.gz" -mtime +3 -delete
        ;;
    alert)
        # Send alert via SNS (only for critical events)
        MESSAGE=$2
        aws sns publish \
            --topic-arn arn:aws:sns:us-east-1:597088031837:edge-alerts \
            --message "$DEVICE_ID: $MESSAGE" \
            --subject "Edge Alert"
        ;;
    *)
        echo "Usage: $0 {hourly|daily|alert <message>}"
        exit 1
        ;;
esac