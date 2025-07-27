// Secrets Management Integration
// Supports multiple secret providers: 1Password CLI, AWS Secrets Manager, HashiCorp Vault

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SecretProvider {
  getSecret(key: string): Promise<string>;
  listSecrets(): Promise<string[]>;
  rotateSecret?(key: string): Promise<void>;
}

// 1Password CLI Integration
export class OnePasswordProvider implements SecretProvider {
  private vault: string;

  constructor(vault: string = 'Personal') {
    this.vault = vault;
  }

  async getSecret(key: string): Promise<string> {
    try {
      // Use 1Password CLI to retrieve secret
      const { stdout } = await execAsync(`op item get "${key}" --vault="${this.vault}" --field=password --format=json`);
      const result = JSON.parse(stdout);
      return result.password || result.value || stdout.trim();
    } catch (error) {
      throw new Error(`Failed to retrieve secret '${key}' from 1Password: ${error.message}`);
    }
  }

  async listSecrets(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`op item list --vault="${this.vault}" --format=json`);
      const items = JSON.parse(stdout);
      return items.map((item: any) => item.title);
    } catch (error) {
      throw new Error(`Failed to list secrets from 1Password: ${error.message}`);
    }
  }
}

// AWS Secrets Manager Integration
export class AWSSecretsProvider implements SecretProvider {
  private region: string;

  constructor(region: string = 'us-east-1') {
    this.region = region;
  }

  async getSecret(key: string): Promise<string> {
    try {
      // Use AWS CLI to retrieve secret
      const { stdout } = await execAsync(`aws secretsmanager get-secret-value --secret-id "${key}" --region ${this.region} --query SecretString --output text`);
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to retrieve secret '${key}' from AWS Secrets Manager: ${error.message}`);
    }
  }

  async listSecrets(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`aws secretsmanager list-secrets --region ${this.region} --query 'SecretList[].Name' --output json`);
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(`Failed to list secrets from AWS Secrets Manager: ${error.message}`);
    }
  }
}

// HashiCorp Vault Integration
export class VaultProvider implements SecretProvider {
  private vaultAddr: string;
  private vaultPath: string;

  constructor(vaultAddr?: string, vaultPath: string = 'secret') {
    this.vaultAddr = vaultAddr || process.env.VAULT_ADDR || 'http://localhost:8200';
    this.vaultPath = vaultPath;
  }

  async getSecret(key: string): Promise<string> {
    try {
      // Use Vault CLI to retrieve secret
      const { stdout } = await execAsync(`vault kv get -field=value ${this.vaultPath}/${key}`, {
        env: { ...process.env, VAULT_ADDR: this.vaultAddr }
      });
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to retrieve secret '${key}' from Vault: ${error.message}`);
    }
  }

  async listSecrets(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`vault kv list -format=json ${this.vaultPath}/`, {
        env: { ...process.env, VAULT_ADDR: this.vaultAddr }
      });
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(`Failed to list secrets from Vault: ${error.message}`);
    }
  }

  async rotateSecret(key: string): Promise<void> {
    // Implement secret rotation logic
    throw new Error('Secret rotation not implemented for Vault provider');
  }
}

// Environment Variable Fallback (for development)
export class EnvProvider implements SecretProvider {
  async getSecret(key: string): Promise<string> {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Environment variable '${key}' not found`);
    }
    return value;
  }

  async listSecrets(): Promise<string[]> {
    return Object.keys(process.env);
  }
}

// Unified Secrets Manager
export class SecretsManager {
  private provider: SecretProvider;
  private cache: Map<string, { value: string; expiry: number }>;
  private cacheTTL: number;

  constructor(provider?: SecretProvider, cacheTTL: number = 300000) { // 5 minute cache
    this.provider = provider || this.getDefaultProvider();
    this.cache = new Map();
    this.cacheTTL = cacheTTL;
  }

  private getDefaultProvider(): SecretProvider {
    // Determine the best available provider
    const providerType = process.env.SECRETS_PROVIDER || 'auto';
    
    switch (providerType) {
      case '1password':
        return new OnePasswordProvider(process.env.OP_VAULT);
      case 'aws':
        return new AWSSecretsProvider(process.env.AWS_REGION);
      case 'vault':
        return new VaultProvider(process.env.VAULT_ADDR, process.env.VAULT_PATH);
      case 'env':
        return new EnvProvider();
      case 'auto':
      default:
        // Auto-detect available provider
        return this.autoDetectProvider();
    }
  }

  private autoDetectProvider(): SecretProvider {
    // Synchronously check for CLI tools to prevent memory leaks
    try {
      // Check for 1Password CLI
      try {
        const { execSync } = require('child_process');
        execSync('op --version', { stdio: 'ignore', timeout: 1000 });
        console.log('🔐 Using 1Password CLI for secrets management');
        return new OnePasswordProvider();
      } catch {}

      // Check for AWS CLI
      try {
        const { execSync } = require('child_process');
        execSync('aws --version', { stdio: 'ignore', timeout: 1000 });
        console.log('🔐 Using AWS Secrets Manager for secrets management');
        return new AWSSecretsProvider();
      } catch {}

      // Check for Vault CLI
      try {
        const { execSync } = require('child_process');
        execSync('vault version', { stdio: 'ignore', timeout: 1000 });
        console.log('🔐 Using HashiCorp Vault for secrets management');
        return new VaultProvider();
      } catch {}
    } catch (error) {
      console.warn('Error detecting secrets manager:', error.message);
    }

    // Fallback to environment variables
    console.warn('⚠️  No secrets manager detected, using environment variables');
    return new EnvProvider();
  }

  async getSecret(key: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.value;
    }

    try {
      const value = await this.provider.getSecret(key);
      
      // Cache the secret
      this.cache.set(key, {
        value,
        expiry: Date.now() + this.cacheTTL
      });

      return value;
    } catch (error) {
      // If secrets manager fails, try environment variable as fallback
      console.warn(`Secrets manager failed for '${key}', trying environment variable:`, error.message);
      const envValue = process.env[key];
      if (envValue) {
        return envValue;
      }
      throw error;
    }
  }

  async getRequiredSecret(key: string): Promise<string> {
    try {
      return await this.getSecret(key);
    } catch (error) {
      throw new Error(`Required secret '${key}' not found: ${error.message}`);
    }
  }

  async loadSecrets(keys: string[]): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {};
    
    const promises = keys.map(async (key) => {
      try {
        secrets[key] = await this.getSecret(key);
      } catch (error) {
        console.error(`Failed to load secret '${key}':`, error.message);
        // Don't fail the entire operation for optional secrets
      }
    });

    await Promise.all(promises);
    return secrets;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Helper method to safely check if a secret exists
  async hasSecret(key: string): Promise<boolean> {
    try {
      await this.getSecret(key);
      return true;
    } catch {
      return false;
    }
  }
}

// Configuration mapping for MCP server secrets
export const MCP_SECRETS = {
  JWT_SECRET: 'mcp-jwt-secret',
  PIPEDREAM_API_KEY: 'mcp-pipedream-api-key',
  MONITORING_API_KEY: 'mcp-monitoring-api-key',
  ADMIN_API_KEY: 'mcp-admin-api-key',
  ORACLE_PASSWORD: 'mcp-oracle-password',
  ORACLE_WALLET_PASSWORD: 'mcp-oracle-wallet-password'
};

// Singleton instance
export const secretsManager = new SecretsManager();

// Initialize secrets on startup
export async function initializeSecrets(): Promise<void> {
  console.log('🔐 Initializing secrets management...');
  
  try {
    // Load critical secrets
    const criticalSecrets = [
      'JWT_SECRET',
      'PIPEDREAM_API_KEY',
      'ORACLE_PASSWORD'
    ];

    for (const secretKey of criticalSecrets) {
      const secretName = MCP_SECRETS[secretKey] || secretKey;
      try {
        const value = await secretsManager.getSecret(secretName);
        // Set in process.env for compatibility with existing code
        process.env[secretKey] = value;
        console.log(`✅ Loaded secret: ${secretKey}`);
      } catch (error) {
        console.warn(`⚠️  Failed to load ${secretKey}:`, error.message);
      }
    }

    console.log('🔐 Secrets initialization complete');
  } catch (error) {
    console.error('❌ Secrets initialization failed:', error);
    throw error;
  }
}

// Auto-rotate secrets (for production)
export async function rotateSecrets(): Promise<void> {
  // This would implement automatic secret rotation
  console.log('🔄 Secret rotation not yet implemented');
}