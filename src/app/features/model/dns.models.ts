/**
 * DNS & TLS Management Models
 *
 * Type aliases, form state interfaces, and helper functions for the 3-level DNS architecture:
 * Level 1: DNS Zones (global, account-level)
 * Level 2: Cluster DNS Zone (zone → cluster assignment)
 * Level 3: App Endpoints (per-app endpoints)
 */

// --- Re-exports from generated DTOs ---

export type { DnsZoneResponseDto as DnsZoneResponse } from '../../core/api/model/dnsZoneResponseDto';
export type { ClusterDnsZoneResponseDto as ClusterDnsZoneResponse } from '../../core/api/model/clusterDnsZoneResponseDto';
export type { AppEndpointResponseDto as AppEndpointResponse } from '../../core/api/model/appEndpointResponseDto';
export type { CreateDnsZoneDto } from '../../core/api/model/createDnsZoneDto';
export type { AssignDnsZoneDto } from '../../core/api/model/assignDnsZoneDto';
export type { CreateAppEndpointDto } from '../../core/api/model/createAppEndpointDto';
export type { UpdateAppEndpointDto } from '../../core/api/model/updateAppEndpointDto';

// --- Enums ---

export enum DnsProvider {
  HETZNER = 'hetzner',
  NONE = 'none',
}

export enum CertificateProvider {
  LETS_ENCRYPT = 'lets_encrypt',
  LETS_ENCRYPT_STAGING = 'lets_encrypt_staging'
}

export enum DnsRecordType {
  A = 'A',
  AAAA = 'AAAA',
  CNAME = 'CNAME',
  TXT = 'TXT',
  MX = 'MX',
  SRV = 'SRV'
}

export enum DnsReconciliationStatus {
  PENDING = 'PENDING',
  IN_SYNC = 'IN_SYNC',
  DRIFT = 'DRIFT',
  RECONCILING = 'RECONCILING',
  ERROR = 'ERROR'
}

export enum CertificateStatus {
  PENDING = 'pending',
  ISSUING = 'issuing',
  VALID = 'valid',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

// --- Provider zone (raw response from provider discovery) ---

export interface ProviderZone {
  zoneId: string;
  name: string;
}

// --- Form state interfaces ---

export interface ZoneRegisterFormState {
  selectedProvider: string;
  selectedProviderZoneId: string;
  selectedZoneName: string;
  description: string;
}

export interface AssignZoneFormState {
  dnsZoneId: string;
  certificateProvider: CertificateProvider | '';
  acmeEmail: string;
  wildcardCertificate: boolean;
}

export interface EndpointFormState {
  serviceName: string;
  fqdn: string;
  k8sServiceName: string;
  k8sNamespace: string;
  k8sServicePort: number;
  dnsRecordType: string;
  clusterDnsZoneId: string;
  certificateRequired: boolean;
}

// --- Helper Functions ---

export function getReconciliationBadgeColor(status: DnsReconciliationStatus | string): string {
  switch (status) {
    case DnsReconciliationStatus.PENDING: return 'gray';
    case DnsReconciliationStatus.IN_SYNC: return 'green';
    case DnsReconciliationStatus.DRIFT: return 'yellow';
    case DnsReconciliationStatus.RECONCILING: return 'blue';
    case DnsReconciliationStatus.ERROR: return 'red';
    default: return 'gray';
  }
}

export function getReconciliationBadgeLabel(status: DnsReconciliationStatus | string): string {
  switch (status) {
    case DnsReconciliationStatus.PENDING: return 'Pending';
    case DnsReconciliationStatus.IN_SYNC: return 'In Sync';
    case DnsReconciliationStatus.DRIFT: return 'Drift Detected';
    case DnsReconciliationStatus.RECONCILING: return 'Reconciling';
    case DnsReconciliationStatus.ERROR: return 'Error';
    default: return 'Unknown';
  }
}

export function getReconciliationIcon(status: DnsReconciliationStatus | string): string {
  switch (status) {
    case DnsReconciliationStatus.PENDING: return '\u25CB';
    case DnsReconciliationStatus.IN_SYNC: return '\u2713';
    case DnsReconciliationStatus.DRIFT: return '\u26A0';
    case DnsReconciliationStatus.RECONCILING: return '\u27F3';
    case DnsReconciliationStatus.ERROR: return '\u2717';
    default: return '?';
  }
}

export function getCertificateBadgeColor(status: CertificateStatus | string | null): string {
  switch (status) {
    case CertificateStatus.PENDING: return 'yellow';
    case CertificateStatus.ISSUING: return 'blue';
    case CertificateStatus.VALID: return 'green';
    case CertificateStatus.EXPIRED: return 'red';
    case CertificateStatus.FAILED: return 'red';
    default: return 'gray';
  }
}

export function getCertificateBadgeLabel(status: CertificateStatus | string | null): string {
  switch (status) {
    case CertificateStatus.PENDING: return 'Pending';
    case CertificateStatus.ISSUING: return 'Issuing';
    case CertificateStatus.VALID: return 'Valid';
    case CertificateStatus.EXPIRED: return 'Expired';
    case CertificateStatus.FAILED: return 'Failed';
    default: return 'None';
  }
}

export function getCertificateIcon(status: CertificateStatus | string | null): string {
  switch (status) {
    case CertificateStatus.PENDING: return '\u25CB';
    case CertificateStatus.ISSUING: return '\u27F3';
    case CertificateStatus.VALID: return '\u2713';
    case CertificateStatus.EXPIRED: return '\u2717';
    case CertificateStatus.FAILED: return '\u2717';
    default: return '-';
  }
}

export function formatTimeSince(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 1) return 'Just now';
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

export function needsReconciliation(status: DnsReconciliationStatus | string): boolean {
  return status === DnsReconciliationStatus.PENDING
    || status === DnsReconciliationStatus.DRIFT
    || status === DnsReconciliationStatus.ERROR;
}

export function buildEndpointUrl(fqdn: string, tlsEnabled: boolean): string {
  const protocol = tlsEnabled ? 'https' : 'http';
  return `${protocol}://${fqdn}`;
}

export function isEndpointManaged(clusterDnsZoneId: string | null | undefined): boolean {
  return !!clusterDnsZoneId;
}

export function getZoneDisplayName(zoneName: string, dnsProvider: string): string {
  return `${zoneName} (${dnsProvider})`;
}
