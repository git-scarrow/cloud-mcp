#!/usr/bin/env python3
"""
Production Setup and Configuration Validator
Validates all required configuration and helps set up production environment
"""

import os
import sys
from pathlib import Path
from config import config, ProductionConfig, DevelopmentConfig
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_environment():
    """Check and display current environment"""
    env = os.getenv('CLOUD_OPS_ENV', 'development')
    print(f"🔧 Environment: {env}")
    
    if env == 'production':
        print("   Using ProductionConfig (strict validation)")
        return ProductionConfig
    else:
        print("   Using DevelopmentConfig (relaxed validation)")
        return DevelopmentConfig

def validate_configuration(config_class):
    """Validate all required configuration values"""
    print("\n📋 Configuration Validation:")
    
    validations = config_class.validate()
    all_valid = True
    
    for key, is_valid in validations.items():
        status = "✅" if is_valid else "❌"
        print(f"   {status} {key}")
        if not is_valid:
            all_valid = False
    
    # Additional checks
    print("\n📊 Configuration Details:")
    print(f"   Oracle DSN: {config_class.ORACLE_DSN}")
    print(f"   AWS Unified URL: {config_class.AWS_UNIFIED_URL}")
    print(f"   Default Project ID: {config_class.DEFAULT_PROJECT_ID}")
    print(f"   Monthly Budget: ${config_class.MONTHLY_BUDGET}")
    
    # Check Notion databases
    notion_dbs = config_class.get_notion_databases()
    print("\n📚 Notion Databases:")
    for db_name, db_id in notion_dbs.items():
        status = "✅" if db_id else "❌"
        display_id = db_id[:8] + "..." if db_id else "Not configured"
        print(f"   {status} {db_name}: {display_id}")
    
    # Check Pipedream webhooks
    webhooks = config_class.get_pipedream_webhooks()
    print("\n🔗 Pipedream Webhooks:")
    for webhook_name, webhook_url in webhooks.items():
        status = "✅" if webhook_url else "❌"
        display_url = webhook_url[:30] + "..." if webhook_url else "Not configured"
        print(f"   {status} {webhook_name}: {display_url}")
    
    # Check notification settings
    print("\n📬 Notifications:")
    print(f"   Slack: {'✅ Configured' if config_class.SLACK_WEBHOOK_URL else '❌ Not configured'}")
    print(f"   Email: {'✅ ' + config_class.ALERT_EMAIL if config_class.ALERT_EMAIL else '❌ Not configured'}")
    print(f"   PagerDuty: {'✅ Configured' if config_class.PAGERDUTY_INTEGRATION_KEY else '❌ Not configured'}")
    
    return all_valid

def create_env_file():
    """Create .env file from template if it doesn't exist"""
    env_file = Path(".env")
    env_example = Path("env.example")
    
    if not env_file.exists() and env_example.exists():
        print("\n📝 Creating .env file from template...")
        with open(env_example, 'r') as src, open(env_file, 'w') as dst:
            dst.write(src.read())
        print("   ✅ .env file created. Please update with your values.")
        return False
    elif not env_file.exists():
        print("\n⚠️  No .env file found and no template available!")
        return False
    else:
        print("\n✅ .env file exists")
        return True

def check_oracle_connection():
    """Test Oracle database connection"""
    print("\n🗄️  Testing Oracle Connection...")
    try:
        import cx_Oracle
        conn = cx_Oracle.connect(
            user=config.ORACLE_USER,
            password=config.ORACLE_PASSWORD,
            dsn=config.ORACLE_DSN
        )
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM dual")
        cursor.close()
        conn.close()
        print("   ✅ Oracle connection successful")
        return True
    except Exception as e:
        print(f"   ❌ Oracle connection failed: {e}")
        return False

def check_notion_connection():
    """Test Notion API connection"""
    print("\n📓 Testing Notion Connection...")
    if not config.NOTION_TOKEN:
        print("   ❌ Notion token not configured")
        return False
    
    try:
        from notion_client import Client
        notion = Client(auth=config.NOTION_TOKEN)
        # Try to retrieve user info
        user = notion.users.me()
        print(f"   ✅ Notion connection successful (User: {user.get('name', 'Unknown')})")
        return True
    except Exception as e:
        print(f"   ❌ Notion connection failed: {e}")
        return False

def check_aws_unified():
    """Test AWS Unified MCP server connection"""
    print("\n☁️  Testing AWS Unified MCP Server...")
    try:
        import requests
        response = requests.get(f"{config.AWS_UNIFIED_URL}/health", timeout=5)
        if response.status_code == 200:
            print("   ✅ AWS Unified MCP server is accessible")
            return True
        else:
            print(f"   ❌ AWS Unified MCP server returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ AWS Unified MCP server not accessible: {e}")
        return False

def move_test_files():
    """Move test files to a separate directory"""
    print("\n📦 Organizing Test Files...")
    test_files = [
        "test_oracle_mcp.py",
        "test_sync_integration.py", 
        "test_with_sample_data.py",
        "test_edge_mcp.js",
        "test_edge-metrics.js",
        "test_mcp_edge.js",
        "test_real_edge_mcp.js",
        "test_all_improvements.js"
    ]
    
    test_dir = Path("tests")
    test_dir.mkdir(exist_ok=True)
    
    moved_count = 0
    for test_file in test_files:
        if Path(test_file).exists():
            Path(test_file).rename(test_dir / test_file)
            moved_count += 1
            print(f"   ➡️  Moved {test_file} to tests/")
    
    if moved_count > 0:
        print(f"   ✅ Moved {moved_count} test files to tests/ directory")
    else:
        print("   ℹ️  No test files to move")

def generate_deployment_checklist():
    """Generate a deployment checklist"""
    print("\n📋 Deployment Checklist:")
    
    checklist = [
        ("Environment variable CLOUD_OPS_ENV set to 'production'", os.getenv('CLOUD_OPS_ENV') == 'production'),
        ("Oracle password configured", bool(config.ORACLE_PASSWORD)),
        ("Notion token configured", bool(config.NOTION_TOKEN)),
        ("All Notion database IDs configured", all(config.get_notion_databases().values())),
        ("At least one Pipedream webhook configured", any(config.get_pipedream_webhooks().values())),
        ("Oracle connection working", check_oracle_connection()),
        ("Notion connection working", check_notion_connection()),
        ("Test files organized", not Path("test_oracle_mcp.py").exists())
    ]
    
    for item, status in checklist:
        check = "✅" if status else "❌"
        print(f"   {check} {item}")
    
    return all(status for _, status in checklist)

def main():
    """Main setup function"""
    print("🚀 Cloud-Ops Platform Production Setup")
    print("=" * 50)
    
    # Check environment
    config_class = check_environment()
    
    # Create .env if needed
    env_exists = create_env_file()
    if not env_exists:
        print("\n⚠️  Please configure your .env file and run this script again.")
        return
    
    # Validate configuration
    config_valid = validate_configuration(config_class)
    
    # Move test files
    move_test_files()
    
    # Generate deployment checklist
    print("\n" + "=" * 50)
    ready_for_production = generate_deployment_checklist()
    
    print("\n" + "=" * 50)
    if ready_for_production and config_valid:
        print("✅ Platform is ready for production deployment!")
        print("\nNext steps:")
        print("1. Deploy the Flask API (app.py) to your server")
        print("2. Deploy the Grafana stack using docker-compose")
        print("3. Set up the sync service with cron or systemd")
        print("4. Configure Pipedream workflows with the webhook URLs")
    else:
        print("⚠️  Platform needs configuration before production deployment.")
        print("\nPlease address the issues marked with ❌ above.")
        print("\nFor help, refer to:")
        print("- env.example for configuration template")
        print("- README.md for setup instructions")

if __name__ == "__main__":
    main()