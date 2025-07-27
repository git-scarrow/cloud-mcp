# Quick Setup Guide for Cloud-Ops Platform

## Current Status
✅ AWS Unified MCP server is running on port 3000
❓ Need to configure remaining services

## Required Information

### 1. Oracle Database Password
You need the password for the ANALYTICS user in your Oracle database.

### 2. Notion Setup
1. **Create Notion Integration**:
   - Go to https://www.notion.so/my-integrations
   - Click "New integration"
   - Name it "Cloud-Ops Platform"
   - Select your workspace
   - Copy the "Internal Integration Token"

2. **Create Notion Databases** (or use existing ones):
   - **Resources Database**: Track cloud resources
   - **Projects Database**: Track projects and budgets
   - **Incidents Database**: Track incidents and alerts
   - **Tasks Database**: Track optimization tasks

3. **Get Database IDs**:
   - Open each database in Notion
   - Look at the URL: `https://www.notion.so/xxx?v=yyy`
   - The `xxx` part is your database ID (32 characters)

4. **Share Databases with Integration**:
   - Open each database
   - Click "..." menu → "Add connections"
   - Select your "Cloud-Ops Platform" integration

### 3. Pipedream Webhooks (Optional for now)
You can set these up later:
- Create workflows in Pipedream
- Each workflow needs an HTTP trigger
- Copy the webhook URLs

## Quick Configuration Commands

Once you have the above information, run these commands:

```bash
# Set Oracle password (replace YOUR_PASSWORD)
sed -i '' 's/ORACLE_PASSWORD=.*/ORACLE_PASSWORD=YOUR_PASSWORD/' .env

# Set Notion token (replace YOUR_TOKEN)
sed -i '' 's/NOTION_TOKEN=.*/NOTION_TOKEN=YOUR_TOKEN/' .env

# Set Notion database IDs (replace with your actual IDs)
sed -i '' 's/NOTION_RESOURCES_DB_ID=.*/NOTION_RESOURCES_DB_ID=YOUR_RESOURCES_DB_ID/' .env
sed -i '' 's/NOTION_PROJECTS_DB_ID=.*/NOTION_PROJECTS_DB_ID=YOUR_PROJECTS_DB_ID/' .env
sed -i '' 's/NOTION_INCIDENTS_DB_ID=.*/NOTION_INCIDENTS_DB_ID=YOUR_INCIDENTS_DB_ID/' .env
sed -i '' 's/NOTION_TASKS_DB_ID=.*/NOTION_TASKS_DB_ID=YOUR_TASKS_DB_ID/' .env
```

## Minimal Setup (Just Oracle)

If you want to start with just Oracle monitoring:

```bash
# Set only the Oracle password
sed -i '' 's/ORACLE_PASSWORD=.*/ORACLE_PASSWORD=YOUR_PASSWORD/' .env

# Run validation
python setup_production.py
```

## Next Steps

1. Get the required information above
2. Update your .env file
3. Run: `python setup_production.py`
4. Start the API: `python app.py`
5. Test: `curl http://localhost:5001/health`