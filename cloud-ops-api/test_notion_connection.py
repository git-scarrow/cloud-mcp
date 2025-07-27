#!/usr/bin/env python3
"""
Test Notion Integration Connection
Verifies that Notion API token and database IDs are correctly configured
"""

import os
import sys
from notion_client import Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_notion_connection():
    """Test Notion API connection and database access"""
    
    # Get configuration
    token = os.getenv('NOTION_TOKEN')
    resources_db = os.getenv('NOTION_RESOURCES_DB_ID')
    projects_db = os.getenv('NOTION_PROJECTS_DB_ID')
    
    if not token:
        print("❌ NOTION_TOKEN not found in environment variables")
        print("   Please add your Notion integration token to .env file")
        return False
    
    print(f"✅ Notion token found: {token[:10]}...")
    
    # Initialize Notion client
    try:
        notion = Client(auth=token)
        print("✅ Notion client initialized")
    except Exception as e:
        print(f"❌ Failed to initialize Notion client: {e}")
        return False
    
    # Test API connection
    try:
        user = notion.users.me()
        print(f"✅ Connected to Notion as: {user['name']} (Bot)")
    except Exception as e:
        print(f"❌ Failed to connect to Notion API: {e}")
        print("   Check that your integration token is valid")
        return False
    
    # Test database access
    databases_found = 0
    
    if resources_db:
        try:
            db = notion.databases.retrieve(database_id=resources_db)
            print(f"✅ Resources database found: {db['title'][0]['plain_text']}")
            databases_found += 1
            
            # Show properties
            print("   Properties:")
            for prop_name, prop_config in db['properties'].items():
                print(f"     - {prop_name} ({prop_config['type']})")
                
        except Exception as e:
            print(f"❌ Resources database not accessible: {e}")
            print(f"   Database ID: {resources_db}")
            print("   Make sure to share the database with your integration")
    else:
        print("⚠️  NOTION_RESOURCES_DB_ID not configured")
    
    if projects_db:
        try:
            db = notion.databases.retrieve(database_id=projects_db)
            print(f"✅ Projects database found: {db['title'][0]['plain_text']}")
            databases_found += 1
        except Exception as e:
            print(f"❌ Projects database not accessible: {e}")
            print(f"   Database ID: {projects_db}")
    else:
        print("⚠️  NOTION_PROJECTS_DB_ID not configured")
    
    # Summary
    print("\n" + "="*50)
    if databases_found > 0:
        print(f"✅ Notion integration is working! ({databases_found} databases connected)")
        
        # Test creating a sample page
        if resources_db:
            print("\nTesting page creation...")
            try:
                response = notion.pages.create(
                    parent={"database_id": resources_db},
                    properties={
                        "Resource ID": {"title": [{"text": {"content": "test-resource-001"}}]},
                        "Provider": {"select": {"name": "AWS"}},
                        "Resource Type": {"rich_text": [{"text": {"content": "EC2 Instance"}}]},
                        "Status": {"select": {"name": "Active"}},
                        "Cost Monthly": {"number": 10.5}
                    }
                )
                print(f"✅ Test page created successfully!")
                print(f"   Page URL: {response['url']}")
                
                # Clean up test page
                notion.pages.update(
                    page_id=response['id'],
                    archived=True
                )
                print("✅ Test page archived")
                
            except Exception as e:
                print(f"⚠️  Could not create test page: {e}")
                print("   This might be due to missing properties in your database")
        
        return True
    else:
        print("❌ No databases connected. Please configure database IDs in .env")
        return False

def show_example_env():
    """Show example .env configuration"""
    print("\nExample .env configuration:")
    print("-"*50)
    print("""
# Notion Configuration
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_RESOURCES_DB_ID=1234567890abcdef1234567890abcdef
NOTION_PROJECTS_DB_ID=abcdef1234567890abcdef1234567890
NOTION_INCIDENTS_DB_ID=  # Optional
NOTION_TASKS_DB_ID=      # Optional
""")

if __name__ == "__main__":
    print("Cloud-Ops Platform - Notion Integration Test")
    print("="*50)
    
    success = test_notion_connection()
    
    if not success:
        show_example_env()
        sys.exit(1)
    else:
        print("\n🎉 Your Notion integration is ready to use!")
        print("   Run 'curl -X POST http://localhost:5001/notion/sync' to sync data")