import { BaseQueryHandler, QueryOptions } from './base-query.js';

export class DigitalOceanQuery extends BaseQueryHandler {
    name = 'DigitalOcean Query Handler';
    description = 'Query DigitalOcean resources and services';
    private apiKey: string;
    private baseUrl = 'https://api.digitalocean.com/v2';

    constructor() {
        super();
        this.apiKey = process.env.DIGITALOCEAN_API_KEY || '';
        
        if (!this.apiKey) {
            console.warn('DigitalOcean API key not found in environment variables');
        }
    }

    async query(query: string, options?: QueryOptions): Promise<string> {
        try {
            const lowerQuery = query.toLowerCase();
            
            if (lowerQuery.includes('droplet') || lowerQuery.includes('instance') || lowerQuery.includes('vm')) {
                const droplets = await this.getDroplets();
                return this.formatResponse(droplets, options?.format);
            }
            
            if (lowerQuery.includes('space') || lowerQuery.includes('storage') || lowerQuery.includes('bucket')) {
                const spaces = await this.getSpaces();
                return this.formatResponse(spaces, options?.format);
            }
            
            if (lowerQuery.includes('volume') || lowerQuery.includes('disk')) {
                const volumes = await this.getVolumes();
                return this.formatResponse(volumes, options?.format);
            }
            
            if (lowerQuery.includes('database') || lowerQuery.includes('db')) {
                const databases = await this.getDatabases();
                return this.formatResponse(databases, options?.format);
            }
            
            if (lowerQuery.includes('balance') || lowerQuery.includes('billing') || lowerQuery.includes('cost')) {
                const billing = await this.getBillingInfo();
                return this.formatResponse(billing, options?.format);
            }
            
            if (lowerQuery.includes('region') || lowerQuery.includes('datacenter')) {
                const regions = await this.getRegions();
                return this.formatResponse(regions, options?.format);
            }
            
            if (lowerQuery.includes('size') || lowerQuery.includes('pricing')) {
                const sizes = await this.getDropletSizes();
                return this.formatResponse(sizes, options?.format);
            }
            
            if (lowerQuery.includes('status') || lowerQuery.includes('health') || lowerQuery.includes('overview')) {
                const overview = await this.getAccountOverview();
                return this.formatResponse(overview, options?.format);
            }
            
            // Default: return service overview
            const overview = {
                service: 'DigitalOcean',
                availableQueries: [
                    'droplets/instances/vm - Get droplet instances',
                    'spaces/storage/buckets - Get Spaces storage',
                    'volumes/disks - Get block storage volumes',
                    'databases/db - Get managed databases',
                    'balance/billing/cost - Get billing information',
                    'regions/datacenters - Get available regions',
                    'sizes/pricing - Get droplet sizes and pricing',
                    'status/health/overview - Get account overview'
                ],
                message: `Query: "${query}" - Use keywords like 'droplets', 'spaces', 'billing', etc.`,
                apiKeyConfigured: !!this.apiKey
            };
            
            return this.formatResponse(overview, options?.format);
            
        } catch (error) {
            console.error('DigitalOcean Query error:', error);
            return this.formatResponse({
                error: 'DigitalOcean query failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                query: query,
                apiKeyConfigured: !!this.apiKey
            }, options?.format);
        }
    }

    async getDroplets(): Promise<any> {
        try {
            const response = await this.makeRequest('/droplets');
            const data = await response.json() as any;
            
            if (!response.ok) {
                throw new Error(`API Error: ${data?.message || response.statusText}`);
            }
            
            return {
                service: 'DigitalOcean',
                droplets: data.droplets?.map((droplet: any) => ({
                    id: droplet.id,
                    name: droplet.name,
                    status: droplet.status,
                    region: droplet.region?.name || 'unknown',
                    size: droplet.size?.slug || 'unknown',
                    vcpus: droplet.vcpus,
                    memory: droplet.memory,
                    disk: droplet.disk,
                    ipv4: droplet.networks?.v4?.find((ip: any) => ip.type === 'public')?.ip_address || 'none',
                    ipv4_private: droplet.networks?.v4?.find((ip: any) => ip.type === 'private')?.ip_address || 'none',
                    image: droplet.image?.name || 'unknown',
                    created: droplet.created_at,
                    tags: droplet.tags || []
                })) || [],
                meta: data.meta,
                summary: {
                    totalDroplets: data.droplets?.length || 0,
                    activeDroplets: data.droplets?.filter((d: any) => d.status === 'active').length || 0
                }
            };
        } catch (error) {
            throw new Error(`Failed to get droplets: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getSpaces(): Promise<any> {
        try {
            // Note: Spaces API requires separate endpoint and credentials
            // For now, return placeholder structure
            return {
                service: 'DigitalOcean Spaces',
                spaces: [],
                message: 'Spaces API requires separate configuration - check Spaces keys in DigitalOcean console',
                note: 'Spaces uses S3-compatible API with separate access keys'
            };
        } catch (error) {
            throw new Error(`Failed to get spaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getVolumes(): Promise<any> {
        try {
            const response = await this.makeRequest('/volumes');
            const data = await response.json() as any;
            
            if (!response.ok) {
                throw new Error(`API Error: ${data?.message || response.statusText}`);
            }
            
            return {
                service: 'DigitalOcean',
                volumes: data.volumes?.map((volume: any) => ({
                    id: volume.id,
                    name: volume.name,
                    size: volume.size_gigabytes,
                    region: volume.region?.name || 'unknown',
                    filesystem_type: volume.filesystem_type,
                    droplet_ids: volume.droplet_ids || [],
                    created: volume.created_at
                })) || [],
                summary: {
                    totalVolumes: data.volumes?.length || 0,
                    totalSizeGB: data.volumes?.reduce((sum: number, v: any) => sum + v.size_gigabytes, 0) || 0
                }
            };
        } catch (error) {
            throw new Error(`Failed to get volumes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getDatabases(): Promise<any> {
        try {
            const response = await this.makeRequest('/databases');
            const data = await response.json() as any;
            
            if (!response.ok) {
                throw new Error(`API Error: ${data?.message || response.statusText}`);
            }
            
            return {
                service: 'DigitalOcean',
                databases: data.databases?.map((db: any) => ({
                    id: db.id,
                    name: db.name,
                    engine: db.engine,
                    version: db.version,
                    status: db.status,
                    region: db.region,
                    size: db.size,
                    num_nodes: db.num_nodes,
                    connection: {
                        host: db.connection?.host,
                        port: db.connection?.port,
                        database: db.connection?.database,
                        user: db.connection?.user
                    },
                    created: db.created_at
                })) || [],
                summary: {
                    totalDatabases: data.databases?.length || 0,
                    engines: [...new Set(data.databases?.map((db: any) => db.engine) || [])]
                }
            };
        } catch (error) {
            throw new Error(`Failed to get databases: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getBillingInfo(): Promise<any> {
        try {
            const response = await this.makeRequest('/customers/my/balance');
            const data = await response.json() as any;
            
            if (!response.ok) {
                throw new Error(`API Error: ${data?.message || response.statusText}`);
            }
            
            return {
                service: 'DigitalOcean',
                balance: {
                    account_balance: data.account_balance,
                    month_to_date_balance: data.month_to_date_balance,
                    month_to_date_usage: data.month_to_date_usage,
                    generated_at: data.generated_at
                },
                message: 'Current account balance and usage information'
            };
        } catch (error) {
            throw new Error(`Failed to get billing info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getRegions(): Promise<any> {
        try {
            const response = await this.makeRequest('/regions');
            const data = await response.json() as any;
            
            if (!response.ok) {
                throw new Error(`API Error: ${data?.message || response.statusText}`);
            }
            
            return {
                service: 'DigitalOcean',
                regions: data.regions?.map((region: any) => ({
                    name: region.name,
                    slug: region.slug,
                    available: region.available,
                    features: region.features || [],
                    sizes: region.sizes || []
                })) || [],
                summary: {
                    totalRegions: data.regions?.length || 0,
                    availableRegions: data.regions?.filter((r: any) => r.available).length || 0
                }
            };
        } catch (error) {
            throw new Error(`Failed to get regions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getDropletSizes(): Promise<any> {
        try {
            const response = await this.makeRequest('/sizes');
            const data = await response.json() as any;
            
            if (!response.ok) {
                throw new Error(`API Error: ${data?.message || response.statusText}`);
            }
            
            return {
                service: 'DigitalOcean',
                sizes: data.sizes?.map((size: any) => ({
                    slug: size.slug,
                    memory: size.memory,
                    vcpus: size.vcpus,
                    disk: size.disk,
                    transfer: size.transfer,
                    price_monthly: size.price_monthly,
                    price_hourly: size.price_hourly,
                    regions: size.regions || [],
                    available: size.available
                })) || [],
                summary: {
                    totalSizes: data.sizes?.length || 0,
                    cheapestMonthly: Math.min(...(data.sizes?.map((s: any) => s.price_monthly) || [0])),
                    availableSizes: data.sizes?.filter((s: any) => s.available).length || 0
                }
            };
        } catch (error) {
            throw new Error(`Failed to get sizes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getAccountOverview(): Promise<any> {
        try {
            const [droplets, volumes, databases, balance] = await Promise.all([
                this.getDroplets().catch(() => ({ droplets: [], summary: { totalDroplets: 0 } })),
                this.getVolumes().catch(() => ({ volumes: [], summary: { totalVolumes: 0 } })),
                this.getDatabases().catch(() => ({ databases: [], summary: { totalDatabases: 0 } })),
                this.getBillingInfo().catch(() => ({ balance: { account_balance: 'unknown' } }))
            ]);
            
            return {
                service: 'DigitalOcean',
                overview: {
                    droplets: {
                        total: droplets.summary.totalDroplets,
                        active: droplets.summary.activeDroplets || 0
                    },
                    volumes: {
                        total: volumes.summary.totalVolumes,
                        totalSizeGB: volumes.summary.totalSizeGB || 0
                    },
                    databases: {
                        total: databases.summary.totalDatabases
                    },
                    billing: {
                        balance: balance.balance.account_balance,
                        monthToDate: balance.balance.month_to_date_usage
                    }
                },
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to get account overview: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async makeRequest(endpoint: string): Promise<Response> {
        if (!this.apiKey) {
            throw new Error('DigitalOcean API key not configured');
        }
        
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response;
    }
}