/**
 * Firewall Models - Provider Firewalls Only
 * For v2 firewall management, see firewall-v2.models.ts
 */

/**
 * Provider Firewall Extended
 * Extends the DTO with provider information and usage status
 */
export interface ProviderFirewallExtended {
  id: string;
  name: string;
  provider: string;
  rules: unknown[];
  labels: Record<string, unknown>;
  appliedServers: unknown[];
  inUse: boolean;
  clusterId?: string;
  clusterName?: string;
}

/**
 * Provider Firewall Statistics
 */
export interface ProviderFirewallStats {
  total: number;
  inUse: number;
  unused: number;
  byProvider: Record<string, number>;
}

/**
 * Provider Firewall Filter State
 */
export interface ProviderFirewallFilterState {
  search: string;
  provider: string | 'ALL';
  inUse: boolean | 'ALL';
}
