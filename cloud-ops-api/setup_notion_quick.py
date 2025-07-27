#!/usr/bin/env python3
"""
Quick Notion Setup Helper
Helps you configure Notion integration step by step
"""

import os
import sys
from pathlib import Path

def setup_notion():
    """Interactive Notion setup"""
    print("Cloud-Ops Platform - Notion Integration Setup")
    print("=" * 50)
    print("\nThis wizard will help you configure Notion integration.\n")
    
    # Check if .env exists
    env_path = Path('.env')
    if not env_path.exists():
        print("❌ .env file not found!")
        print("   Creating one from .env.example...")
        example_path = Path('.env.example')
        if example_path.exists():
            example_path.rename('.env')
        else:
            print("❌ .env.example not found either!")
            return False
    
    # Read current .env
    with open(env_path, 'r') as f:
        env_content = f.read()
    
    print("Step 1: Notion Integration Token")
    print("-" * 30)
    print("1. Go to https://www.notion.so/my-integrations")
    print("2. Create a new integration named 'Cloud-Ops Platform'")
    print("3. Copy the Internal Integration Token")
    print()
    
    token = input("Paste your Notion token (or press Enter to skip): ").strip()
    
    if token:
        # Update token in .env
        if 'NOTION_TOKEN=' in env_content:
            lines = env_content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('NOTION_TOKEN='):
                    lines[i] = f'NOTION_TOKEN={token}'
                    break
            env_content = '\n'.join(lines)
        else:
            env_content += f'\nNOTION_TOKEN={token}'
        
        print("✅ Token configured")
    else:
        print("⚠️  Skipping token configuration")
    
    print("\nStep 2: Database IDs")
    print("-" * 30)
    print("For each database you've created:")
    print("1. Open the database in Notion")
    print("2. Copy the URL")
    print("3. Extract the ID between the workspace name and the '?'")
    print("   Example: notion.so/workspace/1234567890abcdef?v=...")
    print("   Database ID: 1234567890abcdef")
    print()
    
    # Resources Database
    resources_db = input("Resources Database ID (or press Enter to skip): ").strip()
    if resources_db:
        if 'NOTION_RESOURCES_DB_ID=' in env_content:
            lines = env_content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('NOTION_RESOURCES_DB_ID='):
                    lines[i] = f'NOTION_RESOURCES_DB_ID={resources_db}'
                    break
            env_content = '\n'.join(lines)
        else:
            env_content += f'\nNOTION_RESOURCES_DB_ID={resources_db}'
        print("✅ Resources database configured")
    
    # Projects Database
    projects_db = input("Projects Database ID (or press Enter to skip): ").strip()
    if projects_db:
        if 'NOTION_PROJECTS_DB_ID=' in env_content:
            lines = env_content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('NOTION_PROJECTS_DB_ID='):
                    lines[i] = f'NOTION_PROJECTS_DB_ID={projects_db}'
                    break
            env_content = '\n'.join(lines)
        else:
            env_content += f'\nNOTION_PROJECTS_DB_ID={projects_db}'
        print("✅ Projects database configured")
    
    # Write updated .env
    with open(env_path, 'w') as f:
        f.write(env_content)
    
    print("\n" + "=" * 50)
    print("✅ Configuration saved to .env")
    print("\nNext steps:")
    print("1. Make sure to share your databases with the integration")
    print("2. Run: python3 test_notion_connection.py")
    print("3. Restart the API to load new configuration")
    
    return True

if __name__ == "__main__":
    setup_notion()