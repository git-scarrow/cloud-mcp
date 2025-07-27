import { InstancesClient, ZonesClient } from '@google-cloud/compute';
import { Storage } from '@google-cloud/storage';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { BaseQueryHandler, QueryOptions } from './base-query.js';

export class GCPQuery extends BaseQueryHandler {
    name = 'GCP Query Handler';
    description = 'Query Google Cloud Platform resources and services';
    private instancesClient: InstancesClient;
    private zonesClient: ZonesClient;
    private storage: Storage;
    private monitoring: MetricServiceClient;
    private projectId: string;

    constructor() {
        super();
        this.projectId = process.env.GCP_PROJECT_ID || 'home-dev-sam';
        
        // Initialize GCP clients
        this.instancesClient = new InstancesClient({ projectId: this.projectId });
        this.zonesClient = new ZonesClient({ projectId: this.projectId });
        this.storage = new Storage({ projectId: this.projectId });
        this.monitoring = new MetricServiceClient({ projectId: this.projectId });
    }

    async getComputeInstances(): Promise<any> {
        try {
            // First get all zones
            const [zones] = await this.zonesClient.list({ project: this.projectId });
            const allInstances: any[] = [];
            
            // Get instances from each zone
            for (const zone of zones || []) {
                if (zone.name) {
                    try {
                        const [instances] = await this.instancesClient.list({
                            project: this.projectId,
                            zone: zone.name
                        });
                        
                        if (instances) {
                            allInstances.push(...instances.map(instance => ({
                                name: instance.name || 'unknown',
                                zone: zone.name,
                                status: instance.status || 'unknown',
                                machineType: instance.machineType?.split('/').pop() || 'unknown',
                                internalIP: instance.networkInterfaces?.[0]?.networkIP || 'unknown',
                                externalIP: instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || 'none',
                                labels: instance.labels || {},
                                creationTimestamp: instance.creationTimestamp
                            })));
                        }
                    } catch (zoneError) {
                        console.warn(`Error fetching instances from zone ${zone.name}:`, zoneError);
                    }
                }
            }
            
            return {
                project: this.projectId,
                instances: allInstances
            };
        } catch (error) {
            console.error('Error fetching GCP compute instances:', error);
            return {
                project: this.projectId,
                instances: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getStorageBuckets(): Promise<any> {
        try {
            const [buckets] = await this.storage.getBuckets();
            
            const bucketDetails = await Promise.all(
                buckets.map(async (bucket) => {
                    try {
                        const [metadata] = await bucket.getMetadata();
                        const [files] = await bucket.getFiles({ maxResults: 10 });
                        
                        return {
                            name: bucket.name,
                            location: metadata.location,
                            storageClass: metadata.storageClass,
                            created: metadata.timeCreated,
                            fileCount: files.length,
                            files: files.map(file => ({
                                name: file.name,
                                size: file.metadata.size,
                                updated: file.metadata.updated
                            }))
                        };
                    } catch (error) {
                        return {
                            name: bucket.name,
                            error: 'Failed to get bucket details'
                        };
                    }
                })
            );

            return {
                project: this.projectId,
                buckets: bucketDetails
            };
        } catch (error) {
            console.error('Error fetching GCP storage buckets:', error);
            return {
                project: this.projectId,
                buckets: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getMonitoringMetrics(instanceName?: string): Promise<any> {
        try {
            const projectPath = this.monitoring.projectPath(this.projectId);
            
            // Get CPU utilization metrics
            const request = {
                name: projectPath,
                filter: instanceName 
                    ? `metric.type="compute.googleapis.com/instance/cpu/utilization" AND resource.labels.instance_name="${instanceName}"`
                    : 'metric.type="compute.googleapis.com/instance/cpu/utilization"',
                interval: {
                    endTime: {
                        seconds: Math.floor(Date.now() / 1000),
                    },
                    startTime: {
                        seconds: Math.floor(Date.now() / 1000) - 3600, // Last hour
                    },
                },
            };

            const [timeSeries] = await this.monitoring.listTimeSeries(request);
            
            const metrics = timeSeries.map(series => ({
                instance: series.resource?.labels?.instance_name || 'unknown',
                zone: series.resource?.labels?.zone || 'unknown',
                metricType: series.metric?.type || 'unknown',
                points: series.points?.map(point => ({
                    value: point.value?.doubleValue || 0,
                    timestamp: point.interval?.endTime?.seconds
                })) || []
            }));

            return {
                project: this.projectId,
                metrics,
                timeRange: 'Last 1 hour'
            };
        } catch (error) {
            console.error('Error fetching GCP monitoring metrics:', error);
            return {
                project: this.projectId,
                metrics: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getProjectInfo(): Promise<any> {
        try {
            // Return basic project information without detailed zone/region queries for now
            return {
                projectId: this.projectId,
                services: {
                    compute: 'enabled',
                    storage: 'enabled',
                    monitoring: 'enabled'
                },
                message: 'Project information available - detailed zone/region data requires additional API calls'
            };
        } catch (error) {
            console.error('Error fetching GCP project info:', error);
            return {
                projectId: this.projectId,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getFreeTierUsage(): Promise<any> {
        try {
            const instances = await this.getComputeInstances();
            const buckets = await this.getStorageBuckets();
            
            // Calculate free tier usage
            const f1MicroCount = instances.instances?.filter(
                (vm: any) => vm.machineType === 'f1-micro'
            ).length || 0;
            
            const totalStorage = buckets.buckets?.reduce(
                (total: number, bucket: any) => {
                    const bucketSize = bucket.files?.reduce(
                        (size: number, file: any) => size + (parseInt(file.size) || 0), 0
                    ) || 0;
                    return total + bucketSize;
                }, 0
            ) || 0;
            
            return {
                project: this.projectId,
                freeTierUsage: {
                    compute: {
                        f1MicroInstances: f1MicroCount,
                        limit: 1,
                        withinLimit: f1MicroCount <= 1
                    },
                    storage: {
                        used: Math.round(totalStorage / (1024 * 1024 * 1024 * 1024) * 1000) / 1000, // TB
                        limit: 5, // 5GB free
                        withinLimit: totalStorage < 5 * 1024 * 1024 * 1024
                    }
                },
                estimatedMonthlyCost: f1MicroCount <= 1 ? 0 : 'Above free tier'
            };
        } catch (error) {
            console.error('Error calculating GCP free tier usage:', error);
            return {
                project: this.projectId,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async query(query: string, options?: QueryOptions): Promise<string> {
        try {
            const lowerQuery = query.toLowerCase();
            
            if (lowerQuery.includes('instance') || lowerQuery.includes('compute') || lowerQuery.includes('vm')) {
                const instances = await this.getComputeInstances();
                return this.formatResponse(instances, options?.format);
            }
            
            if (lowerQuery.includes('storage') || lowerQuery.includes('bucket')) {
                const buckets = await this.getStorageBuckets();
                return this.formatResponse(buckets, options?.format);
            }
            
            if (lowerQuery.includes('metric') || lowerQuery.includes('monitoring') || lowerQuery.includes('cpu')) {
                const metrics = await this.getMonitoringMetrics();
                return this.formatResponse(metrics, options?.format);
            }
            
            if (lowerQuery.includes('project') || lowerQuery.includes('info')) {
                const projectInfo = await this.getProjectInfo();
                return this.formatResponse(projectInfo, options?.format);
            }
            
            if (lowerQuery.includes('free tier') || lowerQuery.includes('cost') || lowerQuery.includes('usage')) {
                const usage = await this.getFreeTierUsage();
                return this.formatResponse(usage, options?.format);
            }
            
            if (lowerQuery.includes('status') || lowerQuery.includes('health')) {
                const instances = await this.getComputeInstances();
                const buckets = await this.getStorageBuckets();
                const usage = await this.getFreeTierUsage();
                
                const status = {
                    project: this.projectId,
                    summary: {
                        instances: instances.instances?.length || 0,
                        buckets: buckets.buckets?.length || 0,
                        withinFreeTier: usage.freeTierUsage?.compute?.withinLimit && usage.freeTierUsage?.storage?.withinLimit
                    },
                    instances: instances.instances,
                    storage: buckets.buckets,
                    usage: usage.freeTierUsage
                };
                
                return this.formatResponse(status, options?.format);
            }
            
            // Default: return project overview
            const overview = {
                service: 'GCP',
                project: this.projectId,
                availableQueries: [
                    'instances/compute/vm - Get compute instances',
                    'storage/buckets - Get storage buckets', 
                    'metrics/monitoring - Get monitoring data',
                    'project/info - Get project information',
                    'free tier/cost/usage - Get usage and costs',
                    'status/health - Get overall status'
                ],
                message: `Query: "${query}" - Use specific keywords like 'instances', 'storage', 'metrics', etc.`
            };
            
            return this.formatResponse(overview, options?.format);
            
        } catch (error) {
            console.error('GCP Query error:', error);
            return this.formatResponse({
                error: 'GCP query failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                query: query
            }, options?.format);
        }
    }
}