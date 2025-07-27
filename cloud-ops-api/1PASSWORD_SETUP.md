# 1Password Setup for Cloud-Ops Platform

This guide helps you organize your Cloud-Ops credentials in 1Password for easy retrieval with the `op` CLI.

## Recommended 1Password Structure

### 1. Create Vaults
- **Infrastructure**: For database and server credentials
- **APIs**: For external service tokens and webhooks
- **Personal**: For notification settings

### 2. Create Items

#### Oracle Database (Vault: Infrastructure)
**Item Name**: `Oracle-CloudOps`
**Item Type**: Database
**Fields**:
- `hostname`: Your Oracle host (e.g., `localhost` or `oracle.example.com`)
- `port`: `1521`
- `service`: `FREE` (or your service name)
- `username`: `ANALYTICS`
- `password`: Your Oracle password

**1Password References**:
```
op://Infrastructure/Oracle-CloudOps/hostname
op://Infrastructure/Oracle-CloudOps/port
op://Infrastructure/Oracle-CloudOps/service
op://Infrastructure/Oracle-CloudOps/username
op://Infrastructure/Oracle-CloudOps/password
```

#### AWS Unified MCP (Vault: Development)
**Item Name**: `AWS-Unified-MCP`
**Item Type**: Login
**Fields**:
- `url`: `http://localhost:3000` (or your MCP server URL)

**1Password Reference**:
```
op://Development/AWS-Unified-MCP/url
```

#### Notion API (Vault: APIs)
**Item Name**: `Notion-CloudOps`
**Item Type**: API Credential
**Fields**:
- `credential`: Your Notion integration token
- `resources_db_id`: Resources database ID (custom field)
- `projects_db_id`: Projects database ID (custom field)
- `incidents_db_id`: Incidents database ID (custom field)
- `tasks_db_id`: Tasks database ID (custom field)

**1Password References**:
```
op://APIs/Notion-CloudOps/credential
op://APIs/Notion-CloudOps/resources_db_id
op://APIs/Notion-CloudOps/projects_db_id
op://APIs/Notion-CloudOps/incidents_db_id
op://APIs/Notion-CloudOps/tasks_db_id
```

#### Pipedream Webhooks (Vault: APIs)
**Item Name**: `Pipedream-CloudOps`
**Item Type**: API Credential
**Fields**:
- `budget_alert_webhook`: Budget alert webhook URL (custom field)
- `anomaly_detection_webhook`: Anomaly webhook URL (custom field)
- `cost_optimization_webhook`: Optimization webhook URL (custom field)
- `sync_completion_webhook`: Sync webhook URL (custom field)

**1Password References**:
```
op://APIs/Pipedream-CloudOps/budget_alert_webhook
op://APIs/Pipedream-CloudOps/anomaly_detection_webhook
op://APIs/Pipedream-CloudOps/cost_optimization_webhook
op://APIs/Pipedream-CloudOps/sync_completion_webhook
```

#### Slack (Vault: APIs)
**Item Name**: `Slack-CloudOps`
**Item Type**: API Credential
**Fields**:
- `webhook_url`: Your Slack webhook URL

**1Password Reference**:
```
op://APIs/Slack-CloudOps/webhook_url
```

#### PagerDuty (Vault: APIs)
**Item Name**: `PagerDuty-CloudOps`
**Item Type**: API Credential
**Fields**:
- `integration_key`: Your PagerDuty integration key

**1Password Reference**:
```
op://APIs/PagerDuty-CloudOps/integration_key
```

#### Alert Email (Vault: Personal)
**Item Name**: `CloudOps-Alerts`
**Item Type**: Secure Note
**Fields**:
- `email`: Your alert email address

**1Password Reference**:
```
op://Personal/CloudOps-Alerts/email
```

## Usage

### 1. Install 1Password CLI
```bash
# macOS
brew install 1password-cli

# Or download from
# https://developer.1password.com/docs/cli/get-started/
```

### 2. Sign in to 1Password
```bash
eval $(op signin)
```

### 3. Test a reference
```bash
# Test reading Oracle password
op read "op://Infrastructure/Oracle-CloudOps/password"
```

### 4. Run setup script
```bash
./setup-env-with-op.sh
```

## Tips

### Finding Database IDs in Notion
1. Open your database in Notion
2. Look at the URL: `https://www.notion.so/workspace/1234567890abcdef1234567890abcdef?v=...`
3. The database ID is the 32-character string after the workspace name

### Getting Pipedream Webhook URLs
1. Create a new workflow in Pipedream
2. Add an HTTP trigger as the first step
3. Copy the unique webhook URL provided
4. Each workflow needs its own HTTP trigger

### Creating Custom Fields in 1Password
1. Edit the item
2. Click "add more" or "+"
3. Choose "text" field type
4. Name it exactly as shown above (e.g., `resources_db_id`)
5. Paste the value

### Testing Your Setup
After adding all items to 1Password, test retrieval:
```bash
# List all your items
op item list

# Read a specific value
op read "op://APIs/Notion-CloudOps/credential"
```

## Security Best Practices

1. **Use unique vaults** for different types of credentials
2. **Limit vault access** to only necessary team members
3. **Enable 2FA** on your 1Password account
4. **Rotate tokens** regularly, especially for production
5. **Use op CLI in scripts** instead of hardcoding values

## Troubleshooting

### "Item not found" errors
- Check vault name spelling (case-sensitive)
- Verify item name matches exactly
- Ensure you have access to the vault

### "Not signed in" errors
```bash
# Sign in again
eval $(op signin)

# Or with specific account
eval $(op signin --account my-account)
```

### Permission errors
- Ensure your 1Password account has access to the vaults
- Check if items are in shared vaults you can access