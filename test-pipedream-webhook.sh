#!/bin/bash
# Test script for your Pipedream webhook

WEBHOOK_URL="https://eoiswpghbw14ljk.m.pipedream.net"

echo "🧪 Testing Pipedream Webhook: $WEBHOOK_URL"
echo ""

# Test 1: High CPU Alert
echo "1️⃣ Sending High CPU Alert..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "pifive0",
    "alert_type": "high_cpu",
    "severity": "High",
    "message": "CPU usage exceeded 85% for 10 minutes",
    "source": "test-script",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
echo -e "\n"

sleep 2

# Test 2: Disk Full Critical Alert
echo "2️⃣ Sending Disk Full Alert..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "piiv",
    "alert_type": "disk_full",
    "severity": "Critical",
    "message": "Disk usage at 96% - immediate action required",
    "source": "test-script",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
echo -e "\n"

sleep 2

# Test 3: Cost Anomaly Alert
echo "3️⃣ Sending Cost Anomaly Alert..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "piiv2",
    "alert_type": "cost_anomaly",
    "severity": "Medium",
    "message": "Monthly cost increased by 35% compared to last month",
    "source": "test-script",
    "metadata": {
      "current_cost": 45.20,
      "previous_cost": 33.50,
      "increase_percent": 35
    },
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
echo -e "\n"

sleep 2

# Test 4: Service Down Alert
echo "4️⃣ Sending Service Down Alert..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "pifive0",
    "alert_type": "service_down",
    "severity": "Critical",
    "message": "Edge processor service is not responding",
    "source": "test-script",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
echo -e "\n"

echo "✅ All test alerts sent!"
echo ""
echo "Check your Pipedream workflow at:"
echo "https://pipedream.com/@/p_wOCvRxL"
echo ""
echo "You should see 4 executions in the workflow history."