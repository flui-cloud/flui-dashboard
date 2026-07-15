/**
 * Firewall V2 Models - Desired-State Architecture
 *
 * This file contains models and utilities for the new firewall v2 API,
 * which uses a desired-state, GitOps-style approach instead of templates.
 */

import { FirewallRuleResponseDto, FirewallResponseDto } from '../../core/api/model/models';

/**
 * Coverage Status helpers
 */
export type CoverageStatus = FirewallResponseDto.CoverageStatusEnum;

export function getCoverageStatusLabel(status: CoverageStatus): string {
  switch (status) {
    case 'FULL':      return 'All Nodes Ready';
    case 'PARTIAL':   return 'Partial Coverage';
    case 'ORPHANED':  return 'Orphaned';
    case 'UNKNOWN':   return 'Unknown';
    default:          return 'Unknown';
  }
}

export function getCoverageStatusColor(status: CoverageStatus): string {
  switch (status) {
    case 'FULL':      return 'green';
    case 'PARTIAL':   return 'yellow';
    case 'ORPHANED':  return 'red';
    case 'UNKNOWN':   return 'gray';
    default:          return 'gray';
  }
}

/**
 * Reconciliation Status Enum
 * Represents the current state of firewall reconciliation
 */
export enum ReconciliationStatus {
  PENDING = 'PENDING',           // Firewall created, never reconciled
  IN_SYNC = 'IN_SYNC',          // Desired and applied states match
  DRIFT = 'DRIFT',              // Desired differs from applied
  RECONCILING = 'RECONCILING',  // Reconciliation in progress
  ERROR = 'ERROR'               // Last reconciliation failed
}

/**
 * Firewall rule for form editing
 */
export interface FirewallRuleFormData {
  id?: string;
  description: string;
  direction: 'in' | 'out';
  protocol: 'tcp' | 'udp' | 'icmp';
  port?: string;
  sourceIps?: string[];
  destinationIps?: string[];
}

/**
 * Firewall configuration for cluster creation
 */
export interface FirewallConfigFormData {
  enabled: boolean;
  sourceCidrs?: string[];
  customRules?: FirewallRuleFormData[];
  required?: boolean;
}

/**
 * Filter state for firewall list
 */
export interface FirewallFilterState {
  search: string;
  status?: ReconciliationStatus;
  clusterId?: string;
  coverage?: CoverageStatus;
}

/**
 * Extended firewall response with computed fields
 */
export interface FirewallExtended extends FirewallResponseDto {
  clusterName?: string;
  statusBadgeColor: string;
  statusBadgeLabel: string;
  driftIndicator: string;
}

/**
 * Statistics for firewall dashboard
 */
export interface FirewallStats {
  total: number;
  inSync: number;
  drift: number;
  pending: number;
  error: number;
  reconciling: number;
  partial: number;
  orphaned: number;
}

/**
 * Cluster type enum for default rules
 */
export enum ClusterType {
  CONTROL = 'control',
  WORKLOAD = 'workload',
  OBSERVABILITY = 'observability'
}

/**
 * Default firewall rules for control clusters
 * Ports: SSH (22), Grafana (30300), Prometheus (30900), PostgreSQL (30432),
 *        Redis (30379), Loki (30100), Health Check (30080)
 */
export const CONTROL_DEFAULT_RULES: FirewallRuleFormData[] = [
  {
    description: 'SSH Access',
    direction: 'in',
    protocol: 'tcp',
    port: '22',
    sourceIps: ['0.0.0.0/0']
  },
  {
    description: 'Grafana Dashboard',
    direction: 'in',
    protocol: 'tcp',
    port: '30300',
    sourceIps: ['0.0.0.0/0']
  },
  {
    description: 'Prometheus Metrics',
    direction: 'in',
    protocol: 'tcp',
    port: '30900',
    sourceIps: ['0.0.0.0/0']
  },
  {
    description: 'PostgreSQL Database',
    direction: 'in',
    protocol: 'tcp',
    port: '30432',
    sourceIps: ['0.0.0.0/0']
  },
  {
    description: 'Redis Cache',
    direction: 'in',
    protocol: 'tcp',
    port: '30379',
    sourceIps: ['0.0.0.0/0']
  },
  {
    description: 'Loki Logs',
    direction: 'in',
    protocol: 'tcp',
    port: '30100',
    sourceIps: ['0.0.0.0/0']
  },
  {
    description: 'Health Check Endpoint',
    direction: 'in',
    protocol: 'tcp',
    port: '30080',
    sourceIps: ['0.0.0.0/0']
  },
  {
    description: 'Allow All Outbound',
    direction: 'out',
    protocol: 'tcp',
    destinationIps: ['0.0.0.0/0', '::/0']
  },
  {
    description: 'Allow UDP Outbound',
    direction: 'out',
    protocol: 'udp',
    destinationIps: ['0.0.0.0/0', '::/0']
  }
];

/**
 * Default firewall rules for Workload clusters
 * Ports: SSH (22), HTTP (80), HTTPS (443). 80/443 are mandatory — Traefik serves
 * apps over HTTPS and ACME needs HTTP-01 on 80; the API enforces them server-side
 * and will re-add them if omitted. The K3s API (6443) is not exposed here — the
 * API scopes it internally to the VNet/subnet CIDR, or to the control cluster's
 * public IP for cross-provider workloads.
 *
 * Every world-open rule names ::/0 alongside 0.0.0.0/0: nodes are dual-stack, and
 * the provider drops what its rules don't match rather than refusing it — so an
 * IPv4-only wildcard blackholes IPv6 instead of failing fast. The API completes
 * these server-side too; keeping both here means the wizard shows what is applied.
 */
export const WORKLOAD_DEFAULT_RULES: FirewallRuleFormData[] = [
  {
    description: 'SSH Access',
    direction: 'in',
    protocol: 'tcp',
    port: '22',
    sourceIps: ['0.0.0.0/0']
  },
  {
    description: 'HTTP (ACME / redirect)',
    direction: 'in',
    protocol: 'tcp',
    port: '80',
    sourceIps: ['0.0.0.0/0', '::/0']
  },
  {
    description: 'HTTPS (Traefik)',
    direction: 'in',
    protocol: 'tcp',
    port: '443',
    sourceIps: ['0.0.0.0/0', '::/0']
  },
  {
    description: 'Allow All Outbound',
    direction: 'out',
    protocol: 'tcp',
    destinationIps: ['0.0.0.0/0', '::/0']
  },
  {
    description: 'Allow UDP Outbound',
    direction: 'out',
    protocol: 'udp',
    destinationIps: ['0.0.0.0/0', '::/0']
  }
];

/**
 * Get default rules based on cluster type
 */
export function getDefaultRulesForClusterType(type: ClusterType): FirewallRuleFormData[] {
  switch (type) {
    case ClusterType.CONTROL:
    case ClusterType.OBSERVABILITY:
      return [...CONTROL_DEFAULT_RULES];
    case ClusterType.WORKLOAD:
      return [...WORKLOAD_DEFAULT_RULES];
    default:
      return [...WORKLOAD_DEFAULT_RULES];
  }
}

/**
 * Apply source CIDRs to all inbound rules
 */
export function applySourceCidrsToRules(
  rules: FirewallRuleFormData[],
  sourceCidrs: string[]
): FirewallRuleFormData[] {
  return rules.map(rule => {
    if (rule.direction === 'in' && sourceCidrs.length > 0) {
      return {
        ...rule,
        sourceIps: sourceCidrs
      };
    }
    return rule;
  });
}

/**
 * Convert FirewallRuleResponseDto to FirewallRuleFormData
 */
export function convertRuleResponseToFormData(rule: FirewallRuleResponseDto): FirewallRuleFormData {
  return {
    description: rule.description,
    direction: rule.direction as 'in' | 'out',
    protocol: rule.protocol as 'tcp' | 'udp' | 'icmp',
    port: rule.port,
    sourceIps: rule.sourceIps || [],
    destinationIps: rule.destinationIps || []
  };
}

/**
 * Convert FirewallRuleFormData to FirewallRuleResponseDto
 */
export function convertRuleFormDataToResponse(rule: FirewallRuleFormData): FirewallRuleResponseDto {
  const response: FirewallRuleResponseDto = {
    description: rule.description,
    direction: rule.direction as FirewallRuleResponseDto.DirectionEnum,
    protocol: rule.protocol as FirewallRuleResponseDto.ProtocolEnum
  };

  if (rule.port) {
    response.port = rule.port;
  }

  if (rule.direction === 'in' && rule.sourceIps && rule.sourceIps.length > 0) {
    response.sourceIps = rule.sourceIps;
  }

  if (rule.direction === 'out' && rule.destinationIps && rule.destinationIps.length > 0) {
    response.destinationIps = rule.destinationIps;
  }

  return response;
}

/**
 * Get status badge color based on reconciliation status
 */
export function getStatusBadgeColor(status: ReconciliationStatus): string {
  switch (status) {
    case ReconciliationStatus.PENDING:
      return 'gray';
    case ReconciliationStatus.IN_SYNC:
      return 'green';
    case ReconciliationStatus.DRIFT:
      return 'yellow';
    case ReconciliationStatus.RECONCILING:
      return 'blue';
    case ReconciliationStatus.ERROR:
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get status badge label
 */
export function getStatusBadgeLabel(status: ReconciliationStatus): string {
  switch (status) {
    case ReconciliationStatus.PENDING:
      return 'Pending';
    case ReconciliationStatus.IN_SYNC:
      return 'In Sync';
    case ReconciliationStatus.DRIFT:
      return 'Drift Detected';
    case ReconciliationStatus.RECONCILING:
      return 'Reconciling';
    case ReconciliationStatus.ERROR:
      return 'Error';
    default:
      return 'Unknown';
  }
}

/**
 * Get drift indicator message
 */
export function getDriftIndicator(hasDrift: boolean, status: ReconciliationStatus): string {
  if (!hasDrift) {
    return '✓ In sync with provider';
  }

  switch (status) {
    case ReconciliationStatus.DRIFT:
      return '⚠ Desired state differs from applied state';
    case ReconciliationStatus.PENDING:
      return '○ Never reconciled';
    case ReconciliationStatus.ERROR:
      return '✗ Reconciliation failed';
    default:
      return '⚠ State may be out of sync';
  }
}

/**
 * Calculate firewall statistics from a list of firewalls
 */
export function calculateFirewallStats(firewalls: FirewallResponseDto[]): FirewallStats {
  return {
    total: firewalls.length,
    inSync: firewalls.filter(f => f.reconciliationStatus === ReconciliationStatus.IN_SYNC).length,
    drift: firewalls.filter(f => f.reconciliationStatus === ReconciliationStatus.DRIFT).length,
    pending: firewalls.filter(f => f.reconciliationStatus === ReconciliationStatus.PENDING).length,
    error: firewalls.filter(f => f.reconciliationStatus === ReconciliationStatus.ERROR).length,
    reconciling: firewalls.filter(f => f.reconciliationStatus === ReconciliationStatus.RECONCILING).length,
    partial: firewalls.filter(f => f.coverageStatus === 'PARTIAL').length,
    orphaned: firewalls.filter(f => f.coverageStatus === 'ORPHANED').length
  };
}

/**
 * Validate CIDR format (supports both IPv4 and IPv6)
 */
export function isValidCidr(cidr: string): boolean {
  // IPv4 CIDR regex: 192.168.1.0/24
  const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

  // IPv6 CIDR regex: 2001:db8::/32, ::/0, fe80::/10
  const ipv6CidrRegex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/;

  // Check IPv4
  if (ipv4CidrRegex.test(cidr)) {
    const [ip, mask] = cidr.split('/');
    const octets = ip.split('.').map(Number);
    const maskNum = Number(mask);

    // Validate octets (0-255)
    if (octets.some(octet => octet < 0 || octet > 255)) {
      return false;
    }

    // Validate mask (0-32)
    if (maskNum < 0 || maskNum > 32) {
      return false;
    }

    return true;
  }

  // Check IPv6
  if (ipv6CidrRegex.test(cidr)) {
    const [, mask] = cidr.split('/');
    const maskNum = Number(mask);

    // Validate mask (0-128 for IPv6)
    if (maskNum < 0 || maskNum > 128) {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Validate firewall rule
 */
export function validateFirewallRule(rule: FirewallRuleFormData): string[] {
  const errors: string[] = [];

  if (!rule.description || rule.description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (!rule.direction || !['in', 'out'].includes(rule.direction)) {
    errors.push('Direction must be "in" or "out"');
  }

  if (!rule.protocol || !['tcp', 'udp', 'icmp'].includes(rule.protocol)) {
    errors.push('Protocol must be "tcp", "udp", or "icmp"');
  }

  // Port validation (not required for ICMP)
  if (rule.protocol !== 'icmp' && !rule.port) {
    errors.push('Port is required for TCP and UDP protocols');
  }

  // CIDR validation
  if (rule.direction === 'in' && rule.sourceIps) {
    rule.sourceIps.forEach(cidr => {
      if (!isValidCidr(cidr)) {
        errors.push(`Invalid source CIDR format: ${cidr}`);
      }
    });
  }

  if (rule.direction === 'out' && rule.destinationIps) {
    rule.destinationIps.forEach(cidr => {
      if (!isValidCidr(cidr)) {
        errors.push(`Invalid destination CIDR format: ${cidr}`);
      }
    });
  }

  return errors;
}
