# Notion Integration Setup Guide

## Prerequisites
1. A Notion account with access to create integrations
2. Workspaces where you want to create databases

## Step 1: Create a Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Configure your integration:
   - **Name**: "Cloud-Ops Platform"
   - **Associated workspace**: Select your workspace
   - **Capabilities**: 
     - ✅ Read content
     - ✅ Update content
     - ✅ Insert content
   - **User information**: No user information

4. Click "Submit" and copy your **Internal Integration Token**

## Step 2: Create Required Databases

Create these databases in your Notion workspace:

### 1. Cloud Resources Database
Properties:
- **Resource ID** (Title)
- **Provider** (Select: AWS, GCP, DigitalOcean, Edge)
- **Resource Type** (Text)
- **Status** (Select: Active, Stopped, Terminated)
- **Owner** (Text)
- **Cost Monthly** (Number)
- **CPU Usage** (Number)
- **Memory Usage** (Number)
- **Optimization Flag** (Select: Normal, Underutilized, Cost Anomaly, Right-size Candidate)
- **Last Updated** (Date)

### 2. Projects Database
Properties:
- **Project Name** (Title)
- **Project ID** (Text)
- **Budget Monthly** (Number)
- **Current Cost** (Number)
- **Budget Status** (Select: On Track, Warning, Over Budget)
- **Resource Count** (Number)
- **Status** (Select: Active, On Hold, Completed)

### 3. Incidents Database (Optional)
Properties:
- **Incident** (Title)
- **Severity** (Select: Low, Medium, High, Critical)
- **Status** (Select: Open, Investigating, Resolved)
- **Resource ID** (Text)
- **Created** (Date)
- **Resolution** (Text)

### 4. Tasks Database (Optional)
Properties:
- **Task** (Title)
- **Type** (Select: Optimization, Incident, Maintenance)
- **Status** (Select: To Do, In Progress, Done)
- **Assigned To** (Person)
- **Due Date** (Date)

## Step 3: Share Databases with Integration

For each database:
1. Open the database in Notion
2. Click "Share" in the top right
3. Invite your integration (search for "Cloud-Ops Platform")
4. Grant "Can edit" permissions

## Step 4: Get Database IDs

For each database:
1. Open the database in your browser
2. Copy the URL: `https://www.notion.so/workspace/1234567890abcdef?v=...`
3. The database ID is the part after the workspace name and before the `?`
   - In this example: `1234567890abcdef`

## Step 5: Configure Environment Variables

Add these to your `.env` file:

```bash
# Notion Configuration
NOTION_TOKEN=secret_abcdefghijklmnopqrstuvwxyz...
NOTION_RESOURCES_DB_ID=1234567890abcdef
NOTION_PROJECTS_DB_ID=abcdef1234567890
NOTION_INCIDENTS_DB_ID=fedcba0987654321  # Optional
NOTION_TASKS_DB_ID=0987654321fedcba       # Optional
```

## Step 6: Test the Connection

Run this test script:
```bash
python3 test_notion_connection.py
```

## Available Notion Endpoints

Once configured, these endpoints become available:

- `POST /notion/sync` - Sync resources from Oracle to Notion
- `GET /notion/resources` - Get resources from Notion (coming soon)
- `POST /notion/create-incident` - Create incident in Notion (coming soon)
- `POST /notion/create-task` - Create optimization task (coming soon)

## Sync Features

The integration provides:
- **Automatic Updates**: Resource status, costs, and metrics sync to Notion
- **Budget Tracking**: Project budgets and costs visible in Notion
- **Visual Dashboard**: Create Notion views for:
  - Resources by provider
  - Cost optimization opportunities
  - Budget status by project
  - Resource utilization heatmaps