#!/usr/bin/env python3
"""
Pipedream Webhook Client
Integrates Cloud-Ops sync service with Pipedream workflows via webhooks
"""

import requests
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

class PipedreamWebhookClient:
    def __init__(self, webhook_urls: Dict[str, str]):
        """
        Initialize webhook client with Pipedream workflow URLs
        
        Args:
            webhook_urls: Dictionary mapping workflow names to webhook URLs
        """
        self.webhook_urls = webhook_urls
        self.logger = logging.getLogger(__name__)
        
    def send_budget_alert(self, budget_data: Dict) -> Dict:
        """Send budget alert to Pipedream workflow"""
        if 'budget_alert' not in self.webhook_urls:
            self.logger.warning("Budget alert webhook URL not configured")
            return {"success": False, "error": "No webhook URL"}
            
        try:
            response = requests.post(
                self.webhook_urls['budget_alert'],
                json=budget_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            
            self.logger.info(f"Budget alert sent successfully: {response.status_code}")
            return {
                "success": True,
                "status_code": response.status_code,
                "response": response.json() if response.content else {}
            }
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Failed to send budget alert: {e}")
            return {"success": False, "error": str(e)}
    
    def send_anomaly_alert(self, anomaly_data: Dict) -> Dict:
        """Send anomaly alert to Pipedream workflow"""
        if 'anomaly_detection' not in self.webhook_urls:
            self.logger.warning("Anomaly detection webhook URL not configured")
            return {"success": False, "error": "No webhook URL"}
            
        try:
            response = requests.post(
                self.webhook_urls['anomaly_detection'],
                json=anomaly_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            
            self.logger.info(f"Anomaly alert sent successfully: {response.status_code}")
            return {
                "success": True,
                "status_code": response.status_code,
                "response": response.json() if response.content else {}
            }
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Failed to send anomaly alert: {e}")
            return {"success": False, "error": str(e)}
    
    def trigger_cost_optimization(self) -> Dict:
        """Trigger cost optimization workflow (normally scheduled, but can be manual)"""
        if 'cost_optimization' not in self.webhook_urls:
            self.logger.warning("Cost optimization webhook URL not configured")
            return {"success": False, "error": "No webhook URL"}
            
        try:
            # Send trigger signal to cost optimization workflow
            trigger_data = {
                "trigger_type": "manual",
                "timestamp": datetime.utcnow().isoformat(),
                "requested_by": "sync_service"
            }
            
            response = requests.post(
                self.webhook_urls['cost_optimization'],
                json=trigger_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            
            self.logger.info(f"Cost optimization triggered successfully: {response.status_code}")
            return {
                "success": True,
                "status_code": response.status_code,
                "response": response.json() if response.content else {}
            }
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Failed to trigger cost optimization: {e}")
            return {"success": False, "error": str(e)}
    
    def send_sync_completion(self, sync_results: Dict) -> Dict:
        """Send sync completion notification with results"""
        if 'sync_completion' not in self.webhook_urls:
            self.logger.info("Sync completion webhook not configured, skipping")
            return {"success": True, "skipped": True}
            
        try:
            response = requests.post(
                self.webhook_urls['sync_completion'],
                json=sync_results,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            
            self.logger.info(f"Sync completion sent successfully: {response.status_code}")
            return {
                "success": True,
                "status_code": response.status_code,
                "response": response.json() if response.content else {}
            }
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Failed to send sync completion: {e}")
            return {"success": False, "error": str(e)}

# Get webhook URLs from configuration
PIPEDREAM_WEBHOOKS = config.get_pipedream_webhooks()

def create_webhook_client() -> PipedreamWebhookClient:
    """Factory function to create configured webhook client"""
    # Filter out None values for unconfigured webhooks
    active_webhooks = {k: v for k, v in PIPEDREAM_WEBHOOKS.items() if v}
    
    if not active_webhooks:
        logger.warning("No Pipedream webhooks configured. Please set webhook URLs in environment.")
    
    return PipedreamWebhookClient(active_webhooks)

# Integration with existing sync service
def integrate_with_sync_service():
    """
    Example integration with the existing sync service
    This shows how to add Pipedream webhook calls to the sync process
    """
    
    webhook_client = create_webhook_client()
    
    # Example: Budget alert integration
    def check_and_alert_budget(project_data):
        budget_utilization = (project_data['current_cost'] / project_data['budget']) * 100
        
        if budget_utilization >= config.BUDGET_WARNING_THRESHOLD * 100:  # Alert threshold
            alert_data = {
                "project_id": project_data['project_id'],
                "current_cost": project_data['current_cost'],
                "budget_monthly": project_data['budget'],
                "utilization_percent": budget_utilization,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            result = webhook_client.send_budget_alert(alert_data)
            if result['success']:
                print(f"Budget alert sent for project {project_data['project_id']}")
            else:
                print(f"Failed to send budget alert: {result['error']}")
    
    # Example: Anomaly detection integration
    def check_and_alert_anomalies(resource_data):
        if resource_data.get('anomaly_score', 0) > config.ANOMALY_WARNING_THRESHOLD:
            anomaly_data = {
                "resource_id": resource_data['resource_id'],
                "resource_uuid": resource_data['resource_uuid'],
                "provider": resource_data['provider'],
                "resource_type": resource_data['resource_type'],
                "anomaly_score": resource_data['anomaly_score'],
                "current_metrics": {
                    "cpu_usage": resource_data.get('cpu_usage_percent', 0),
                    "memory_usage": resource_data.get('memory_usage_percent', 0),
                    "cost_monthly": resource_data.get('cost_monthly', 0)
                },
                "historical_baseline": {
                    "cpu_usage": 50.0,  # Example baseline
                    "memory_usage": 60.0,
                    "cost_monthly": resource_data.get('cost_monthly', 0) * 0.9
                },
                "anomaly_details": {
                    "type": "performance_anomaly",
                    "detected_at": datetime.utcnow().isoformat()
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            result = webhook_client.send_anomaly_alert(anomaly_data)
            if result['success']:
                print(f"Anomaly alert sent for resource {resource_data['resource_id']}")
            else:
                print(f"Failed to send anomaly alert: {result['error']}")
    
    return {
        "check_and_alert_budget": check_and_alert_budget,
        "check_and_alert_anomalies": check_and_alert_anomalies,
        "webhook_client": webhook_client
    }

if __name__ == "__main__":
    # Test webhook client
    client = create_webhook_client()
    
    # Test budget alert
    test_budget_data = {
        "project_id": config.DEFAULT_PROJECT_ID,
        "current_cost": 9.50,
        "budget_monthly": config.MONTHLY_BUDGET,
        "utilization_percent": 95.0,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    print("Testing budget alert webhook...")
    result = client.send_budget_alert(test_budget_data)
    print(f"Result: {result}")
    
    # Test anomaly alert
    test_anomaly_data = {
        "resource_id": "aws-i-1234567890abcdef0",
        "resource_uuid": "i-1234567890abcdef0",
        "provider": "AWS",
        "resource_type": "EC2 Instance",
        "anomaly_score": 0.85,
        "current_metrics": {
            "cpu_usage": 95.0,
            "memory_usage": 88.0,
            "cost_monthly": 12.00
        },
        "historical_baseline": {
            "cpu_usage": 75.0,
            "memory_usage": 68.0,
            "cost_monthly": 8.50
        },
        "anomaly_details": {
            "type": "cpu_spike",
            "detected_at": datetime.utcnow().isoformat()
        },
        "timestamp": datetime.utcnow().isoformat()
    }
    
    print("\nTesting anomaly alert webhook...")
    result = client.send_anomaly_alert(test_anomaly_data)
    print(f"Result: {result}")