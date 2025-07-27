"""
Cloud-Ops Platform Configuration
Central configuration management for all services
"""

import os
from typing import Dict, Optional
import json
from pathlib import Path


class Config:
    """Base configuration class with common settings"""
    
    # Environment
    ENV = os.getenv('CLOUD_OPS_ENV', 'development')
    DEBUG = ENV == 'development'
    
    # API Configuration
    API_HOST = os.getenv('API_HOST', '0.0.0.0')
    API_PORT = int(os.getenv('API_PORT', 5001))
    
    # Oracle Database
    ORACLE_HOST = os.getenv('ORACLE_HOST', 'localhost')
    ORACLE_PORT = int(os.getenv('ORACLE_PORT', 1521))
    ORACLE_SERVICE = os.getenv('ORACLE_SERVICE', 'FREE')
    ORACLE_USER = os.getenv('ORACLE_USER', 'ANALYTICS')
    ORACLE_PASSWORD = os.getenv('ORACLE_PASSWORD')
    
    # Oracle ADB Wallet Configuration
    ORACLE_WALLET_LOCATION = os.getenv('ORACLE_WALLET_LOCATION')
    ORACLE_WALLET_PASSWORD = os.getenv('ORACLE_WALLET_PASSWORD')
    
    # Determine DSN based on wallet configuration
    if ORACLE_WALLET_LOCATION:
        # For ADB with wallet, use TNS alias from wallet
        ORACLE_DSN = os.getenv('ORACLE_SERVICE', 'photosightdb_medium')
    else:
        # For standard Oracle, construct DSN
        ORACLE_DSN = f"{ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SERVICE}"
    
    # AWS Configuration
    AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    
    # AWS Unified MCP Server
    AWS_UNIFIED_URL = os.getenv('AWS_UNIFIED_URL', 'http://localhost:3002')
    AWS_UNIFIED_TIMEOUT = int(os.getenv('AWS_UNIFIED_TIMEOUT', 30))
    
    # Notion Configuration
    NOTION_TOKEN = os.getenv('NOTION_TOKEN')
    NOTION_RESOURCES_DB_ID = os.getenv('NOTION_RESOURCES_DB_ID')
    NOTION_PROJECTS_DB_ID = os.getenv('NOTION_PROJECTS_DB_ID')
    NOTION_INCIDENTS_DB_ID = os.getenv('NOTION_INCIDENTS_DB_ID')
    NOTION_TASKS_DB_ID = os.getenv('NOTION_TASKS_DB_ID')
    
    # Pipedream Webhooks
    PIPEDREAM_BUDGET_ALERT_URL = os.getenv('PIPEDREAM_BUDGET_ALERT_URL')
    PIPEDREAM_ANOMALY_DETECTION_URL = os.getenv('PIPEDREAM_ANOMALY_DETECTION_URL')
    PIPEDREAM_COST_OPTIMIZATION_URL = os.getenv('PIPEDREAM_COST_OPTIMIZATION_URL')
    PIPEDREAM_SYNC_COMPLETION_URL = os.getenv('PIPEDREAM_SYNC_COMPLETION_URL')
    
    # Project Configuration
    DEFAULT_PROJECT_ID = os.getenv('DEFAULT_PROJECT_ID', 'cloud-ops-prod')
    MONTHLY_BUDGET = float(os.getenv('MONTHLY_BUDGET', 10.0))
    
    # Alert Thresholds
    BUDGET_WARNING_THRESHOLD = float(os.getenv('BUDGET_WARNING_THRESHOLD', 0.75))
    BUDGET_CRITICAL_THRESHOLD = float(os.getenv('BUDGET_CRITICAL_THRESHOLD', 0.90))
    CPU_UNDERUTILIZED_THRESHOLD = int(os.getenv('CPU_UNDERUTILIZED_THRESHOLD', 20))
    MEMORY_UNDERUTILIZED_THRESHOLD = int(os.getenv('MEMORY_UNDERUTILIZED_THRESHOLD', 30))
    ANOMALY_WARNING_THRESHOLD = float(os.getenv('ANOMALY_WARNING_THRESHOLD', 0.6))
    ANOMALY_CRITICAL_THRESHOLD = float(os.getenv('ANOMALY_CRITICAL_THRESHOLD', 0.8))
    
    # Notification Settings
    SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')
    ALERT_EMAIL = os.getenv('ALERT_EMAIL')
    PAGERDUTY_INTEGRATION_KEY = os.getenv('PAGERDUTY_INTEGRATION_KEY')
    
    # Sync Service Settings
    SYNC_INTERVAL_HOURS = int(os.getenv('SYNC_INTERVAL_HOURS', 1))
    FULL_SYNC_HOUR = int(os.getenv('FULL_SYNC_HOUR', 2))  # 2 AM
    OPTIMIZATION_DAY = os.getenv('OPTIMIZATION_DAY', 'sunday')
    
    # Grafana Settings
    GRAFANA_ORACLE_PROXY_URL = os.getenv('GRAFANA_ORACLE_PROXY_URL', 'http://oracle-proxy:5002')
    
    @classmethod
    def get_pipedream_webhooks(cls) -> Dict[str, Optional[str]]:
        """Get all Pipedream webhook URLs as a dictionary"""
        return {
            "budget_alert": cls.PIPEDREAM_BUDGET_ALERT_URL,
            "anomaly_detection": cls.PIPEDREAM_ANOMALY_DETECTION_URL,
            "cost_optimization": cls.PIPEDREAM_COST_OPTIMIZATION_URL,
            "sync_completion": cls.PIPEDREAM_SYNC_COMPLETION_URL
        }
    
    @classmethod
    def get_notion_databases(cls) -> Dict[str, Optional[str]]:
        """Get all Notion database IDs as a dictionary"""
        return {
            "resources": cls.NOTION_RESOURCES_DB_ID,
            "projects": cls.NOTION_PROJECTS_DB_ID,
            "incidents": cls.NOTION_INCIDENTS_DB_ID,
            "tasks": cls.NOTION_TASKS_DB_ID
        }
    
    @classmethod
    def validate(cls) -> Dict[str, bool]:
        """Validate required configuration values"""
        validations = {
            "oracle_password": bool(cls.ORACLE_PASSWORD),
            "notion_token": bool(cls.NOTION_TOKEN),
            "notion_resources_db": bool(cls.NOTION_RESOURCES_DB_ID),
            "notion_projects_db": bool(cls.NOTION_PROJECTS_DB_ID),
            "pipedream_webhooks": any(cls.get_pipedream_webhooks().values()),
        }
        return validations
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production environment"""
        return cls.ENV == 'production'
    
    @classmethod
    def load_from_file(cls, config_file: str = '.env.json'):
        """Load configuration from JSON file (alternative to env vars)"""
        config_path = Path(config_file)
        if config_path.exists():
            with open(config_path, 'r') as f:
                config_data = json.load(f)
                for key, value in config_data.items():
                    if hasattr(cls, key):
                        setattr(cls, key, value)


class DevelopmentConfig(Config):
    """Development-specific configuration"""
    DEBUG = True
    SYNC_INTERVAL_HOURS = 24  # Less frequent in dev
    

class ProductionConfig(Config):
    """Production-specific configuration"""
    DEBUG = False
    
    @classmethod
    def validate(cls) -> Dict[str, bool]:
        """Stricter validation for production"""
        validations = super().validate()
        
        # Additional production requirements
        validations["all_pipedream_webhooks"] = all(cls.get_pipedream_webhooks().values())
        validations["all_notion_databases"] = all(cls.get_notion_databases().values())
        validations["notifications_configured"] = bool(cls.SLACK_WEBHOOK_URL or cls.ALERT_EMAIL)
        
        return validations


def get_config():
    """Factory function to get appropriate config based on environment"""
    env = os.getenv('CLOUD_OPS_ENV', 'development')
    
    if env == 'production':
        return ProductionConfig
    else:
        return DevelopmentConfig


# Convenience instance
config = get_config()