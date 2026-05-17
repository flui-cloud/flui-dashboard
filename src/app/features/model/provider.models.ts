import { ProviderDefinitionDto } from "../../core/api";


export enum ProviderStatus {
  NOT_CONFIGURED = 'not_configured',
  CONFIGURING = 'configuring',
  VALIDATING = 'validating',
  ACTIVE = 'active',
  ERROR = 'error',
  DISABLED = 'disabled'
}

export interface ProviderRegion {
  id?: string;
  name?: string;
  displayName?: string;
  location?: string;
  available?: boolean;
  flagEmoji?: string;
  country?: string;
}

export interface ProviderCapabilities {
  supportedInstanceTypes: string[];
  supportedRegions: ProviderRegion[];
  credentialType: 'api_key' | 'bearer_token' | 'user_password';
  features: {
    autoScaling: boolean;
    loadBalancers: boolean;
    privateNetworking: boolean;
    snapshots: boolean;
    backups: boolean;
  };
  pricing: {
    currency: string;
    billingCycle: string;
    minimumCost: number;
  };
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
  description: string;
  placeholder: string;
  helpUrl?: string;
}

export interface ConfigurationSchema {
  credentials: CredentialField[];
  regions: boolean;
}

export interface Provider {
  id: string;
  name: string;
  displayName: string;
  description: string;
  logoUrl: string;
  websiteUrl: string;
  documentationUrl: string;
  capabilities: ProviderCapabilities;
  configurationSchema: ConfigurationSchema;
}

export interface ProviderConfiguration {
  id: string;
  provider: ProviderDefinitionDto;
  status: ProviderStatus;
  enabledRegions: string[];
  lastHealthCheck?: Date;
  isActive: boolean;
  errorMessage?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errors?: string[];
}
