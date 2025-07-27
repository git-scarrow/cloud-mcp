# Cloud-Ops Platform Deployment Guide

## Overview
This guide covers deploying the Cloud-Ops Platform to production with proper configuration management.

## Pre-Deployment Checklist

### 1. Configuration Setup

1. Copy the environment template:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and fill in all required values:
   - Oracle database credentials
   - Notion integration token and database IDs
   - Pipedream webhook URLs
   - Notification settings (optional)

3. Validate configuration:
   ```bash
   python setup_production.py
   ```

### 2. Required Environment Variables

#### Critical Settings
- `CLOUD_OPS_ENV`: Set to `production` for production deployment
- `ORACLE_PASSWORD`: Your Oracle Analytics user password
- `NOTION_TOKEN`: Your Notion integration token

#### Database IDs (from Notion)
- `NOTION_RESOURCES_DB_ID`: Resources database ID
- `NOTION_PROJECTS_DB_ID`: Projects database ID  
- `NOTION_INCIDENTS_DB_ID`: Incidents database ID
- `NOTION_TASKS_DB_ID`: Tasks database ID

#### Pipedream Webhooks
- `PIPEDREAM_BUDGET_ALERT_URL`: Budget alert workflow webhook
- `PIPEDREAM_ANOMALY_DETECTION_URL`: Anomaly detection workflow webhook
- `PIPEDREAM_COST_OPTIMIZATION_URL`: Cost optimization workflow webhook
- `PIPEDREAM_SYNC_COMPLETION_URL`: Sync completion workflow webhook (optional)

## Deployment Steps

### 1. Flask API Deployment

#### Option A: Systemd Service (Recommended)
```bash
# Create service file
sudo nano /etc/systemd/system/cloud-ops-api.service
```

```ini
[Unit]
Description=Cloud-Ops API Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/cloud-ops-api
Environment="PATH=/home/ubuntu/.pyenv/shims:/usr/local/bin:/usr/bin"
ExecStart=/home/ubuntu/.pyenv/shims/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable cloud-ops-api
sudo systemctl start cloud-ops-api
```

#### Option B: Docker Deployment
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["python", "app.py"]
```

### 2. Sync Service Deployment

#### Cron Setup
```bash
# Edit crontab
crontab -e

# Add sync schedules
0 * * * * cd /home/ubuntu/cloud-ops-api && /home/ubuntu/.pyenv/shims/python schedule_sync.py hourly
0 2 * * * cd /home/ubuntu/cloud-ops-api && /home/ubuntu/.pyenv/shims/python schedule_sync.py daily
0 3 * * 0 cd /home/ubuntu/cloud-ops-api && /home/ubuntu/.pyenv/shims/python schedule_sync.py weekly
```

### 3. Grafana Stack Deployment

```bash
cd grafana
docker-compose up -d
```

Access Grafana at `http://your-server:3001`

### 4. Pipedream Workflow Setup

1. Import workflow templates from `pipedream/workflows/`
2. Configure each workflow with:
   - HTTP trigger to get webhook URL
   - Environment variables for tokens/keys
   - Connection to your notification channels

3. Update `.env` with the webhook URLs from each workflow

## Post-Deployment Verification

### 1. API Health Check
```bash
curl http://localhost:5001/health
```

### 2. Oracle Connection Test
```bash
python -c "from config import config; import cx_Oracle; print('Oracle OK')"
```

### 3. Notion Sync Test
```bash
python sync_service.py
```

### 4. Webhook Test
```bash
python pipedream/integration/webhook-client.py
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` to version control
2. **Network Security**: 
   - Restrict Oracle access to API server IP
   - Use HTTPS for all webhooks
   - Implement API authentication if exposed

3. **Secrets Management**: Consider using:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets

## Monitoring

1. **Application Logs**:
   ```bash
   journalctl -u cloud-ops-api -f
   ```

2. **Grafana Dashboards**: Monitor at `http://your-server:3001`
   - Cost trends
   - Resource utilization
   - Budget alerts
   - Optimization opportunities

3. **Pipedream Logs**: Check workflow execution history in Pipedream dashboard

## Troubleshooting

### Oracle Connection Issues
- Verify Oracle listener is running
- Check firewall rules for port 1521
- Validate credentials in `.env`

### Notion API Errors
- Regenerate integration token if expired
- Verify database IDs are correct
- Check API rate limits (3 requests/second)

### Pipedream Webhook Failures
- Verify webhook URLs are active
- Check workflow error logs
- Validate JSON payload format

## Backup and Recovery

1. **Oracle Database**: Regular RMAN backups
2. **Configuration**: Backup `.env` securely
3. **Notion Data**: Use Notion's export feature
4. **Grafana Dashboards**: Export dashboard JSON

## Maintenance

### Weekly Tasks
- Review optimization recommendations
- Check budget utilization
- Monitor anomaly alerts

### Monthly Tasks  
- Update cloud resource tags
- Review and adjust thresholds
- Audit access permissions

## Support

For issues or questions:
1. Check application logs
2. Review error messages in Grafana
3. Verify configuration with `setup_production.py`