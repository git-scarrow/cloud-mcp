import { Pool } from 'pg';
import { BaseQueryHandler, QueryOptions } from './base-query.js';

export class OracleMirrorQuery extends BaseQueryHandler {
    name = 'Oracle Mirror Query Handler';
    description = 'Query local PostgreSQL Oracle mirror database';
    private pool: Pool;

    constructor() {
        super();
        
        // Initialize PostgreSQL connection pool for Oracle mirror
        this.pool = new Pool({
            host: '/tmp',  // Unix socket path
            port: 5433,
            database: 'oracle_mirror',
            user: 'oracle_admin',
            // No password required for local socket connection
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // Handle pool errors to prevent crashes
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle PostgreSQL client', err);
        });
    }

    async cleanup(): Promise<void> {
        try {
            await this.pool.end();
        } catch (error) {
            console.error('Error closing PostgreSQL pool:', error);
        }
    }

    async query(query: string, options?: QueryOptions): Promise<string> {
        try {
            const lowerQuery = query.toLowerCase();
            
            if (lowerQuery.includes('status') || lowerQuery.includes('sync')) {
                const syncStatus = await this.getSyncStatus();
                return this.formatResponse(syncStatus, options?.format);
            }
            
            if (lowerQuery.includes('device') || lowerQuery.includes('metric')) {
                const deviceMetrics = await this.getDeviceMetrics();
                return this.formatResponse(deviceMetrics, options?.format);
            }
            
            if (lowerQuery.includes('backup') || lowerQuery.includes('history')) {
                const backupHistory = await this.getBackupHistory();
                return this.formatResponse(backupHistory, options?.format);
            }
            
            if (lowerQuery.includes('schema') || lowerQuery.includes('table')) {
                const schemaInfo = await this.getSchemaInfo();
                return this.formatResponse(schemaInfo, options?.format);
            }

            if (lowerQuery.includes('connect') || lowerQuery.includes('connection')) {
                const connectionInfo = await this.getConnectionInfo();
                return this.formatResponse(connectionInfo, options?.format);
            }

            if (lowerQuery.startsWith('select ') || lowerQuery.startsWith('show ') || lowerQuery.startsWith('describe ')) {
                // Execute raw SQL query (read-only)
                const result = await this.executeQuery(query);
                return this.formatResponse(result, options?.format);
            }
            
            // Default: return overview
            const overview = {
                service: 'Oracle Mirror',
                database: 'oracle_mirror',
                port: 5433,
                location: '/Volumes/Oracle-Mirror/',
                availableQueries: [
                    'status/sync - Get synchronization status',
                    'device/metrics - Get device metrics data',
                    'backup/history - Get backup history',
                    'schema/tables - Get database schema info',
                    'connection - Get connection details',
                    'SELECT ... - Execute raw SQL queries'
                ],
                message: `Query: "${query}" - Use keywords like 'status', 'devices', 'backup', etc.`
            };
            
            return this.formatResponse(overview, options?.format);
            
        } catch (error) {
            console.error('Oracle Mirror Query error:', error);
            return this.formatResponse({
                error: 'Oracle Mirror query failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                query: query,
                suggestion: 'Ensure PostgreSQL is running on port 5433'
            }, options?.format);
        }
    }

    async getSyncStatus(): Promise<any> {
        try {
            const result = await this.pool.query(`
                SELECT 
                    table_name,
                    last_sync_time,
                    record_count,
                    status,
                    EXTRACT(EPOCH FROM (NOW() - last_sync_time))::int as seconds_since_sync
                FROM oracle_mirror.sync_status
                ORDER BY last_sync_time DESC
            `);
            
            return {
                database: 'oracle_mirror',
                port: 5433,
                syncStatus: result.rows,
                summary: {
                    totalTables: result.rows.length,
                    lastSync: result.rows[0]?.last_sync_time || 'Never',
                    allTablesUpToDate: result.rows.every(row => row.status === 'completed')
                }
            };
        } catch (error) {
            throw new Error(`Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getDeviceMetrics(): Promise<any> {
        try {
            const result = await this.pool.query(`
                SELECT 
                    device_id,
                    metric_name,
                    metric_value,
                    timestamp,
                    EXTRACT(EPOCH FROM (NOW() - timestamp))::int as seconds_ago
                FROM edge_data.device_metrics
                ORDER BY timestamp DESC
                LIMIT 50
            `);

            // Group by device
            const deviceGroups = result.rows.reduce((acc: any, row) => {
                if (!acc[row.device_id]) {
                    acc[row.device_id] = [];
                }
                acc[row.device_id].push({
                    metric: row.metric_name,
                    value: row.metric_value,
                    timestamp: row.timestamp,
                    secondsAgo: row.seconds_ago
                });
                return acc;
            }, {});
            
            return {
                database: 'oracle_mirror',
                totalMetrics: result.rows.length,
                devices: deviceGroups,
                summary: {
                    deviceCount: Object.keys(deviceGroups).length,
                    latestMetric: result.rows[0]?.timestamp || 'No data'
                }
            };
        } catch (error) {
            throw new Error(`Failed to get device metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getBackupHistory(): Promise<any> {
        try {
            const result = await this.pool.query(`
                SELECT 
                    backup_id,
                    device_id,
                    backup_path,
                    backup_size,
                    backup_time,
                    status,
                    EXTRACT(EPOCH FROM (NOW() - backup_time))::int as seconds_ago
                FROM edge_data.backup_history
                ORDER BY backup_time DESC
                LIMIT 20
            `);
            
            return {
                database: 'oracle_mirror',
                backupHistory: result.rows,
                summary: {
                    totalBackups: result.rows.length,
                    totalSize: result.rows.reduce((sum, row) => sum + (row.backup_size || 0), 0),
                    latestBackup: result.rows[0]?.backup_time || 'No backups'
                }
            };
        } catch (error) {
            throw new Error(`Failed to get backup history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getSchemaInfo(): Promise<any> {
        try {
            const result = await this.pool.query(`
                SELECT 
                    schemaname,
                    tablename,
                    tableowner,
                    hasindexes,
                    hasrules,
                    hastriggers
                FROM pg_tables 
                WHERE schemaname IN ('oracle_mirror', 'edge_data')
                ORDER BY schemaname, tablename
            `);
            
            return {
                database: 'oracle_mirror',
                port: 5433,
                schemas: {
                    oracle_mirror: result.rows.filter(r => r.schemaname === 'oracle_mirror'),
                    edge_data: result.rows.filter(r => r.schemaname === 'edge_data')
                },
                summary: {
                    totalTables: result.rows.length,
                    oracleMirrorTables: result.rows.filter(r => r.schemaname === 'oracle_mirror').length,
                    edgeDataTables: result.rows.filter(r => r.schemaname === 'edge_data').length
                }
            };
        } catch (error) {
            throw new Error(`Failed to get schema info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getConnectionInfo(): Promise<any> {
        try {
            // Test connection and get database info
            const result = await this.pool.query('SELECT version(), current_database(), current_user, inet_server_addr(), inet_server_port()');
            const row = result.rows[0];
            
            return {
                connectionDetails: {
                    host: 'localhost',
                    port: 5433,
                    database: 'oracle_mirror',
                    user: 'oracle_admin',
                    location: '/Volumes/Oracle-Mirror/'
                },
                databaseInfo: {
                    version: row.version,
                    currentDatabase: row.current_database,
                    currentUser: row.current_user,
                    serverAddress: row.inet_server_addr,
                    serverPort: row.inet_server_port
                },
                connectionCommands: {
                    psql: '/usr/local/opt/postgresql@16/bin/psql -p 5433 -U oracle_admin -d oracle_mirror',
                    management: '/Volumes/Oracle-Mirror/scripts/start-oracle-mirror.sh status',
                    sync: '/Volumes/Oracle-Mirror/scripts/oracle-to-local-sync.sh status'
                },
                status: 'Connected'
            };
        } catch (error) {
            throw new Error(`Failed to get connection info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async executeQuery(sqlQuery: string): Promise<any> {
        try {
            // Security check: only allow SELECT, SHOW, DESCRIBE queries
            const cleanQuery = sqlQuery.trim().toLowerCase();
            if (!cleanQuery.startsWith('select ') && 
                !cleanQuery.startsWith('show ') && 
                !cleanQuery.startsWith('describe ') &&
                !cleanQuery.startsWith('explain ')) {
                throw new Error('Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed');
            }
            
            const result = await this.pool.query(sqlQuery);
            
            return {
                query: sqlQuery,
                rowCount: result.rowCount,
                rows: result.rows,
                fields: result.fields?.map(f => ({
                    name: f.name,
                    dataTypeID: f.dataTypeID
                })) || []
            };
        } catch (error) {
            throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}