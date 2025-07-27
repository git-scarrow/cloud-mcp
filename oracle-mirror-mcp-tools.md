# Oracle Mirror MCP Tools & Capabilities

## 🔧 New MCP Server Tool: `oracle-mirror`

### Connection Details
- **Service**: `oracle-mirror`
- **Database**: PostgreSQL on port 5433
- **Location**: `/Volumes/Oracle-Mirror/`
- **User**: `oracle_admin`

### Available Queries

#### 1. **Sync Status**
```json
{
  "service": "oracle-mirror",
  "query": "status"
}
```
**Returns**: Synchronization status for all mirrored tables

#### 2. **Device Metrics**
```json
{
  "service": "oracle-mirror", 
  "query": "device metrics"
}
```
**Returns**: Latest device metrics from edge Pi cluster

#### 3. **Backup History**
```json
{
  "service": "oracle-mirror",
  "query": "backup history"
}
```
**Returns**: Complete backup history with sizes and timestamps

#### 4. **Schema Information**
```json
{
  "service": "oracle-mirror",
  "query": "schema"
}
```
**Returns**: Database tables and structure information

#### 5. **Connection Info**
```json
{
  "service": "oracle-mirror",
  "query": "connection"
}
```
**Returns**: Database connection details and commands

#### 6. **Raw SQL Queries**
```json
{
  "service": "oracle-mirror",
  "query": "SELECT * FROM edge_data.device_metrics LIMIT 10"
}
```
**Returns**: Results of SELECT queries (read-only)

## 📊 Database Schema

### `oracle_mirror` Schema
- **sync_status**: Track synchronization status of mirrored tables

### `edge_data` Schema  
- **device_metrics**: CPU, memory, disk metrics from Pi devices
- **backup_history**: Backup records with sizes and timestamps

## 🚀 Claude Desktop Usage

### Query Examples

```bash
# Check sync status
"What's the Oracle mirror sync status?"

# View device metrics
"Show me the latest device metrics from the mirror"

# Check backup history
"What backups do we have in the Oracle mirror?"

# Get connection details
"How do I connect to the Oracle mirror database?"

# Run custom SQL
"SELECT device_id, AVG(metric_value) FROM edge_data.device_metrics WHERE metric_name='cpu_usage' GROUP BY device_id"
```

### Multi-Service Queries

```bash
# Compare edge vs mirror data
"Show me edge device status and Oracle mirror sync status"

# Full infrastructure overview
"What's the status across AWS, GCP, edge devices, and Oracle mirror?"
```

## 🔒 Security Features

### Read-Only Access
- Only SELECT, SHOW, DESCRIBE queries allowed
- No INSERT, UPDATE, DELETE operations
- Connection timeouts and pooling

### Connection Management
- PostgreSQL connection pool (max 10 connections)
- 30-second idle timeout
- 2-second connection timeout

## 📈 Integration Benefits

### Unified Monitoring
- **Single API**: Query Oracle mirror alongside AWS/GCP
- **Real-time Data**: Latest sync status and metrics
- **Historical Analysis**: Backup trends and device performance

### MCP Ecosystem
- **Tool Compatibility**: Works with all MCP-enabled applications
- **Format Options**: JSON, Markdown, or plain text responses
- **Error Handling**: Graceful failures with helpful messages

## 🛠️ Management Commands

### Direct Database Access
```bash
# Connect via psql
/usr/local/opt/postgresql@16/bin/psql -p 5433 -U oracle_admin -d oracle_mirror

# Check database status
/Volumes/Oracle-Mirror/scripts/start-oracle-mirror.sh status

# Run sync
/Volumes/Oracle-Mirror/scripts/oracle-to-local-sync.sh sync
```

### MCP Server Usage
```bash
# Start MCP server with Oracle mirror support
npm run start

# Development mode
npm run dev
```

The Oracle mirror is now fully integrated into your AWS Unified MCP Server, providing seamless access to your local PostgreSQL mirror alongside AWS, GCP, and edge device queries!