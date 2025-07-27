import { BaseQueryHandler } from './base-query.js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

export interface EdgeDevice {
  deviceId: string;
  lastSeen: string;
  status: 'online' | 'offline' | 'degraded';
  metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
  };
  recentBackups: string[];
  sshStatus?: 'connected' | 'failed' | 'timeout';
  uptime?: string;
  loadAverage?: string;
}

interface SSHProcess {
  process: ChildProcess;
  deviceId: string;
  timeout: NodeJS.Timeout;
  promise: Promise<{ status: 'connected' | 'failed' | 'timeout'; uptime?: string; loadAverage?: string; error?: string; }>;
}

class SSHProcessPool {
  private activeProcesses: Map<string, SSHProcess> = new Map();
  private maxProcesses: number;
  private processTimeout: number;

  constructor() {
    // Make pool size configurable via environment variable
    this.maxProcesses = parseInt(process.env.MCP_SSH_POOL_SIZE || '3');
    if (isNaN(this.maxProcesses) || this.maxProcesses < 1) {
      this.maxProcesses = 3; // Default fallback
    }
    
    // Make timeout configurable as well
    this.processTimeout = parseInt(process.env.MCP_SSH_TIMEOUT || '8000');
    if (isNaN(this.processTimeout) || this.processTimeout < 1000) {
      this.processTimeout = 8000; // Default 8 seconds
    }
    
    console.log(`🔧 SSH Process Pool initialized: max=${this.maxProcesses} processes, timeout=${this.processTimeout}ms`);
  }

  async executeSSHCommand(deviceId: string): Promise<{
    status: 'connected' | 'failed' | 'timeout';
    uptime?: string;
    loadAverage?: string;
    error?: string;
  }> {
    // Check if we already have a process for this device
    const existingProcess = this.activeProcesses.get(deviceId);
    if (existingProcess) {
      return existingProcess.promise;
    }

    // Check pool capacity
    if (this.activeProcesses.size >= this.maxProcesses) {
      return {
        status: 'failed',
        error: 'SSH process pool at capacity'
      };
    }

    return new Promise((resolve) => {
      let resolved = false;
      let stdout = '';
      let stderr = '';

      // Spawn SSH process with strict timeout controls
      const sshProcess = spawn('ssh', [
        '-o', 'ConnectTimeout=3',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ServerAliveInterval=2',
        '-o', 'ServerAliveCountMax=1',
        `sam@${deviceId}`,
        'echo "online" && uptime'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      // Set up timeout with guaranteed cleanup
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.forceKillProcess(sshProcess, deviceId);
          this.activeProcesses.delete(deviceId);
          resolve({
            status: 'timeout',
            error: 'SSH connection timeout'
          });
        }
      }, this.processTimeout);

      // Promise for tracking this operation
      const promise = new Promise<{
        status: 'connected' | 'failed' | 'timeout';
        uptime?: string;
        loadAverage?: string;
        error?: string;
      }>((promiseResolve) => {
        // Setup data handlers
        sshProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        sshProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        // Process completion handler
        sshProcess.on('close', (code) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.activeProcesses.delete(deviceId);

            if (code === 0 && stdout.trim()) {
              const lines = stdout.trim().split('\n');
              if (lines.length >= 2 && lines[0].includes('online')) {
                const uptimeLine = lines[1].trim();
                let loadAverage = 'unknown';
                
                if (uptimeLine.includes('load average:')) {
                  loadAverage = uptimeLine.split('load average:')[1].trim();
                }
                
                const result = {
                  status: 'connected' as const,
                  uptime: uptimeLine,
                  loadAverage
                };
                promiseResolve(result);
                resolve(result);
                return;
              }
            }

            const result = {
              status: 'failed' as const,
              error: stderr || `SSH process exited with code ${code}`
            };
            promiseResolve(result);
            resolve(result);
          }
        });

        // Error handler
        sshProcess.on('error', (error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.activeProcesses.delete(deviceId);
            
            const result = {
              status: 'failed' as const,
              error: error.message
            };
            promiseResolve(result);
            resolve(result);
          }
        });
      });

      // Track this process
      this.activeProcesses.set(deviceId, {
        process: sshProcess,
        deviceId,
        timeout,
        promise
      });
    });
  }

  private forceKillProcess(process: ChildProcess, deviceId: string): void {
    try {
      if (process.pid) {
        // Try graceful termination first
        process.kill('SIGTERM');
        
        // Force kill after 1 second if still alive
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
            console.warn(`Force killed SSH process for device ${deviceId} (PID: ${process.pid})`);
          }
        }, 1000);
      }
    } catch (error) {
      console.error(`Error killing SSH process for device ${deviceId}:`, error);
    }
  }

  // Cleanup method for graceful shutdown
  cleanup(): void {
    console.log(`🧹 Cleaning up ${this.activeProcesses.size} SSH processes...`);
    
    for (const [deviceId, sshProcess] of this.activeProcesses.entries()) {
      clearTimeout(sshProcess.timeout);
      this.forceKillProcess(sshProcess.process, deviceId);
    }
    
    this.activeProcesses.clear();
    console.log('✅ SSH process pool cleanup complete');
  }

  // Health check method
  getStatus(): { active: number; max: number; devices: string[] } {
    return {
      active: this.activeProcesses.size,
      max: this.maxProcesses,
      devices: Array.from(this.activeProcesses.keys())
    };
  }
}

export class EdgeQuery extends BaseQueryHandler {
  name = 'edge';
  description = 'Query edge devices and hybrid cloud-edge infrastructure';
  private s3Client: S3Client;
  private dynamoClient: DynamoDBDocumentClient;
  private cloudWatchClient: CloudWatchClient;
  private execAsync = promisify(exec);
  private sshPool: SSHProcessPool;
  
  constructor() {
    super();
    this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.dynamoClient = DynamoDBDocumentClient.from(ddbClient);
    this.cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.sshPool = new SSHProcessPool();
  }

  // Cleanup method for graceful shutdown
  async cleanup(): Promise<void> {
    console.log('🧹 EdgeQuery cleanup starting...');
    this.sshPool.cleanup();
    console.log('✅ EdgeQuery cleanup complete');
  }

  private async checkSSHConnectivity(deviceId: string): Promise<{
    status: 'connected' | 'failed' | 'timeout';
    uptime?: string;
    loadAverage?: string;
    error?: string;
  }> {
    // Use the process pool for safe SSH connectivity checks
    return this.sshPool.executeSSHCommand(deviceId);
  }

  async query(query: string, options?: any): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('device') && (lowerQuery.includes('status') || lowerQuery.includes('health'))) {
      return this.getDeviceStatus(options?.deviceIds);
    }
    
    if (lowerQuery.includes('metric') || lowerQuery.includes('performance')) {
      return this.getEdgeMetrics(options?.deviceId, options?.timeRange);
    }
    
    if (lowerQuery.includes('backup') || lowerQuery.includes('file') || lowerQuery.includes('sync')) {
      return this.getBackupStatus(options?.deviceId);
    }
    
    if (lowerQuery.includes('cost') || lowerQuery.includes('optimize')) {
      return this.analyzeCosts();
    }
    
    return this.getOverview();
  }

  async getDeviceStatus(deviceIds?: string[]): Promise<string> {
    try {
      const devices: EdgeDevice[] = [];
      const targetDevices = deviceIds || ['pifive0', 'piiv', 'piiv2'];
      
      // Query S3 for backup status
      const bucketName = process.env.S3_BUCKET || 'edge-backup-picluster-free';
      
      for (const deviceId of targetDevices) {
        const device: EdgeDevice = {
          deviceId,
          lastSeen: new Date().toISOString(),
          status: 'offline',
          recentBackups: []
        };
        
        // First, check SSH connectivity for real-time status
        const sshResult = await this.checkSSHConnectivity(deviceId);
        device.sshStatus = sshResult.status;
        device.uptime = sshResult.uptime;
        device.loadAverage = sshResult.loadAverage;
        
        // Set status based on SSH connectivity
        if (sshResult.status === 'connected') {
          device.status = 'online';
          device.lastSeen = new Date().toISOString();
        } else if (sshResult.status === 'timeout') {
          device.status = 'degraded';
        } else {
          device.status = 'offline';
        }
        
        try {
          // List recent backups from S3 (for backup status info)
          const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: `edge-data/${deviceId}/`,
            MaxKeys: 10
          });
          
          const response = await this.s3Client.send(command);
          
          if (response.Contents && response.Contents.length > 0) {
            // Sort by LastModified descending
            const sortedContents = response.Contents
              .filter(obj => obj.Key && !obj.Key.endsWith('/'))
              .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));
            
            // Get recent backup names
            device.recentBackups = sortedContents
              .slice(0, 3)
              .map(obj => obj.Key?.split('/').pop() || '')
              .filter(name => name);
          }
          
          devices.push(device);
          
        } catch (error) {
          // If S3 query fails for a device, still add it with SSH status
          devices.push(device);
        }
      }
      
      const filteredDevices = devices;
      
      // Format output
      let output = '# Edge Device Status\\n\\n';
      output += '| Device | Status | Last Seen | Recent Activity |\\n';
      output += '|--------|--------|-----------|-----------------|\\n';
      
      for (const device of filteredDevices) {
        const timeSince = device.status === 'online' ? 'now' : this.formatTimeSince(device.lastSeen);
        const statusIcon = device.status === 'online' ? '🟢' : 
                          device.status === 'degraded' ? '🟡' : '🔴';
        
        let activity = `${device.recentBackups.length} backups`;
        if (device.loadAverage && device.status === 'online') {
          activity += `, load: ${device.loadAverage}`;
        }
        
        output += `| ${device.deviceId} | ${statusIcon} ${device.status} | ${timeSince} | ${activity} |\\n`;
      }
      
      // Add detailed status section
      output += '\\n\\n# Edge Device Details\\n\\n';
      for (const device of filteredDevices) {
        output += `## ${device.deviceId}\\n`;
        output += `**SSH Status**: ${device.sshStatus}\\n`;
        if (device.uptime) {
          output += `**Uptime**: ${device.uptime}\\n`;
        }
        if (device.loadAverage) {
          output += `**Load Average**: ${device.loadAverage}\\n`;
        }
        output += `**Backups**: ${device.recentBackups.length} recent\\n\\n`;
      }
      
      return output;
      
    } catch (error) {
      return `Error querying edge devices: ${error}`;
    }
  }

  async getEdgeMetrics(deviceId?: string, timeRange = '1h'): Promise<string> {
    let output = `# Edge Metrics${deviceId ? ` for ${deviceId}` : ''} (${timeRange})\\n\\n`;
    
    // Parse time range
    const hours = parseInt(timeRange) || 1;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
    
    const targetDevices = deviceId ? [deviceId] : ['pifive0', 'piiv', 'piiv2'];
    
    try {
      output += '## CloudWatch Metrics\\n\\n';
      
      let totalAnomalies = 0;
      const metricsData: Record<string, any> = {};
      
      // Query CloudWatch for each device
      for (const device of targetDevices) {
        metricsData[device] = {
          cpu: null,
          memory: null,
          disk: null,
          network: null
        };
        
        // Query CPU utilization
        try {
          const cpuCommand = new GetMetricStatisticsCommand({
            Namespace: 'EdgeDevices',
            MetricName: 'CPUUtilization',
            Dimensions: [{ Name: 'DeviceId', Value: device }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300, // 5 minutes
            Statistics: ['Average', 'Maximum']
          });
          
          const cpuResponse = await this.cloudWatchClient.send(cpuCommand);
          if (cpuResponse.Datapoints && cpuResponse.Datapoints.length > 0) {
            const avgCpu = cpuResponse.Datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / cpuResponse.Datapoints.length;
            const maxCpu = Math.max(...cpuResponse.Datapoints.map(dp => dp.Maximum || 0));
            metricsData[device].cpu = { average: avgCpu.toFixed(1), max: maxCpu.toFixed(1) };
            
            // Check for anomalies
            if (maxCpu > 80) totalAnomalies++;
          }
        } catch (error) {
          // CPU metrics not available
        }
        
        // Query Memory utilization
        try {
          const memCommand = new GetMetricStatisticsCommand({
            Namespace: 'EdgeDevices',
            MetricName: 'MemoryUtilization',
            Dimensions: [{ Name: 'DeviceId', Value: device }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ['Average', 'Maximum']
          });
          
          const memResponse = await this.cloudWatchClient.send(memCommand);
          if (memResponse.Datapoints && memResponse.Datapoints.length > 0) {
            const avgMem = memResponse.Datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / memResponse.Datapoints.length;
            const maxMem = Math.max(...memResponse.Datapoints.map(dp => dp.Maximum || 0));
            metricsData[device].memory = { average: avgMem.toFixed(1), max: maxMem.toFixed(1) };
            
            if (maxMem > 85) totalAnomalies++;
          }
        } catch (error) {
          // Memory metrics not available
        }
      }
      
      // Format output
      output += `**Anomalies Detected**: ${totalAnomalies}\\n\\n`;
      
      if (totalAnomalies === 0) {
        output += '✅ No performance anomalies detected\\n\\n';
      } else {
        output += `⚠️  ${totalAnomalies} performance anomalies detected\\n\\n`;
      }
      
      // Display metrics for each device
      for (const device of targetDevices) {
        const metrics = metricsData[device];
        output += `### ${device}\\n`;
        
        if (metrics.cpu || metrics.memory || metrics.disk || metrics.network) {
          if (metrics.cpu) {
            output += `- **CPU**: ${metrics.cpu.average}% avg, ${metrics.cpu.max}% max\\n`;
          }
          if (metrics.memory) {
            output += `- **Memory**: ${metrics.memory.average}% avg, ${metrics.memory.max}% max\\n`;
          }
          output += '\\n';
        } else {
          output += `- No CloudWatch metrics available\\n\\n`;
        }
      }
      
      // Add note about setting up metrics
      output += '### Setting Up Edge Metrics\\n\\n';
      output += 'To push metrics from edge devices:\\n';
      output += '```bash\\n';
      output += '# Install CloudWatch agent on edge device\\n';
      output += 'aws cloudwatch put-metric-data \\\\\\n';
      output += '  --namespace EdgeDevices \\\\\\n';
      output += '  --metric-name CPUUtilization \\\\\\n';
      output += '  --dimensions DeviceId=$(hostname) \\\\\\n';
      output += '  --value $(top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | cut -d\'%\' -f1)\\n';
      output += '```\\n';
      
    } catch (error) {
      output += `**Error querying metrics**: ${error}\\n\\n`;
      output += 'CloudWatch metrics may not be configured for edge devices yet.\\n';
    }
    
    return output;
  }

  async getBackupStatus(deviceId?: string): Promise<string> {
    let output = '# Edge Backup Status\\n\\n';
    
    const targetDevices = deviceId ? [deviceId] : ['pifive0', 'piiv', 'piiv2'];
    const bucketName = process.env.S3_BUCKET || 'edge-backup-picluster-free';
    
    for (const device of targetDevices) {
      try {
        // List all backups for this device
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: `edge-data/${device}/`,
          MaxKeys: 100
        });
        
        const response = await this.s3Client.send(command);
        
        if (response.Contents && response.Contents.length > 0) {
          const backups = response.Contents.filter(obj => obj.Key && !obj.Key.endsWith('/'));
          const sortedBackups = backups.sort((a, b) => 
            (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
          );
          
          const latestBackup = sortedBackups[0];
          const totalSize = backups.reduce((sum, obj) => sum + (obj.Size || 0), 0);
          const sizeKB = Math.round(totalSize / 1024);
          
          output += `## ${device}\\n`;
          output += `**Total backups**: ${backups.length}\\n`;
          
          if (latestBackup && latestBackup.LastModified) {
            const timeSince = this.formatTimeSince(latestBackup.LastModified.toISOString());
            output += `**Latest backup**: ${timeSince} (${Math.round((latestBackup.Size || 0) / 1024)}KB)\\n`;
            output += `**Total size**: ${sizeKB}KB\\n`;
          }
          
          output += `**Status**: ✅ Active\\n\\n`;
        } else {
          output += `## ${device}\\n`;
          output += `**Total backups**: 0\\n`;
          output += `**Latest backup**: never (0KB)\\n`;
          output += `**Status**: ⚠️  No backups\\n\\n`;
        }
      } catch (error) {
        output += `## ${device}\\n`;
        output += `**Status**: ❌ Error querying backups\\n\\n`;
      }
    }
    
    return output;
  }

  async analyzeCosts(): Promise<string> {
    let output = '# Edge-Cloud Cost Analysis\\n\\n';
    
    output += '## AWS Free Tier Usage\\n';
    
    try {
      // Get actual S3 usage
      const bucketName = process.env.S3_BUCKET || 'edge-backup-picluster-free';
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000
      });
      
      const s3Response = await this.s3Client.send(listCommand);
      let totalS3Size = 0;
      
      if (s3Response.Contents) {
        totalS3Size = s3Response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      }
      
      const s3SizeGB = totalS3Size / (1024 * 1024 * 1024);
      const s3Percentage = (s3SizeGB / 5) * 100;
      
      output += `- **S3**: ${(totalS3Size / 1024).toFixed(1)}KB used of 5GB (${s3Percentage.toFixed(4)}%)\\n`;
      
      // Get CloudWatch metrics count
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      try {
        const cwCommand = new GetMetricStatisticsCommand({
          Namespace: 'EdgeDevices',
          MetricName: 'DeviceStatus',
          StartTime: startTime,
          EndTime: endTime,
          Period: 3600,
          Statistics: ['SampleCount']
        });
        
        const cwResponse = await this.cloudWatchClient.send(cwCommand);
        const metricCount = cwResponse.Datapoints?.length || 0;
        
        output += `- **CloudWatch**: ${metricCount} metric datapoints in last 24h\\n`;
      } catch (error) {
        output += `- **CloudWatch**: Unable to query metrics\\n`;
      }
      
    } catch (error) {
      output += `- **S3**: Unable to calculate usage\\n`;
    }
    
    output += `- **Lambda**: Minimal usage (edge processing reduces invocations)\\n`;
    output += `- **DynamoDB**: Not yet implemented\\n\\n`;
    
    output += '## Edge Infrastructure Costs\\n';
    output += '- **Hardware**: One-time cost (already owned)\\n';
    output += '- **Power**: ~$5-10/month for 3 Pi devices\\n';
    output += '- **Internet**: Existing connection\\n';
    output += '- **Storage**: Local (no additional cost)\\n\\n';
    
    output += '## Cost Optimization Status\\n';
    output += '✅ **Current setup is optimal for free tier**\\n';
    output += '- Edge processing reduces Lambda invocations\\n';
    output += '- Local storage reduces S3 PUT requests\\n';
    output += '- Rate limiting prevents free tier overruns\\n\\n';
    
    output += '💡 **Future optimizations**:\\n';
    output += '- Implement DynamoDB for device tracking\\n';
    output += '- Use CloudFront for edge content delivery\\n';
    output += '- Add CloudWatch alarms for anomaly detection\\n';
    
    return output;
  }

  async getOverview(): Promise<string> {
    const [deviceStatus, backupStatus, costAnalysis] = await Promise.all([
      this.getDeviceStatus(),
      this.getBackupStatus(),
      this.analyzeCosts()
    ]);
    
    return `# Edge Infrastructure Overview\\n\\n${deviceStatus}\\n\\n${backupStatus}\\n\\n${costAnalysis}`;
  }

  private formatTimeSince(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }
}