"""
Add Pipedream webhook integration to Flask Cloud Ops API
"""

import requests
from datetime import datetime
import os

PIPEDREAM_WEBHOOK = os.getenv('PIPEDREAM_WEBHOOK_URL')

def send_pipedream_alert(resource_id: str, alert_type: str, severity: str, message: str, metadata: dict = None):
    """Send alert to Pipedream workflow"""
    
    if not PIPEDREAM_WEBHOOK:
        print("Warning: PIPEDREAM_WEBHOOK_URL not configured")
        return False
    
    payload = {
        "resource_id": resource_id,
        "alert_type": alert_type,
        "severity": severity,
        "message": message,
        "source": "cloud-ops-api",
        "timestamp": datetime.utcnow().isoformat(),
        "metadata": metadata or {}
    }
    
    try:
        response = requests.post(PIPEDREAM_WEBHOOK, json=payload, timeout=5)
        return response.status_code == 200
    except Exception as e:
        print(f"Failed to send Pipedream alert: {e}")
        return False


# Add to your Flask routes:

@app.route('/api/edge/<device_id>/health', methods=['POST'])
def edge_health_check(device_id):
    """Endpoint for edge devices to report health"""
    data = request.json
    
    # Check for anomalies
    if data.get('cpu_usage', 0) > 80:
        send_pipedream_alert(
            resource_id=device_id,
            alert_type="high_cpu",
            severity="High" if data['cpu_usage'] > 90 else "Medium",
            message=f"CPU usage at {data['cpu_usage']}%",
            metadata=data
        )
    
    if data.get('disk_usage', 0) > 85:
        send_pipedream_alert(
            resource_id=device_id,
            alert_type="disk_warning",
            severity="Critical" if data['disk_usage'] > 95 else "High",
            message=f"Disk usage at {data['disk_usage']}%",
            metadata=data
        )
    
    return jsonify({"status": "received", "alerts_sent": True})


@app.route('/api/costs/anomaly-check', methods=['GET'])
def check_cost_anomalies():
    """Check for cost anomalies and alert"""
    
    # Query your cost data
    anomalies = []
    
    # Example: Check if any resource increased cost by >20%
    resources = ["pifive0", "piiv", "piiv2"]
    for resource in resources:
        # Mock cost check - replace with actual logic
        cost_increase = 25  # percentage
        
        if cost_increase > 20:
            anomalies.append({
                "resource": resource,
                "increase": cost_increase
            })
            
            send_pipedream_alert(
                resource_id=resource,
                alert_type="cost_anomaly",
                severity="Medium",
                message=f"Cost increased by {cost_increase}% this month",
                metadata={"cost_increase_percent": cost_increase}
            )
    
    return jsonify({
        "anomalies_found": len(anomalies),
        "alerts_sent": len(anomalies) > 0,
        "details": anomalies
    })