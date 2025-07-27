#!/usr/bin/env python3
"""
Setup Oracle ADB using thin mode (no Oracle Instant Client required)
"""

import os
import sys
import oracledb
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Force thin mode
oracledb.defaults.config_dir = os.path.expanduser("~/.oci/photosight_wallet2")
oracledb.defaults.is_thin_mode = True

def test_thin_connection():
    """Test Oracle ADB connection in thin mode"""
    
    wallet_location = os.path.expanduser("~/.oci/photosight_wallet2")
    
    print("🔧 Oracle Thin Mode Connection Test")
    print("=" * 50)
    print(f"Wallet location: {wallet_location}")
    print(f"Mode: Thin (no Oracle Instant Client required)")
    
    try:
        # Create connection using thin mode
        connection = oracledb.connect(
            user="CLOUD_COMPARE",
            password="CloudCompare2024!",
            dsn="photosightdb_medium",
            config_dir=wallet_location
        )
        
        print("✅ Connected successfully!")
        
        # Test query
        cursor = connection.cursor()
        cursor.execute("SELECT USER, SYS_CONTEXT('USERENV', 'DB_NAME') as DB FROM dual")
        user, db = cursor.fetchone()
        print(f"✅ User: {user}")
        print(f"✅ Database: {db}")
        
        # Check if we can create tables
        cursor.execute("""
            SELECT COUNT(*) 
            FROM user_tables 
            WHERE table_name IN ('CLOUD_RESOURCES', 'CLOUD_METRICS', 'PROJECTS')
        """)
        existing_tables = cursor.fetchone()[0]
        print(f"✅ Existing tables in schema: {existing_tables}")
        
        cursor.close()
        connection.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        
        # Try alternative connection string
        print("\nTrying alternative connection method...")
        try:
            # Read tnsnames.ora to get full connection string
            tnsnames_path = os.path.join(wallet_location, "tnsnames.ora")
            with open(tnsnames_path, 'r') as f:
                tns_content = f.read()
                
            # Extract connection string for photosightdb_medium
            import re
            match = re.search(r'photosightdb_medium\s*=\s*\((.*?)\)\s*\n\n', tns_content, re.DOTALL)
            if match:
                conn_str = match.group(1)
                print("Found connection string in tnsnames.ora")
                
                # Try with full connection descriptor
                dsn = f"(description={conn_str})"
                connection = oracledb.connect(
                    user="CLOUD_COMPARE",
                    password="CloudCompare2024!",
                    dsn=dsn
                )
                
                print("✅ Connected with full descriptor!")
                connection.close()
                return True
                
        except Exception as e2:
            print(f"❌ Alternative method also failed: {e2}")
            
        return False

def create_env_file():
    """Create environment file for thin mode"""
    
    env_content = """# Cloud-Ops Platform - Oracle ADB Thin Mode Configuration

# Environment Settings
CLOUD_OPS_ENV=development

# API Configuration
API_HOST=0.0.0.0
API_PORT=5001

# Oracle ADB Configuration (Thin Mode)
ORACLE_USER=CLOUD_COMPARE
ORACLE_PASSWORD=CloudCompare2024!
ORACLE_SERVICE=photosightdb_medium
ORACLE_WALLET_LOCATION=~/.oci/photosight_wallet2

# Connection mode
ORACLE_THIN_MODE=true

# AWS Unified MCP Server
AWS_UNIFIED_URL=http://localhost:3000
AWS_UNIFIED_TIMEOUT=30

# Project Configuration
DEFAULT_PROJECT_ID=cloud-ops-prod
MONTHLY_BUDGET=10.0

# Alert Thresholds
BUDGET_WARNING_THRESHOLD=0.75
BUDGET_CRITICAL_THRESHOLD=0.90
CPU_UNDERUTILIZED_THRESHOLD=20
MEMORY_UNDERUTILIZED_THRESHOLD=30
ANOMALY_WARNING_THRESHOLD=0.6
ANOMALY_CRITICAL_THRESHOLD=0.8

# Sync Service Settings
SYNC_INTERVAL_HOURS=1
FULL_SYNC_HOUR=2
OPTIMIZATION_DAY=sunday

# Grafana Settings
GRAFANA_ORACLE_PROXY_URL=http://oracle-proxy:5002

# Notion Configuration (to be filled)
NOTION_TOKEN=
NOTION_RESOURCES_DB_ID=
NOTION_PROJECTS_DB_ID=
NOTION_INCIDENTS_DB_ID=
NOTION_TASKS_DB_ID=

# Pipedream Webhooks (to be filled)
PIPEDREAM_BUDGET_ALERT_URL=
PIPEDREAM_ANOMALY_DETECTION_URL=
PIPEDREAM_COST_OPTIMIZATION_URL=
PIPEDREAM_SYNC_COMPLETION_URL=

# Notification Settings (optional)
SLACK_WEBHOOK_URL=
ALERT_EMAIL=
PAGERDUTY_INTEGRATION_KEY=
"""
    
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print("\n✅ Created .env file for thin mode")

if __name__ == "__main__":
    print("🚀 Oracle ADB Thin Mode Setup")
    print("=" * 50)
    
    # Test connection
    if test_thin_connection():
        print("\n✅ Oracle ADB connection successful in thin mode!")
        
        # Update env file
        create_env_file()
        
        print("\n📋 Next steps:")
        print("1. Run: python setup_oracle_adb_schema.py")
        print("2. Run: python setup_production.py")
        print("3. Start API: python app.py")
    else:
        print("\n❌ Could not establish connection")
        print("\nTroubleshooting:")
        print("1. Verify wallet files exist in ~/.oci/photosight_wallet2")
        print("2. Check that cwallet.sso file is present (auto-login wallet)")
        print("3. Ensure the password doesn't contain special characters that need escaping")