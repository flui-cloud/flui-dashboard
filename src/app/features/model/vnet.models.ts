/**
 * VNet Management Domain Models
 *
 * These models represent the domain layer for Virtual Network management,
 * mapping from API DTOs to frontend-friendly interfaces.
 */

// ===== ENUMS =====

export enum VNetStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  DELETING = 'DELETING',
  DELETED = 'DELETED'
}


// ===== INTERFACES =====

/**
 * Label key-value pair
 */
export interface VNetLabel {
  key: string;
  value: string;
}

/**
 * Subnet information
 */
export interface SubnetInfo {
  id: string;
  vnetId: string;
  providerSubnetId?: string;
  ipRange: string;
  networkZone: string;
  gateway?: string;
  vswitchId?: string;
  attachedServerIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Route information
 */
export interface RouteInfo {
  id: string;
  destination: string;
  gateway: string;
}

/**
 * VNet information (domain model)
 */
export interface VNetInfo {
  id: string;
  providerResourceId: string;
  name: string;
  provider: string;
  ipRange: string;
  labels: VNetLabel[];
  metadata?: Record<string, any>;
  status: VNetStatus;
  subnets: SubnetInfo[];
  routes: RouteInfo[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Computed property helper: Get all attached server IDs from all subnets
 */
export function getAllAttachedServerIds(vnet: VNetInfo): string[] {
  return vnet.subnets.flatMap(subnet => subnet.attachedServerIds);
}

/**
 * Configuration for creating a new VNet
 */
export interface CreateVNetConfiguration {
  name: string;
  provider: string;
  ipRange: string;
  labels?: VNetLabel[];
  metadata?: Record<string, any>;
  subnet?: {
    networkZone: string;
    ipRange?: string;
    vswitchId?: string;
  };
}

/**
 * Configuration for adding a subnet to a VNet
 */
export interface AddSubnetConfiguration {
  networkZone: string;
  ipRange?: string;
  vswitchId?: string;
}

/**
 * Filter state for VNet list
 */
export interface VNetFilterState {
  search: string;
  provider: string;
  status: VNetStatus | '';
  clusterId: string;
}

/**
 * Statistics for VNet list
 */
export interface VNetStatistics {
  total: number;
  active: number;
  pending: number;
  failed: number;
  totalSubnets: number;
  totalAttachedServers: number;
}

/**
 * Configuration for attaching a server to a subnet
 */
export interface AttachServerToSubnetConfiguration {
  serverId: string;
  ip?: string;
  aliasIps?: string[];
}

/**
 * Configuration for detaching a server from a subnet
 */
export interface DetachServerFromSubnetConfiguration {
  serverId: string;
}
